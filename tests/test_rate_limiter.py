"""
Unit tests for the Redis ZSET-based sliding-window rate limiter.
Requires a test Redis instance running on localhost:6379/1
"""
import time
import pytest

from blockvault.core.rate_limiter import (
    RateLimiter,
    RateLimitRule,
    TOKEN_IP_RULE,
    GLOBAL_IP_RULE,
)


@pytest.fixture
def limiter():
    """Provides a fresh RateLimiter connected to the test Redis DB."""
    limiter = RateLimiter()
    limiter.init("redis://localhost:6379/1", fail_open=False)
    limiter.reset()
    limiter.reset("test_*")
    yield limiter
    limiter.reset()
    limiter.reset("test_*")


def test_rate_limiter_unavailable_mode():
    """Limiter fails open when Redis is unconfigured or unavailable."""
    limiter = RateLimiter()
    limiter.init("redis://localhost:9999/9", fail_open=True)  # Bad port

    assert not limiter.is_available
    # Should fail open and allow access
    res = limiter.check_access("tok1", "1.1.1.1")
    assert res.allowed is True


def test_custom_rule_limits_requests(limiter):
    """ZSET correctly counts requests within the window and blocks excess."""
    rule = RateLimitRule(max_requests=2, window_seconds=60, key_prefix="test_rule")
    key = "test_rule:mykey"

    # Req 1
    res = limiter._check_rule(key, rule)
    assert res.allowed is True
    assert res.remaining == 1

    # Req 2
    res = limiter._check_rule(key, rule)
    assert res.allowed is True
    assert res.remaining == 0

    # Req 3 (blocked)
    res = limiter._check_rule(key, rule)
    assert res.allowed is False
    assert res.remaining == 0
    assert "rate limit exceeded" in res.message


def test_sliding_window_pruning(limiter):
    """Expired requests are removed from the window."""
    rule = RateLimitRule(max_requests=2, window_seconds=1, key_prefix="test_prune")
    key = "test_prune:mykey"

    # Exhaust limit
    limiter._check_rule(key, rule)
    limiter._check_rule(key, rule)
    assert limiter._check_rule(key, rule).allowed is False

    # Wait for window to pass
    time.sleep(1.1)

    # Should be allowed again
    res = limiter._check_rule(key, rule)
    assert res.allowed is True
    assert res.remaining == 1


def test_multi_layer_protection(limiter):
    """check_access enforces BOTH token-IP and global-IP limits."""
    ip = "10.0.0.1"
    
    # 1. Exhaust the global IP limit (20 reqs defined in GLOBAL_IP_RULE)
    for i in range(20):
        # use different tokens so we only hit the global IP limit
        res = limiter.check_access(f"tok{i}", ip)
        assert res.allowed is True
    
    # The 21st request from this IP should be blocked globally, even with a fresh token
    res = limiter.check_access("tok_fresh", ip)
    assert res.allowed is False
    assert "rate limit exceeded" in res.message


def test_ip_blocking(limiter):
    """Recording enough failures triggers an IP block."""
    ip = "192.168.1.1"

    # IP is not blocked at start
    assert limiter.is_ip_blocked(ip) is False

    # Simulate 4 failures
    for _ in range(4):
        blocked = limiter.record_failure(ip)
        assert blocked is False

    # 5th failure triggers block
    blocked = limiter.record_failure(ip)
    assert blocked is True
    assert limiter.is_ip_blocked(ip) is True

    # check_access immediately rejects blocked IPs
    res = limiter.check_access("some_token", ip)
    assert res.allowed is False
    assert "IP temporarily blocked" in res.message
