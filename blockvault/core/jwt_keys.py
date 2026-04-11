"""JWT signing key rotation infrastructure.

Supports multiple active signing keys with a grace period, enabling
zero-downtime key rotation without invalidating all sessions.

Key lifecycle:
  1. ``rotate_key()`` creates a new active key and retires the old one.
  2. New JWTs are signed with the active key (identified by ``kid`` header).
  3. Verification tries the active key first, then grace-period keys.
  4. Expired grace keys are auto-cleaned.

Usage::

    from blockvault.core.jwt_keys import get_active_key, verify_with_any_valid_key, rotate_key
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Grace period: old keys remain valid for verification for this many seconds
# after rotation (default 24 hours).
GRACE_PERIOD_SECONDS = 86400


def _key_collection():
    from .db import get_db
    return get_db()["jwt_signing_keys"]


def _ensure_indexes() -> None:
    try:
        coll = _key_collection()
        coll.create_index("status")
        coll.create_index("created_at")
    except Exception as exc:
        logger.debug("JWT key index creation skipped: %s", exc)


_indexes_ensured = False


def _lazy_ensure_indexes():
    global _indexes_ensured
    if not _indexes_ensured:
        _ensure_indexes()
        _indexes_ensured = True


# ---------------------------------------------------------------------------
# Key management
# ---------------------------------------------------------------------------

def _generate_kid() -> str:
    """Generate a unique key ID based on timestamp + random suffix."""
    ts = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    suffix = secrets.token_hex(4)
    return f"bv-{ts}-{suffix}"


def _generate_secret(length: int = 64) -> str:
    """Generate a cryptographically strong secret for HS256 signing."""
    return secrets.token_urlsafe(length)


def get_active_key() -> Tuple[str, str]:
    """Return the (kid, secret) of the currently active signing key.

    If no key exists in the database, falls back to the app config
    JWT_SECRET and creates a database record for it.
    """
    _lazy_ensure_indexes()
    coll = _key_collection()

    active = coll.find_one({"status": "active"}, sort=[("created_at", -1)])
    if active:
        return active["kid"], active["secret"]

    # Bootstrap: migrate the static JWT_SECRET into the key store
    try:
        from flask import current_app
        static_secret = current_app.config.get("JWT_SECRET", "")
    except RuntimeError:
        static_secret = ""

    if not static_secret:
        static_secret = _generate_secret()

    kid = _generate_kid()
    now = int(time.time())
    coll.insert_one({
        "kid": kid,
        "secret": static_secret,
        "status": "active",
        "created_at": now,
        "rotated_at": None,
        "expires_at": None,
    })
    logger.info("Bootstrapped JWT signing key: kid=%s", kid)
    return kid, static_secret


def rotate_key() -> Dict[str, Any]:
    """Create a new active key and move the current one to grace period.

    Returns the new key metadata (kid, created_at).
    """
    _lazy_ensure_indexes()
    coll = _key_collection()
    now = int(time.time())

    # Retire all currently active keys
    coll.update_many(
        {"status": "active"},
        {"$set": {
            "status": "grace",
            "rotated_at": now,
            "expires_at": now + GRACE_PERIOD_SECONDS,
        }},
    )

    # Create new active key
    new_kid = _generate_kid()
    new_secret = _generate_secret()
    doc = {
        "kid": new_kid,
        "secret": new_secret,
        "status": "active",
        "created_at": now,
        "rotated_at": None,
        "expires_at": None,
    }
    coll.insert_one(doc)

    # Clean up expired grace keys
    coll.delete_many({
        "status": "grace",
        "expires_at": {"$lt": now},
    })

    # Also clean up any keys in expired status
    coll.delete_many({"status": "expired"})

    logger.info("Rotated JWT signing key: new kid=%s", new_kid)
    return {"kid": new_kid, "created_at": now}


def get_all_valid_keys() -> List[Tuple[str, str]]:
    """Return all valid (kid, secret) pairs: active + grace period keys.

    Ordered with the active key first, then grace keys newest-first.
    """
    _lazy_ensure_indexes()
    coll = _key_collection()
    now = int(time.time())

    keys = list(coll.find({
        "$or": [
            {"status": "active"},
            {"status": "grace", "expires_at": {"$gt": now}},
        ],
    }).sort("created_at", -1))

    # Active keys first, then grace keys
    active = [(k["kid"], k["secret"]) for k in keys if k["status"] == "active"]
    grace = [(k["kid"], k["secret"]) for k in keys if k["status"] == "grace"]
    return active + grace


def verify_with_any_valid_key(token: str) -> Dict[str, Any]:
    """Attempt to verify a JWT against all valid signing keys.

    Tries the key matching the token's ``kid`` header first, then
    falls back to all valid keys. Returns the decoded payload.

    Raises jwt.InvalidTokenError if no key works.
    """
    import jwt as pyjwt

    # Try to extract kid from header without full verification
    try:
        unverified_header = pyjwt.get_unverified_header(token)
        token_kid = unverified_header.get("kid")
    except Exception:
        token_kid = None

    valid_keys = get_all_valid_keys()

    if not valid_keys:
        # Fallback to static config key
        try:
            from flask import current_app
            static_secret = current_app.config.get("JWT_SECRET", "")
            if static_secret:
                return pyjwt.decode(token, static_secret, algorithms=["HS256"])
        except RuntimeError:
            pass
        raise pyjwt.InvalidTokenError("no valid signing keys available")

    # If we know the kid, try that key first
    if token_kid:
        for kid, secret in valid_keys:
            if kid == token_kid:
                try:
                    return pyjwt.decode(token, secret, algorithms=["HS256"])
                except pyjwt.InvalidTokenError:
                    break  # kid matched but verification failed — don't try others

    # Try all keys (handles tokens without kid header — legacy tokens)
    last_exc: Optional[Exception] = None
    for kid, secret in valid_keys:
        try:
            return pyjwt.decode(token, secret, algorithms=["HS256"])
        except pyjwt.ExpiredSignatureError:
            raise  # Don't mask expiry
        except pyjwt.InvalidTokenError as exc:
            last_exc = exc
            continue

    raise last_exc or pyjwt.InvalidTokenError("token verification failed")


def list_keys_info() -> List[Dict[str, Any]]:
    """Return metadata about all keys (for admin dashboard). Secrets are NOT included."""
    _lazy_ensure_indexes()
    coll = _key_collection()
    keys = list(coll.find().sort("created_at", -1))
    return [
        {
            "kid": k["kid"],
            "status": k["status"],
            "created_at": k.get("created_at"),
            "rotated_at": k.get("rotated_at"),
            "expires_at": k.get("expires_at"),
        }
        for k in keys
    ]
