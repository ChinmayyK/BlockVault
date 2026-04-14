"""
PostgreSQL database connection and initialization for enhanced features.

This module provides PostgreSQL connectivity for new features that require
relational data structures, time-series analytics, and complex queries.
MongoDB remains the primary store for document metadata and blockchain data.
"""
from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Generator

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from flask import Flask, g

logger = logging.getLogger(__name__)

# Connection pool singleton
_connection_pool: pool.ThreadedConnectionPool | None = None


def init_postgres(app: Flask) -> None:
    """Initialize PostgreSQL connection pool.
    
    Creates a connection pool and verifies connectivity.
    Runs schema migrations if needed.
    """
    global _connection_pool
    
    postgres_uri = app.config.get(
        "POSTGRES_URI",
        os.getenv("POSTGRES_URI", "postgresql://localhost:5432/blockvault")
    )
    
    try:
        _connection_pool = pool.ThreadedConnectionPool(
            minconn=5,
            maxconn=20,
            dsn=postgres_uri
        )
        
        # Test connection
        conn = _connection_pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            logger.info("PostgreSQL connection established successfully.")
        finally:
            _connection_pool.putconn(conn)
        
        # Run migrations
        _run_migrations()
        
    except Exception as exc:
        logger.error(f"Failed to initialize PostgreSQL: {exc}")
        # Non-fatal - allow app to start with MongoDB only
        _connection_pool = None


def _run_migrations() -> None:
    """Run database schema migrations."""
    if not _connection_pool:
        return
    
    conn = _connection_pool.getconn()
    try:
        with conn.cursor() as cur:
            # Create migrations table if not exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            
            # Check current version
            cur.execute("SELECT MAX(version) FROM schema_migrations")
            result = cur.fetchone()
            current_version = result[0] if result[0] else 0
            
            # Apply migrations
            migrations = _get_migrations()
            for version, migration_sql in migrations.items():
                if version > current_version:
                    logger.info(f"Applying migration version {version}")
                    cur.execute(migration_sql)
                    cur.execute(
                        "INSERT INTO schema_migrations (version) VALUES (%s)",
                        (version,)
                    )
                    conn.commit()
                    
        logger.info("Database migrations completed successfully.")
    except Exception as exc:
        logger.error(f"Migration failed: {exc}")
        conn.rollback()
    finally:
        _connection_pool.putconn(conn)


def _get_migrations() -> dict[int, str]:
    """Return migration SQL statements keyed by version number."""
    return {
        1: """
            -- Enhanced audit logs with hash chain
            CREATE TABLE IF NOT EXISTS audit_logs (
                log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                event_type VARCHAR(100) NOT NULL,
                category VARCHAR(50) NOT NULL,
                user_id VARCHAR(255),
                resource_id VARCHAR(255),
                resource_type VARCHAR(50),
                action VARCHAR(100) NOT NULL,
                result VARCHAR(20) NOT NULL,
                context JSONB NOT NULL,
                metadata JSONB,
                previous_hash VARCHAR(64),
                current_hash VARCHAR(64) NOT NULL,
                blockchain_tx_id VARCHAR(255)
            );
            
            CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
            CREATE INDEX idx_audit_logs_user_time ON audit_logs(user_id, timestamp DESC);
            CREATE INDEX idx_audit_logs_category ON audit_logs(category, timestamp DESC);
            CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_id, timestamp DESC);
        """,
        
        2: """
            -- Search metadata cache
            CREATE TABLE IF NOT EXISTS search_metadata (
                document_id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                filename VARCHAR(500) NOT NULL,
                description TEXT,
                tags TEXT[],
                file_type VARCHAR(100),
                file_size BIGINT,
                upload_date TIMESTAMP,
                case_id VARCHAR(255),
                shared_with TEXT[],
                access_level VARCHAR(20),
                indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX idx_search_user ON search_metadata(user_id);
            CREATE INDEX idx_search_filename ON search_metadata(filename);
            CREATE INDEX idx_search_tags ON search_metadata USING GIN(tags);
            CREATE INDEX idx_search_upload_date ON search_metadata(upload_date DESC);
        """,
        
        3: """
            -- Recent searches
            CREATE TABLE IF NOT EXISTS recent_searches (
                search_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(255) NOT NULL,
                query TEXT NOT NULL,
                filters JSONB,
                searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX idx_recent_searches_user ON recent_searches(user_id, searched_at DESC);
        """,
        
        4: """
            -- Performance metrics cache
            CREATE TABLE IF NOT EXISTS cache_metrics (
                metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cache_key VARCHAR(255) NOT NULL,
                hit_count BIGINT DEFAULT 0,
                miss_count BIGINT DEFAULT 0,
                last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX idx_cache_metrics_key ON cache_metrics(cache_key);
        """
    }


@contextmanager
def get_postgres_connection() -> Generator:
    """Get a PostgreSQL connection from the pool.
    
    Usage:
        with get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM table")
    """
    if not _connection_pool:
        raise RuntimeError("PostgreSQL not initialized")
    
    conn = _connection_pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _connection_pool.putconn(conn)


def get_postgres_cursor():
    """Get a PostgreSQL cursor for the current request.
    
    Uses Flask's g object to maintain connection per request.
    """
    if not _connection_pool:
        raise RuntimeError("PostgreSQL not initialized")
    
    if 'postgres_conn' not in g:
        g.postgres_conn = _connection_pool.getconn()
    
    return g.postgres_conn.cursor(cursor_factory=RealDictCursor)


def close_postgres_connection(exception=None):
    """Close PostgreSQL connection at end of request."""
    conn = g.pop('postgres_conn', None)
    if conn is not None and _connection_pool:
        _connection_pool.putconn(conn)


def get_pool_stats() -> dict:
    """Get connection pool statistics."""
    if not _connection_pool:
        return {"status": "not_initialized"}
    
    return {
        "status": "active",
        "min_connections": _connection_pool.minconn,
        "max_connections": _connection_pool.maxconn,
    }
