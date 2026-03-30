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
    
    # Seed default compliance profiles (idempotent)
    _seed_default_data(_database)


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
            [("target_id", 1), ("timestamp", -1)],
            name="idx_audit_target_time",
            background=True,
        )
        db["audit_events"].create_index(
            [("user_id", 1), ("timestamp", -1)],
            name="idx_audit_user_time",
            background=True,
        )
        db["users"].create_index("address", name="idx_users_address", unique=True, background=True)
        db["anchored_hashes"].create_index("sha256", name="idx_anchored_sha256", unique=True, background=True)
        db["audit_anchors"].create_index([("timestamp", -1)], name="idx_audit_anchors_ts", background=True)

        # --- New: Organization & Workspace indexes ---
        db["org_members"].create_index(
            [("org_id", 1), ("wallet_address", 1)],
            unique=True, background=True, name="idx_org_members_unique",
        )
        db["org_members"].create_index(
            "wallet_address", background=True, name="idx_org_members_wallet",
        )
        db["workspaces"].create_index("owner_wallet", background=True, name="idx_ws_owner")
        db["workspaces"].create_index("org_id", background=True, name="idx_ws_org")
        db["workspace_members"].create_index(
            [("workspace_id", 1), ("wallet_address", 1)],
            unique=True, background=True, name="idx_ws_members_unique",
        )
        db["workspace_members"].create_index(
            "wallet_address", background=True, name="idx_ws_members_wallet",
        )
        db["file_permissions"].create_index(
            [("file_id", 1), ("wallet_address", 1)],
            unique=True, background=True, name="idx_file_perms_unique",
        )

        logger.info("MongoDB indexes ensured.")
    except Exception as exc:
        logger.warning("Failed to create indexes (non-fatal): %s", exc)


def _seed_default_data(db: Database) -> None:
    """Seed default data and run migrations."""
    try:
        from blockvault.core.compliance_profiles import seed_compliance_profiles
        seed_compliance_profiles(db)
    except Exception as exc:
        logger.warning("Failed to seed default data (non-fatal): %s", exc)

    # Migrate: set platform_role = "USER" on existing users without one
    try:
        result = db["users"].update_many(
            {"platform_role": {"$exists": False}},
            {"$set": {"platform_role": "USER"}},
        )
        if result.modified_count > 0:
            logger.info("Migrated %d users to platform_role=USER", result.modified_count)
    except Exception as exc:
        logger.warning("User role migration failed (non-fatal): %s", exc)


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
