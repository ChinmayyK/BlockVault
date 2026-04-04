"""
Magic-link access blueprint for BlockVault.

Provides a public (unauthenticated) endpoint for recipients to retrieve
encrypted file metadata and the HKDF-wrapped file key via a one-time or
limited-use token.  Decryption happens entirely on the client.

Security features:
- In-memory sliding-window rate limiting (per-IP and per-token)
- Failed attempt tracking with automatic IP blocking
- Access count enforcement (one-time and limited-use tokens)
- Detailed per-access audit logging
- Structured error responses for expired/revoked/consumed tokens
- Presigned URL hardening (90-second expiry)
- File integrity verification before serving
- Owner-authenticated share management endpoints
"""
from __future__ import annotations

import hashlib
import time
import logging
import json
from datetime import datetime, timezone
from typing import Dict, Any

from flask import Blueprint, request, abort, jsonify, current_app

from ..core.db import get_db
from ..core.audit import log_event
from ..core.security import require_auth
from ..core.rate_limiter import limiter as redis_limiter
from ..core import s3 as s3_mod
from ..core import ipfs as ipfs_mod

logger = logging.getLogger(__name__)

bp = Blueprint("access", __name__)


# ---------------------------------------------------------------------------
# Rate limiting — delegates to Redis ZSET sliding-window limiter
# ---------------------------------------------------------------------------

def _get_client_ip() -> str:
    """Extract client IP, preferring X-Forwarded-For."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _record_failed_attempt(client_ip: str, token_hash: str) -> None:
    """Track a failed access attempt. Block IP after threshold via Redis."""
    now_ms = int(time.time() * 1000)

    # Store in DB for audit trail
    try:
        get_db()["magic_share_attempts"].insert_one({
            "client_ip": client_ip,
            "token_hash_prefix": token_hash[:12],
            "timestamp": now_ms,
            "user_agent": request.headers.get("User-Agent", ""),
        })
    except Exception:
        logger.warning("Failed to record access attempt", exc_info=True)

    # Record failure in Redis — auto-blocks IP after threshold
    blocked = redis_limiter.record_failure(client_ip)
    if blocked:
        log_event(
            "magic_link_blocked",
            details={"client_ip": client_ip, "reason": "excessive_failures"},
        )
        logger.warning("Blocked IP %s due to excessive magic-link failures", client_ip)


# ---------------------------------------------------------------------------
# Collections & helpers
# ---------------------------------------------------------------------------

def _magic_shares_collection():
    return get_db()["magic_shares"]


def _hash_token(token: str) -> str:
    """SHA-256 hash of an access token (hex digest)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _ensure_indexes() -> None:
    """Create MongoDB indexes for efficient lookups (idempotent)."""
    try:
        coll = _magic_shares_collection()
        coll.create_index("access_token_hash", unique=True)
        coll.create_index("file_id")
        coll.create_index("expires_at")
        coll.create_index("owner")
    except Exception:
        logger.debug("Index creation skipped (may already exist)", exc_info=True)


# Lazily ensure indexes on first request
_indexes_ensured = False


def _lazy_ensure_indexes():
    global _indexes_ensured
    if not _indexes_ensured:
        _ensure_indexes()
        _indexes_ensured = True


def _log_access_event(
    token_hash: str,
    file_id: str,
    share: Dict[str, Any],
    client_ip: str,
    success: bool,
) -> None:
    """Store detailed per-access record in dedicated collection."""
    try:
        get_db()["magic_link_access_log"].insert_one({
            "token_hash_prefix": token_hash[:12],
            "file_id": str(file_id),
            "accessed_at": int(time.time() * 1000),
            "client_ip": client_ip,
            "user_agent": request.headers.get("User-Agent", ""),
            "access_number": (share.get("access_count", 0) + 1) if success else None,
            "success": success,
            "recipient_email": share.get("recipient_email"),
        })
    except Exception:
        logger.warning("Failed to write access log", exc_info=True)


# ---------------------------------------------------------------------------
# Public access endpoint
# ---------------------------------------------------------------------------

@bp.get("/<token>", strict_slashes=False)
def access_file(token: str):
    """Public endpoint: validate a magic-link token and return encrypted metadata.

    Security checks (in order):
    1. Rate limiting (per-IP, per-token)
    2. Token lookup by SHA-256 hash
    3. Expiry validation
    4. Access count enforcement
    5. Revocation check
    6. File existence & integrity
    7. Detailed audit logging
    """
    _lazy_ensure_indexes()

    if not token or len(token) < 16:
        abort(400, "invalid access token")

    client_ip = _get_client_ip()
    token_hash = _hash_token(token)

    # 1. Rate limiting
    rate_result = redis_limiter.check_access(token_hash, client_ip)
    if not rate_result.allowed:
        return jsonify({"error": "rate_limited", "message": rate_result.message}), 429

    # 2. Token lookup
    coll = _magic_shares_collection()
    share = coll.find_one({"access_token_hash": token_hash})

    if not share:
        _record_failed_attempt(client_ip, token_hash)
        return jsonify({
            "error": "not_found",
            "message": "Link not found or expired",
        }), 404

    now_ms = int(time.time() * 1000)

    # 3. Expiry validation
    expires_at = share.get("expires_at")
    if expires_at and now_ms > int(expires_at):
        _log_access_event(token_hash, str(share.get("file_id")), share, client_ip, False)
        return jsonify({
            "error": "link_expired",
            "message": "This link has expired",
            "expired_at": expires_at,
        }), 403

    # 4. Access count enforcement
    access_count = share.get("access_count", 0)
    max_access = share.get("max_access_count")

    # Backward compat: is_one_time=True with no max_access_count → treat as max 1
    if max_access is None and share.get("is_one_time", True):
        max_access = 1

    if max_access is not None and access_count >= max_access:
        _log_access_event(token_hash, str(share.get("file_id")), share, client_ip, False)
        return jsonify({
            "error": "access_limit_reached",
            "message": "This link has reached its maximum number of uses",
            "access_count": access_count,
            "max_access_count": max_access,
        }), 403

    # Legacy consumed flag check (backward compat for old records)
    if share.get("consumed") and max_access is None:
        _log_access_event(token_hash, str(share.get("file_id")), share, client_ip, False)
        return jsonify({
            "error": "already_used",
            "message": "This link has already been used",
        }), 403

    # 5. Revocation check
    if share.get("revoked"):
        _log_access_event(token_hash, str(share.get("file_id")), share, client_ip, False)
        return jsonify({
            "error": "revoked",
            "message": "This link has been revoked by the file owner",
        }), 403

    # 6. File lookup & integrity
    file_id = share.get("file_id")
    files_coll = get_db()["files"]

    file_rec = None
    candidates: list = []
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        candidates.append(ObjectId(file_id))
    except (InvalidId, TypeError):
        pass  # file_id is not a valid ObjectId format — use string fallback
    candidates.append(file_id)

    for candidate in candidates:
        file_rec = files_coll.find_one({"_id": candidate})
        if file_rec:
            break

    if not file_rec:
        return jsonify({
            "error": "file_deleted",
            "message": "The shared file no longer exists",
        }), 404

    enc_filename = file_rec.get("enc_filename")

    # Integrity: verify blob exists in S3 before serving
    if enc_filename and not s3_mod.blob_exists(enc_filename):
        logger.error("Integrity check failed: blob %s missing from S3 for file %s",
                      enc_filename, file_id)
        return jsonify({
            "error": "integrity_error",
            "message": "Encrypted file is unavailable — contact the file owner",
        }), 404

    # Generate presigned URL with short expiry (90 seconds)
    presigned_url = None
    if enc_filename:
        presigned_url = s3_mod.generate_presigned_url(enc_filename, expires=90)

    download_deadline = datetime.fromtimestamp(
        time.time() + 90, tz=timezone.utc
    ).isoformat()

    # 7. Update access count
    update_ops: Dict[str, Any] = {
        "$inc": {"access_count": 1},
        "$set": {"last_accessed_at": now_ms},
    }
    # Also set consumed=True for backward compat if at max
    if max_access is not None and (access_count + 1) >= max_access:
        update_ops["$set"]["consumed"] = True
        update_ops["$set"]["consumed_at"] = now_ms

    coll.update_one({"_id": share["_id"]}, update_ops)

    # 8. Audit logging
    _log_access_event(token_hash, str(file_id), share, client_ip, True)

    log_event(
        "magic_link_access",
        target_id=str(file_id),
        details={
            "recipient_email": share.get("recipient_email"),
            "client_ip": client_ip,
            "user_agent": request.headers.get("User-Agent", ""),
            "access_number": access_count + 1,
            "max_access_count": max_access,
            "is_one_time": share.get("is_one_time", True),
        },
    )

    # 9. Build response
    # Note: enc_filename is intentionally NOT exposed — download is only via presigned URL
    response = jsonify({
        "file_id": str(file_id),
        "file_name": share.get("file_name") or file_rec.get("original_name"),
        "file_size": share.get("file_size") or file_rec.get("size"),
        "permission": share.get("permission", "viewer"),
        "recipient_encrypted_file_key": share.get("recipient_encrypted_file_key"),
        "presigned_url": presigned_url,
        "is_v2": bool(file_rec.get("wrapped_keys")),
        "redaction_status": file_rec.get("redaction_status"),
        "aad": file_rec.get("aad") or "",
        "sha256": file_rec.get("sha256"),
        "access_count": access_count + 1,
        "max_access_count": max_access,
    })
    response.headers["X-Download-Deadline"] = download_deadline
    return response


# ---------------------------------------------------------------------------
# Revocation (public — requires token)
# ---------------------------------------------------------------------------

@bp.delete("/<token>/revoke", strict_slashes=False)
def revoke_magic_link(token: str):
    """Revoke a magic link (requires the original token)."""
    token_hash = _hash_token(token)
    coll = _magic_shares_collection()
    result = coll.update_one(
        {"access_token_hash": token_hash, "revoked": {"$ne": True}},
        {"$set": {"revoked": True, "revoked_at": int(time.time() * 1000)}},
    )
    if result.modified_count == 0:
        abort(404, "link not found or already revoked")

    log_event("magic_link_revoked", details={"token_hash_prefix": token_hash[:12]})
    return jsonify({"status": "revoked"})


# ---------------------------------------------------------------------------
# Owner-authenticated share management
# ---------------------------------------------------------------------------

@bp.get("/file/<file_id>/shares", strict_slashes=False)
@require_auth
def list_magic_shares(file_id: str):
    """List active magic shares for a file (owner only)."""
    owner = getattr(request, "address", "").lower()
    coll = _magic_shares_collection()

    shares = list(coll.find(
        {"file_id": file_id, "owner": owner, "revoked": {"$ne": True}},
        {"access_token_hash": 0, "recipient_encrypted_file_key": 0},  # exclude secrets
    ))

    result = []
    for s in shares:
        result.append({
            "id": str(s.get("_id")),
            "recipient_email": s.get("recipient_email"),
            "permission": s.get("permission", "viewer"),
            "access_count": s.get("access_count", 0),
            "max_access_count": s.get("max_access_count"),
            "created_at": s.get("created_at"),
            "expires_at": s.get("expires_at"),
            "consumed": s.get("consumed", False),
        })

    return jsonify({"shares": result, "count": len(result)})


@bp.delete("/file/<file_id>/shares", strict_slashes=False)
@require_auth
def revoke_all_magic_shares(file_id: str):
    """Revoke all magic shares for a file (owner only)."""
    owner = getattr(request, "address", "").lower()
    coll = _magic_shares_collection()
    now_ms = int(time.time() * 1000)

    result = coll.update_many(
        {"file_id": file_id, "owner": owner, "revoked": {"$ne": True}},
        {"$set": {"revoked": True, "revoked_at": now_ms}},
    )

    log_event("magic_link_bulk_revoke", target_id=file_id, details={
        "revoked_count": result.modified_count,
    })

    return jsonify({
        "status": "revoked",
        "count": result.modified_count,
    })


@bp.delete("/file/<file_id>/shares/<share_id>", strict_slashes=False)
@require_auth
def revoke_single_magic_share(file_id: str, share_id: str):
    """Revoke a single magic share by ID (owner only)."""
    owner = getattr(request, "address", "").lower()
    coll = _magic_shares_collection()
    now_ms = int(time.time() * 1000)

    # Try both ObjectId and string
    candidates = []
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        candidates.append(ObjectId(share_id))
    except (InvalidId, TypeError):
        pass  # share_id is not a valid ObjectId format — use string fallback
    candidates.append(share_id)

    for candidate in candidates:
        result = coll.update_one(
            {"_id": candidate, "file_id": file_id, "owner": owner, "revoked": {"$ne": True}},
            {"$set": {"revoked": True, "revoked_at": now_ms}},
        )
        if result.modified_count > 0:
            log_event("magic_link_revoked", target_id=file_id, details={
                "share_id": share_id,
            })
            return jsonify({"status": "revoked"})

    abort(404, "share not found or already revoked")


# ---------------------------------------------------------------------------
# Cleanup utility
# ---------------------------------------------------------------------------

def cleanup_expired_shares() -> int:
    """Delete expired/consumed/revoked magic shares older than 30 days.

    Called via Flask CLI: flask cleanup-shares
    """
    cutoff_ms = int(time.time() * 1000) - (30 * 24 * 60 * 60 * 1000)
    coll = _magic_shares_collection()
    result = coll.delete_many({
        "$or": [
            {"expires_at": {"$lt": cutoff_ms}},
            {"consumed": True, "consumed_at": {"$lt": cutoff_ms}},
            {"revoked": True, "revoked_at": {"$lt": cutoff_ms}},
        ]
    })

    if result.deleted_count > 0:
        logger.info("Cleaned up %d expired magic share(s)", result.deleted_count)

    return result.deleted_count
@bp.get("/<token>/verify-proof", strict_slashes=False)
def verify_magic_link_proof(token: str):
    """Verify the zero-knowledge proof of a redacted document shared via Magic Link."""
    token_hash = _hash_token(token)
    coll = _magic_shares_collection()
    share = coll.find_one({"access_token_hash": token_hash, "revoked": {"$ne": True}})
    
    if not share:
        return jsonify({"valid": False, "error": "link_not_found"}), 404
        
    file_id = share.get("file_id")
    files_coll = get_db()["files"]
    
    # Resolve ObjectId vs str
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        file_rec = files_coll.find_one({"_id": ObjectId(file_id)})
    except InvalidId:
        file_rec = files_coll.find_one({"_id": file_id})
    except Exception:
        file_rec = files_coll.find_one({"_id": file_id})
        
    if not file_rec:
        return jsonify({"valid": False, "error": "file_not_found"}), 404

    status = file_rec.get("redaction_status")
    if status != "complete":
        return jsonify({"valid": False, "error": "no_proof_available", "message": "Document is not fully redacted yet"})

    proof_payload = file_rec.get("redaction_proof") or {}
    proof_location = proof_payload.get("proof_location")
    
    if not proof_location:
        return jsonify({"valid": False, "error": "proof_missing"})

    try:
        proof_package = json.loads(s3_mod.download_blob(proof_location).decode("utf-8"))
    except Exception as exc:
        logger.error("Failed to load ZK proof package from S3: %s", exc)
        return jsonify({"valid": False, "error": "proof_unavailable"})

    from ..core import zk_redaction
    
    valid = True
    redaction_vkey = zk_redaction.redaction_vkey_path()
    
    chunk_count = proof_package.get("chunk_count")
    if not isinstance(chunk_count, int) or chunk_count <= 0:
        return jsonify({"valid": False, "error": "invalid_proof_metadata"})
        
    modified_chunks_data = proof_package.get("modified_chunks") or []
    
    # We cryptographically verify each modified chunk against the VKey
    for entry in modified_chunks_data:
        proof = entry.get("proof")
        public_signals = entry.get("public_signals")
        
        if not proof or not public_signals:
            valid = False
            break
            
        if not zk_redaction.verify_redaction_proof(proof, public_signals, vkey_path=redaction_vkey):
            valid = False
            break

    if valid:
        return jsonify({"valid": True, "message": "Zero-knowledge proof verified successfully"})
    else:
        return jsonify({"valid": False, "error": "cryptographic_tampering_detected"})
