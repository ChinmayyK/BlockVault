"""
Redis-based caching layer for performance optimization.

Provides distributed caching with intelligent invalidation,
cache warming, and metrics tracking.
"""
from __future__ import annotations

import hashlib
import json
import logging
from functools import wraps
from typing import Any, Callable

import redis
from flask import Flask

logger = logging.getLogger(__name__)

# Redis client singleton
_redis_client: redis.Redis | None = None

# Cache key patterns
CACHE_KEYS = {
    "DOCUMENT_METADATA": "doc:meta:{document_id}",
    "DOCUMENT_LIST": "doc:list:{user_id}:{page}",
    "USER_PROFILE": "user:{user_id}",
    "SEARCH_RESULTS": "search:{query_hash}",
    "ANALYTICS_DASHBOARD": "analytics:dashboard:{user_id}",
    "IPFS_CONTENT": "ipfs:{hash}",
}

# Cache invalidation rules
INVALIDATION_RULES = {
    "document.updated": ["doc:meta:{document_id}", "doc:list:*"],
    "document.deleted": ["doc:meta:{document_id}", "doc:list:*", "search:*"],
    "document.shared": ["doc:list:{recipient_id}:*"],
    "user.updated": ["user:{user_id}"],
    "analytics.event": ["analytics:dashboard:*"],
}


def init_cache(app: Flask) -> None:
    """Initialize Redis connection."""
    global _redis_client
    
    redis_url = app.config.get("REDIS_URL", "redis://localhost:6379/0")
    
    try:
        _redis_client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            max_connections=20
        )
        
        # Test connection
        _redis_client.ping()
        logger.info("Redis connection established successfully.")
        
    except Exception as exc:
        logger.warning(f"Redis connection failed: {exc}. Caching disabled.")
        _redis_client = None


def get_cache() -> redis.Redis | None:
    """Get Redis client instance."""
    return _redis_client


def cache_get(key: str) -> Any | None:
    """Get value from cache.
    
    Args:
        key: Cache key
        
    Returns:
        Cached value or None if not found/expired
    """
    if not _redis_client:
        return None
    
    try:
        value = _redis_client.get(key)
        if value:
            # Track cache hit
            _track_cache_metric(key, hit=True)
            return json.loads(value)
        else:
            # Track cache miss
            _track_cache_metric(key, hit=False)
            return None
    except Exception as exc:
        logger.warning(f"Cache get failed for key {key}: {exc}")
        return None


def cache_set(key: str, value: Any, ttl: int = 3600) -> bool:
    """Set value in cache with TTL.
    
    Args:
        key: Cache key
        value: Value to cache (must be JSON serializable)
        ttl: Time to live in seconds (default 1 hour)
        
    Returns:
        True if successful, False otherwise
    """
    if not _redis_client:
        return False
    
    try:
        serialized = json.dumps(value)
        _redis_client.setex(key, ttl, serialized)
        return True
    except Exception as exc:
        logger.warning(f"Cache set failed for key {key}: {exc}")
        return False


def cache_delete(key: str) -> bool:
    """Delete key from cache.
    
    Args:
        key: Cache key or pattern (supports wildcards)
        
    Returns:
        True if successful
    """
    if not _redis_client:
        return False
    
    try:
        if "*" in key:
            # Pattern-based deletion
            keys = _redis_client.keys(key)
            if keys:
                _redis_client.delete(*keys)
        else:
            _redis_client.delete(key)
        return True
    except Exception as exc:
        logger.warning(f"Cache delete failed for key {key}: {exc}")
        return False


def cache_invalidate(event_type: str, **kwargs) -> None:
    """Invalidate cache based on event type.
    
    Args:
        event_type: Type of event (e.g., 'document.updated')
        **kwargs: Event parameters for key substitution
    """
    if not _redis_client or event_type not in INVALIDATION_RULES:
        return
    
    patterns = INVALIDATION_RULES[event_type]
    for pattern in patterns:
        # Substitute parameters in pattern
        key = pattern.format(**kwargs)
        cache_delete(key)
        logger.debug(f"Invalidated cache key: {key}")


def cached(ttl: int = 3600, key_prefix: str = ""):
    """Decorator to cache function results.
    
    Args:
        ttl: Time to live in seconds
        key_prefix: Prefix for cache key
        
    Usage:
        @cached(ttl=300, key_prefix="user_profile")
        def get_user_profile(user_id):
            return expensive_operation(user_id)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not _redis_client:
                return func(*args, **kwargs)
            
            # Generate cache key from function name and arguments
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)
            
            # Try to get from cache
            cached_value = cache_get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            cache_set(cache_key, result, ttl)
            return result
        
        return wrapper
    return decorator


def _track_cache_metric(key: str, hit: bool) -> None:
    """Track cache hit/miss metrics.
    
    Args:
        key: Cache key
        hit: True for cache hit, False for miss
    """
    if not _redis_client:
        return
    
    try:
        metric_key = f"metrics:cache:{key}"
        if hit:
            _redis_client.hincrby(metric_key, "hits", 1)
        else:
            _redis_client.hincrby(metric_key, "misses", 1)
        _redis_client.expire(metric_key, 86400)  # 24 hours
    except Exception:
        pass  # Non-critical


def get_cache_stats() -> dict:
    """Get cache statistics.
    
    Returns:
        Dictionary with cache metrics
    """
    if not _redis_client:
        return {"status": "disabled"}
    
    try:
        info = _redis_client.info("stats")
        
        # Calculate hit rate from metrics
        total_hits = 0
        total_misses = 0
        
        for key in _redis_client.keys("metrics:cache:*"):
            metrics = _redis_client.hgetall(key)
            total_hits += int(metrics.get("hits", 0))
            total_misses += int(metrics.get("misses", 0))
        
        total_requests = total_hits + total_misses
        hit_rate = (total_hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "status": "active",
            "total_keys": _redis_client.dbsize(),
            "hits": total_hits,
            "misses": total_misses,
            "hit_rate": round(hit_rate, 2),
            "memory_used": info.get("used_memory_human", "unknown"),
        }
    except Exception as exc:
        logger.error(f"Failed to get cache stats: {exc}")
        return {"status": "error", "error": str(exc)}


def warm_cache(keys_and_values: dict[str, tuple[Any, int]]) -> None:
    """Warm cache with predefined values.
    
    Args:
        keys_and_values: Dict mapping cache keys to (value, ttl) tuples
    """
    if not _redis_client:
        return
    
    for key, (value, ttl) in keys_and_values.items():
        cache_set(key, value, ttl)
    
    logger.info(f"Warmed cache with {len(keys_and_values)} keys")


def hash_query(query: str, filters: dict = None) -> str:
    """Generate hash for search query caching.
    
    Args:
        query: Search query string
        filters: Optional filters dict
        
    Returns:
        SHA256 hash of query and filters
    """
    content = query
    if filters:
        content += json.dumps(filters, sort_keys=True)
    return hashlib.sha256(content.encode()).hexdigest()[:16]
