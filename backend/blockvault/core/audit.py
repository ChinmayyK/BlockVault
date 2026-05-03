"""Append-only, hash-chained audit event logging.

Every security-sensitive action is recorded in the ``audit_events``
MongoDB collection.  Records are **never** updated or deleted.

Each entry includes a ``prev_hash`` field that chains to the previous
entry's SHA-256 digest, creating a tamper-evident log.  If any record
is modified or deleted, the chain breaks and the tamper is detectable.

Usage::

    from blockvault.core.audit import log_event
    log_event("upload", target_id=file_id, details={"size": 1234})
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Any, Dict, Optional

from flask import request
from blockvault.core.merkle_tree import MerkleLog

logger = logging.getLogger(__name__)

# Module-level cache for the last hash in the chain
_last_hash: Optional[str] = None


def _audit_collection():
    from .db import get_db  # noqa: WPS433
    return get_db()["audit_events"]


def _compute_entry_hash(doc: Dict[str, Any]) -> str:
    """Deterministic SHA-256 of the audit entry for chain integrity."""
    canonical = json.dumps(
        {k: v for k, v in doc.items() if k != "_id"},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def _get_last_hash() -> str:
    """Retrieve the hash of the most recent audit entry, or genesis hash."""
    global _last_hash  # noqa: PLW0603
    if _last_hash is not None:
        return _last_hash
    try:
        coll = _audit_collection()
        last = coll.find_one(sort=[("timestamp", -1)])
        if last and "entry_hash" in last:
            _last_hash = last["entry_hash"]
            return _last_hash
    except Exception as exc:
        logger.debug("Failed to retrieve last audit hash: %s", exc)
    # Genesis — no prior entries
    _last_hash = hashlib.sha256(b"GENESIS").hexdigest()
    return _last_hash


def log_event(
    action: str,
    *,
    target_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Insert an immutable, hash-chained audit record.

    Parameters
    ----------
    action : one of login, upload, download, share, delete, verify,
             settings_update, failed_login
    target_id : ID of the affected resource (file, share, etc.)
    details : free-form dict with extra context (MUST NOT contain secrets)
    """
    global _last_hash  # noqa: PLW0603

    try:
        user_id = getattr(request, "address", None)
        ip_address = request.remote_addr
        request_id = getattr(request, "request_id", None)
    except RuntimeError:
        user_id = None
        ip_address = None
        request_id = None

    prev_hash = _get_last_hash()

    doc = {
        "action": action,
        "user_id": user_id,
        "target_id": target_id,
        "timestamp": int(time.time() * 1000),
        "ip_address": ip_address,
        "request_id": request_id,
        "prev_hash": prev_hash,
    }
    if details:
        doc["details"] = details

    # Compute this entry's hash (includes prev_hash for chaining)
    entry_hash = _compute_entry_hash(doc)
    doc["entry_hash"] = entry_hash

    try:
        # Append the deterministic event hash to the Merkle Tree log
        # to generate a verifiable leaf index for rapid O(log n) lookups.
        merkle_log = MerkleLog()
        leaf_index = merkle_log.append_leaf(entry_hash)
        doc["leaf_index"] = leaf_index
        
        _audit_collection().insert_one(doc)
        _last_hash = entry_hash
    except Exception:
        # Audit logging must never crash the request
        logger.warning("Failed to write audit event: %s", action, exc_info=True)


def verify_chain(limit: int = 1000) -> Dict[str, Any]:
    """Verify the integrity of the audit log chain.

    Returns a dict with ``valid`` (bool), ``checked`` (int), and
    ``broken_at`` (entry _id where chain broke, or None).
    """
    try:
        coll = _audit_collection()
        entries = list(coll.find().sort("timestamp", 1).limit(limit))
    except Exception as e:
        return {"valid": False, "checked": 0, "error": str(e)}

    if not entries:
        return {"valid": True, "checked": 0, "broken_at": None}

    expected_prev = hashlib.sha256(b"GENESIS").hexdigest()

    for i, entry in enumerate(entries):
        # Check chain link
        if entry.get("prev_hash") != expected_prev:
            return {
                "valid": False,
                "checked": i,
                "broken_at": str(entry.get("_id")),
            }
        # Verify entry hash
        stored_hash = entry.get("entry_hash")
        computed = _compute_entry_hash(
            {k: v for k, v in entry.items() if k not in ("_id", "entry_hash")}
        )
        # The entry_hash was computed from the doc WITHOUT entry_hash field
        # so we need to recompute from the original fields
        check_doc = {k: v for k, v in entry.items() if k not in ("_id", "entry_hash")}
        check_doc_hash = _compute_entry_hash(check_doc)
        if stored_hash != check_doc_hash:
            return {
                "valid": False,
                "checked": i,
                "broken_at": str(entry.get("_id")),
                "reason": "hash mismatch",
            }
        expected_prev = stored_hash

    return {"valid": True, "checked": len(entries), "broken_at": None}
