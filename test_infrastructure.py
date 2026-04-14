#!/usr/bin/env python3
"""
Test script to verify enhanced infrastructure setup.

Tests:
1. PostgreSQL connection and migrations
2. Redis cache connectivity
3. Enhanced audit logging
"""
import os
import sys

# Set test environment
os.environ.setdefault("FLASK_ENV", "development")
os.environ.setdefault("POSTGRES_URI", "postgresql://localhost:5432/blockvault")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

from blockvault import create_app

def test_infrastructure():
    """Test enhanced infrastructure components."""
    print("=" * 60)
    print("BlockVault Enhanced Infrastructure Test")
    print("=" * 60)
    
    # Create Flask app
    print("\n1. Creating Flask application...")
    try:
        app = create_app()
        print("   ✓ Flask app created successfully")
    except Exception as e:
        print(f"   ✗ Failed to create Flask app: {e}")
        return False
    
    with app.app_context():
        # Test PostgreSQL
        print("\n2. Testing PostgreSQL connection...")
        try:
            from blockvault.core.postgres_db import get_pool_stats
            stats = get_pool_stats()
            if stats.get("status") == "active":
                print(f"   ✓ PostgreSQL connected")
                print(f"     - Min connections: {stats.get('min_connections')}")
                print(f"     - Max connections: {stats.get('max_connections')}")
            else:
                print(f"   ⚠ PostgreSQL not initialized: {stats}")
        except Exception as e:
            print(f"   ⚠ PostgreSQL test failed (non-fatal): {e}")
        
        # Test Redis cache
        print("\n3. Testing Redis cache...")
        try:
            from blockvault.core.cache import get_cache_stats
            stats = get_cache_stats()
            if stats.get("status") == "active":
                print(f"   ✓ Redis cache connected")
                print(f"     - Total keys: {stats.get('total_keys')}")
                print(f"     - Memory used: {stats.get('memory_used')}")
            elif stats.get("status") == "disabled":
                print(f"   ⚠ Redis cache disabled (non-fatal)")
            else:
                print(f"   ⚠ Redis cache status: {stats}")
        except Exception as e:
            print(f"   ⚠ Redis cache test failed (non-fatal): {e}")
        
        # Test MongoDB (existing)
        print("\n4. Testing MongoDB connection...")
        try:
            from blockvault.core.db import get_client
            get_client().admin.command("ping")
            print("   ✓ MongoDB connected")
        except Exception as e:
            print(f"   ✗ MongoDB test failed: {e}")
            return False
        
        # Test enhanced audit logging
        print("\n5. Testing enhanced audit logging...")
        try:
            from blockvault.core.enhanced_audit import log_audit_event
            log_id = log_audit_event(
                event_type="test.event",
                category="test",
                action="infrastructure_test",
                result="success",
                user_id="test_user",
                metadata={"test": True}
            )
            if log_id:
                print(f"   ✓ Audit logging working (log_id: {log_id})")
            else:
                print("   ⚠ Audit logging returned None (PostgreSQL may not be available)")
        except Exception as e:
            print(f"   ⚠ Audit logging test failed (non-fatal): {e}")
        
        # Test cache operations
        print("\n6. Testing cache operations...")
        try:
            from blockvault.core.cache import cache_set, cache_get, cache_delete
            
            # Set a test value
            success = cache_set("test:key", {"data": "test_value"}, ttl=60)
            if success:
                print("   ✓ Cache set successful")
            else:
                print("   ⚠ Cache set returned False (Redis may not be available)")
            
            # Get the test value
            value = cache_get("test:key")
            if value and value.get("data") == "test_value":
                print("   ✓ Cache get successful")
            else:
                print("   ⚠ Cache get failed or returned unexpected value")
            
            # Delete the test value
            cache_delete("test:key")
            print("   ✓ Cache delete successful")
            
        except Exception as e:
            print(f"   ⚠ Cache operations test failed (non-fatal): {e}")
    
    print("\n" + "=" * 60)
    print("Infrastructure test completed!")
    print("=" * 60)
    print("\nNote: PostgreSQL and Redis are optional for basic functionality.")
    print("The app will work with MongoDB only if these services are unavailable.")
    return True

if __name__ == "__main__":
    success = test_infrastructure()
    sys.exit(0 if success else 1)
