"""Document versioning data store.

Tracks version chains for files, enabling version history, comparison,
and rollback for legal audit trails.
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from .db import get_db

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Collection
# ---------------------------------------------------------------------------

def _versions_collection():
    return get_db()["file_versions"]


def _ensure_indexes() -> None:
    """Create MongoDB indexes (idempotent)."""
    try:
        coll = _versions_collection()
        coll.create_index("version_chain_id")
        coll.create_index("file_id")
        coll.create_index([("version_chain_id", 1), ("version_number", -1)])
    except Exception as exc:
        logger.debug("Version index creation skipped: %s", exc)


_indexes_ensured = False


def _lazy_ensure_indexes():
    global _indexes_ensured
    if not _indexes_ensured:
        _ensure_indexes()
        _indexes_ensured = True


# ---------------------------------------------------------------------------
# Version operations
# ---------------------------------------------------------------------------

def create_version_chain(file_id: str, owner: str) -> str:
    """Initialize a new version chain for a file. Returns chain ID."""
    _lazy_ensure_indexes()
    chain_id = str(uuid.uuid4())
    now_ms = int(time.time() * 1000)
    doc = {
        "_id": str(uuid.uuid4()),
        "version_chain_id": chain_id,
        "version_number": 1,
        "file_id": file_id,
        "parent_file_id": None,
        "change_summary": "Initial version",
        "created_by": owner,
        "created_at": now_ms,
    }
    _versions_collection().insert_one(doc)

    # Tag the file record with version info
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        try:
            oid = ObjectId(file_id)
        except (InvalidId, TypeError):
            oid = file_id
        get_db()["files"].update_one(
            {"_id": oid},
            {"$set": {"version": 1, "version_chain_id": chain_id}},
        )
    except Exception as exc:
        logger.debug("Failed to tag file with version info: %s", exc)

    logger.info("Created version chain %s for file %s", chain_id, file_id)
    return chain_id


def add_version(
    chain_id: str,
    new_file_id: str,
    parent_file_id: str,
    owner: str,
    change_summary: str = "",
) -> Dict[str, Any]:
    """Add a new version to an existing chain. Returns the version record."""
    _lazy_ensure_indexes()
    # Determine next version number
    latest = _versions_collection().find_one(
        {"version_chain_id": chain_id},
        sort=[("version_number", -1)],
    )
    next_version = (latest["version_number"] + 1) if latest else 1
    now_ms = int(time.time() * 1000)

    doc = {
        "_id": str(uuid.uuid4()),
        "version_chain_id": chain_id,
        "version_number": next_version,
        "file_id": new_file_id,
        "parent_file_id": parent_file_id,
        "change_summary": change_summary or f"Version {next_version}",
        "created_by": owner,
        "created_at": now_ms,
    }
    _versions_collection().insert_one(doc)

    # Tag the new file record
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        try:
            oid = ObjectId(new_file_id)
        except (InvalidId, TypeError):
            oid = new_file_id
        get_db()["files"].update_one(
            {"_id": oid},
            {"$set": {"version": next_version, "version_chain_id": chain_id}},
        )
    except Exception as exc:
        logger.debug("Failed to tag new version file: %s", exc)

    logger.info("Added version %d to chain %s (file %s)", next_version, chain_id, new_file_id)
    return _serialize_version(doc)


def list_versions(chain_id: str) -> List[Dict[str, Any]]:
    """List all versions in a chain, newest first."""
    _lazy_ensure_indexes()
    docs = list(
        _versions_collection()
        .find({"version_chain_id": chain_id})
        .sort("version_number", -1)
    )
    return [_serialize_version(d) for d in docs]


def get_version(chain_id: str, version_number: int) -> Optional[Dict[str, Any]]:
    """Get a specific version by chain and number."""
    _lazy_ensure_indexes()
    doc = _versions_collection().find_one({
        "version_chain_id": chain_id,
        "version_number": version_number,
    })
    if doc:
        return _serialize_version(doc)
    return None


def get_file_version_chain(file_id: str) -> Optional[str]:
    """Get the version chain ID for a file, if it has one."""
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        try:
            oid = ObjectId(file_id)
        except (InvalidId, TypeError):
            oid = file_id
        rec = get_db()["files"].find_one({"_id": oid}, {"version_chain_id": 1})
        if rec:
            return rec.get("version_chain_id")
    except Exception as exc:
        logger.debug("Failed to lookup version chain for %s: %s", file_id, exc)
    return None


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def _serialize_version(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a version document to JSON-safe response."""
    return {
        "id": str(doc["_id"]),
        "versionChainId": doc.get("version_chain_id", ""),
        "versionNumber": doc.get("version_number", 1),
        "fileId": doc.get("file_id", ""),
        "parentFileId": doc.get("parent_file_id"),
        "changeSummary": doc.get("change_summary", ""),
        "createdBy": doc.get("created_by", ""),
        "createdAt": doc.get("created_at"),
    }
