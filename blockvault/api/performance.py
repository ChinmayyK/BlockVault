"""
Performance metrics and monitoring API endpoints.

Provides cache statistics, connection pool stats, and performance metrics.
"""
from flask import Blueprint, jsonify, current_app
from ..core.security import require_auth, Role

bp = Blueprint("performance", __name__, url_prefix="/api/performance")


def ensure_role(min_role: int) -> bool:
    """Ensure user has minimum role."""
    from ..core.permissions import _get_platform_role
    from flask import request, abort
    user_role = _get_platform_role(getattr(request, "address", ""))
    if user_role.value < min_role:
        abort(403, f"requires role {min_role} or higher")
    return True


@bp.get("/cache/stats")
@require_auth
def get_cache_stats():
    """Get cache performance statistics.
    
    Returns hit rate, total keys, memory usage, and hit/miss counts.
    Requires ADMIN role.
    """
    ensure_role(Role.ADMIN)
    
    from ..core.cache import get_cache_stats
    stats = get_cache_stats()
    
    return jsonify(stats)


@bp.get("/database/stats")
@require_auth
def get_database_stats():
    """Get database connection pool statistics.
    
    Returns stats for MongoDB, PostgreSQL, and Redis connections.
    Requires ADMIN role.
    """
    ensure_role(Role.ADMIN)
    
    stats = {}
    
    # MongoDB stats
    try:
        from ..core.db import get_client
        client = get_client()
        server_info = client.server_info()
        stats["mongodb"] = {
            "status": "connected",
            "version": server_info.get("version"),
            "max_pool_size": 100,
            "min_pool_size": 10,
        }
    except Exception as e:
        stats["mongodb"] = {
            "status": "error",
            "error": str(e)
        }
    
    # PostgreSQL stats
    try:
        from ..core.postgres_db import get_pool_stats
        stats["postgresql"] = get_pool_stats()
    except Exception as e:
        stats["postgresql"] = {
            "status": "error",
            "error": str(e)
        }
    
    # Redis stats
    try:
        from ..core.cache import get_cache
        redis_client = get_cache()
        if redis_client:
            info = redis_client.info()
            stats["redis"] = {
                "status": "connected",
                "version": info.get("redis_version"),
                "connected_clients": info.get("connected_clients"),
                "used_memory_human": info.get("used_memory_human"),
                "max_connections": 20,
            }
        else:
            stats["redis"] = {"status": "disabled"}
    except Exception as e:
        stats["redis"] = {
            "status": "error",
            "error": str(e)
        }
    
    return jsonify(stats)


@bp.get("/metrics")
@require_auth
def get_performance_metrics():
    """Get comprehensive performance metrics.
    
    Includes cache stats, database stats, and response time metrics.
    Requires ADMIN role.
    """
    ensure_role(Role.ADMIN)
    
    from ..core.cache import get_cache_stats
    from ..core.postgres_db import get_pool_stats
    
    metrics = {
        "cache": get_cache_stats(),
        "database": {
            "postgresql": get_pool_stats(),
            "mongodb": {
                "status": "active",
                "max_pool_size": 100,
                "min_pool_size": 10,
            }
        },
        "compression": {
            "enabled": True,
            "threshold_bytes": 1024,
            "compression_level": 6,
        },
        "ipfs_cache": {
            "enabled": True,
            "ttl_seconds": int(current_app.config.get("IPFS_CACHE_TTL", 86400)),
        }
    }
    
    return jsonify(metrics)
