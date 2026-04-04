"""
Production-grade Redis-based rate limiter using Sorted Sets (ZSET).

Implements a sliding-window algorithm that is:
- Distributed-safe (works across multiple app instances)
- Atomic (uses Redis pipelines)
- Configurable per-endpoint
- Gracefully degrades when Redis is unavailable

Usage::

    from blockvault.core.rate_limiter import limiter

    # In an endpoint:
    result = limiter.check("access", token_hash, client_ip)
    if not result.allowed:
        return jsonify({"error": "rate_limited", "message": result.message}), 429
"""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from typing import Optional

import redis

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass
class RateLimitResult:
    """Result of a rate-limit check."""
    allowed: bool
    message: str = ""
    remaining: int = 0
    retry_after: int = 0


@dataclass
class RateLimitRule:
    """Definition of a rate-limit window."""
    max_requests: int
    window_seconds: int
    key_prefix: str = "rl"

    @property
    def window_ms(self) -> int:
        return self.window_seconds * 1000


# ---------------------------------------------------------------------------
# Default rules
# ---------------------------------------------------------------------------

# Per token + IP: 5 requests per 60 seconds
TOKEN_IP_RULE = RateLimitRule(max_requests=5, window_seconds=60, key_prefix="rl:tok_ip")

# Global per IP: 20 requests per 60 seconds
GLOBAL_IP_RULE = RateLimitRule(max_requests=20, window_seconds=60, key_prefix="rl:ip")

# Failed-attempt tracking: 5 failures → 30-min block
FAIL_RULE = RateLimitRule(max_requests=5, window_seconds=600, key_prefix="rl:fail")
BLOCK_DURATION_SECONDS = 1800


# ---------------------------------------------------------------------------
# RateLimiter class
# ---------------------------------------------------------------------------

class RateLimiter:
    """Redis ZSET sliding-window rate limiter.

    Architecture
    ------------
    Each rate-limit bucket is a Redis Sorted Set where:
      - Member = unique request ID (UUID4)
      - Score  = timestamp in milliseconds

    On each check we atomically:
      1. ZREMRANGEBYSCORE — prune entries outside the window
      2. ZCARD            — count remaining entries
      3. ZADD + EXPIRE    — record the new request (if allowed)

    All three commands are pipelined into a single round-trip.
    """

    def __init__(self):
        self._pool: Optional[redis.ConnectionPool] = None
        self._client: Optional[redis.Redis] = None
        self._enabled: bool = False
        self._fail_open: bool = True  # allow requests if Redis is down

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def init(self, redis_url: str, fail_open: bool = True) -> None:
        """Initialize the Redis connection pool.

        Args:
            redis_url: Redis connection string, e.g. ``redis://localhost:6379/1``
            fail_open: If True, allow requests when Redis is unavailable.
        """
        try:
            self._pool = redis.ConnectionPool.from_url(
                redis_url,
                max_connections=20,
                decode_responses=False,
                socket_timeout=2,
                socket_connect_timeout=2,
                retry_on_timeout=True,
            )
            self._client = redis.Redis(connection_pool=self._pool)
            # Quick connectivity check
            self._client.ping()
            self._enabled = True
            self._fail_open = fail_open
            logger.info("Redis rate limiter initialized: %s", redis_url.split("@")[-1])
        except Exception as e:
            logger.warning("Redis rate limiter unavailable (%s) — falling back to permissive mode", e)
            self._enabled = False

    @property
    def is_available(self) -> bool:
        return self._enabled and self._client is not None

    # ------------------------------------------------------------------
    # Core sliding-window check
    # ------------------------------------------------------------------

    def _check_rule(self, key: str, rule: RateLimitRule) -> RateLimitResult:
        """Execute a single sliding-window check against one rule.

        Returns RateLimitResult with allowed=True if within limits.
        """
        if not self.is_available:
            if self._fail_open:
                return RateLimitResult(allowed=True, remaining=rule.max_requests)
            return RateLimitResult(allowed=False, message="rate limiter unavailable")

        now_ms = int(time.time() * 1000)
        window_start = now_ms - rule.window_ms
        request_id = str(uuid.uuid4()).encode()

        try:
            pipe = self._client.pipeline(transaction=True)  # type: ignore[union-attr]
            # 1. Remove expired entries
            pipe.zremrangebyscore(key, 0, window_start)
            # 2. Count current entries
            pipe.zcard(key)
            # 3. Add this request (we'll discard if over limit)
            pipe.zadd(key, {request_id: now_ms})
            # 4. Set TTL = window + buffer so keys auto-expire
            pipe.expire(key, rule.window_seconds + 10)
            results = pipe.execute()

            current_count = results[1]  # ZCARD result

            if current_count >= rule.max_requests:
                # Over limit — remove the entry we just added
                try:
                    self._client.zrem(key, request_id)  # type: ignore[union-attr]
                except Exception:
                    pass
                retry_after = rule.window_seconds
                return RateLimitResult(
                    allowed=False,
                    message=f"rate limit exceeded — try again in {retry_after}s",
                    remaining=0,
                    retry_after=retry_after,
                )

            remaining = max(0, rule.max_requests - current_count - 1)
            return RateLimitResult(allowed=True, remaining=remaining)

        except redis.ConnectionError:
            logger.warning("Redis connection lost during rate-limit check")
            self._enabled = False  # disable until re-init
            if self._fail_open:
                return RateLimitResult(allowed=True, remaining=rule.max_requests)
            return RateLimitResult(allowed=False, message="rate limiter unavailable")
        except Exception as e:
            logger.warning("Rate limiter error: %s", e, exc_info=True)
            if self._fail_open:
                return RateLimitResult(allowed=True, remaining=rule.max_requests)
            return RateLimitResult(allowed=False, message="rate limiter error")

    # ------------------------------------------------------------------
    # IP blocking (for abuse detection)
    # ------------------------------------------------------------------

    def is_ip_blocked(self, ip: str) -> bool:
        """Check if an IP is currently blocked."""
        if not self.is_available:
            return False
        try:
            key = f"rl:blocked:{ip}"
            return bool(self._client.exists(key))  # type: ignore[union-attr]
        except Exception:
            return False

    def block_ip(self, ip: str, duration: int = BLOCK_DURATION_SECONDS) -> None:
        """Block an IP for a given duration (seconds)."""
        if not self.is_available:
            return
        try:
            key = f"rl:blocked:{ip}"
            self._client.setex(key, duration, "1")  # type: ignore[union-attr]
            logger.warning("Blocked IP %s for %ds", ip, duration)
        except Exception:
            logger.warning("Failed to block IP %s", ip, exc_info=True)

    def record_failure(self, ip: str) -> bool:
        """Record a failed access attempt. Returns True if IP was blocked."""
        key = f"{FAIL_RULE.key_prefix}:{ip}"
        result = self._check_rule(key, FAIL_RULE)
        
        # If no remaining attempts, trigger block immediately
        if result.remaining == 0 or not result.allowed:
            self.block_ip(ip)
            return True
        return False

    # ------------------------------------------------------------------
    # Multi-layer check for magic-link access
    # ------------------------------------------------------------------

    def check_access(self, token_hash: str, ip: str) -> RateLimitResult:
        """Multi-layer rate-limit check for /access/:token.

        Layers:
        1. IP block list check
        2. Per-token+IP sliding window (5 req / 60s)
        3. Global IP sliding window (20 req / 60s)

        Both layer 2 and 3 must pass for the request to be allowed.
        """
        # Layer 1: Check IP block list
        if self.is_ip_blocked(ip):
            return RateLimitResult(
                allowed=False,
                message="IP temporarily blocked due to excessive failed attempts",
                retry_after=BLOCK_DURATION_SECONDS,
            )

        # Layer 2: Per token + IP
        token_ip_key = f"{TOKEN_IP_RULE.key_prefix}:{token_hash[:16]}:{ip}"
        token_result = self._check_rule(token_ip_key, TOKEN_IP_RULE)
        if not token_result.allowed:
            return token_result

        # Layer 3: Global IP
        ip_key = f"{GLOBAL_IP_RULE.key_prefix}:{ip}"
        ip_result = self._check_rule(ip_key, GLOBAL_IP_RULE)
        if not ip_result.allowed:
            return ip_result

        # Return the more restrictive remaining count
        return RateLimitResult(
            allowed=True,
            remaining=min(token_result.remaining, ip_result.remaining),
        )

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def reset(self, pattern: str = "rl:*") -> int:
        """Delete all rate-limit keys (for testing). Returns count deleted."""
        if not self.is_available:
            return 0
        try:
            keys = self._client.keys(pattern)  # type: ignore[union-attr]
            if keys:
                return self._client.delete(*keys)  # type: ignore[union-attr]
        except Exception as exc:
            logger.debug("Rate limiter reset failed: %s", exc)
        return 0


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

limiter = RateLimiter()
