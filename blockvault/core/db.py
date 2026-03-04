"""
Global MongoDB client singleton with connection pooling.

The client is created once during app startup via ``init_db(app)``.
If the database is unreachable at startup the process exits immediately
(fail-fast) so infrastructure failures are never silently masked.
"""
from __future__ import annotations

import logging
import sys

from flask import Flask
from pymongo import MongoClient
from pymongo.database import Database

logger = logging.getLogger(__name__)

DB_NAME = "blockvault"

# Module-level singleton – populated by ``init_db``.
_client: MongoClient | None = None
_database: Database | None = None


def init_db(app: Flask) -> None:
    """Initialise the global MongoClient singleton.

    Must be called exactly once, during ``create_app``.  If the MongoDB
    server cannot be reached the process is terminated so that orchestration
    tooling (Railway, Docker, systemd) can handle the restart.
    """
    global _client, _database  # noqa: PLW0603

    uri: str = app.config["MONGO_URI"]

    _client = MongoClient(
        uri,
        maxPoolSize=100,
        minPoolSize=10,
        serverSelectionTimeoutMS=5000,
    )

    # Fail-fast: verify connectivity before accepting traffic.
    try:
        _client.admin.command("ping")
        logger.info("MongoDB connection established successfully.")
    except Exception as exc:
        logger.critical("MongoDB is unreachable at startup: %s", exc)
        sys.exit(1)

    # Prefer the database encoded in the URI; fall back to the default name.
    default_db = _client.get_default_database(default=DB_NAME)
    _database = default_db

    # Create indexes (idempotent — safe to run every startup)
    _ensure_indexes(_database)


def _ensure_indexes(db: Database) -> None:
    """Create compound and single-field indexes for query performance."""
    try:
        db["files"].create_index(
            [("owner", 1), ("created_at", -1)],
            name="idx_files_owner_created",
            background=True,
        )
        db["files"].create_index("sha256", name="idx_files_sha256", background=True)
        db["shares"].create_index("recipient", name="idx_shares_recipient", background=True)
        db["shares"].create_index("file_id", name="idx_shares_file_id", background=True)
        db["audit_events"].create_index(
            [("timestamp", -1)],
            name="idx_audit_timestamp",
            background=True,
        )
        db["audit_events"].create_index(
            [("user_id", 1), ("timestamp", -1)],
            name="idx_audit_user_time",
            background=True,
        )
        db["users"].create_index("address", name="idx_users_address", unique=True, background=True)
        logger.info("MongoDB indexes ensured.")
    except Exception as exc:
        logger.warning("Failed to create indexes (non-fatal): %s", exc)

def get_db() -> Database:
    """Return the shared database handle.

    All request handlers use this instead of creating their own clients.
    """
    if _database is None:
        raise RuntimeError(
            "Database not initialised. Ensure init_db() is called during app startup."
        )
    return _database


def get_client() -> MongoClient:
    """Return the raw MongoClient (used by the ``/health`` endpoint)."""
    if _client is None:
        raise RuntimeError(
            "MongoClient not initialised. Ensure init_db() is called during app startup."
        )
    return _client
