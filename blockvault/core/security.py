"""Security utilities: JWT auth, role resolution, and access decorators.

Roles are stored in the MongoDB ``users`` collection under the ``role``
field.  If a user has no role field they default to ``USER``.

Role hierarchy (higher value = more privilege):
  AUDITOR (1) — read-only access
  USER    (2) — standard file operations
  ADMIN   (3) — full access including settings and debug
"""
from __future__ import annotations

import time
from enum import IntEnum
from functools import wraps
from typing import Any, Callable, Dict, TypeVar, cast

import jwt
from flask import abort, current_app, request


# ---------------------------------------------------------------------------
# Role definitions
# ---------------------------------------------------------------------------

class Role(IntEnum):
    AUDITOR = 1   # read-only
    USER = 2      # standard file operations
    ADMIN = 3     # full administrative access


_ROLE_NAMES = {
    Role.AUDITOR: "auditor",
    Role.USER: "user",
    Role.ADMIN: "admin",
}


def role_name(role: Role) -> str:
    return _ROLE_NAMES.get(role, "unknown")


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def generate_jwt(payload: Dict[str, Any]) -> str:
    secret = current_app.config["JWT_SECRET"]
    exp_minutes = current_app.config.get("JWT_EXP_MINUTES", 15)
    now = int(time.time())
    to_encode = {"iat": now, "exp": now + exp_minutes * 60, **payload}
    return jwt.encode(to_encode, secret, algorithm="HS256")


def verify_jwt(token: str) -> Dict[str, Any]:
    secret = current_app.config["JWT_SECRET"]
    return jwt.decode(token, secret, algorithms=["HS256"])  # type: ignore


# ---------------------------------------------------------------------------
# Refresh tokens
# ---------------------------------------------------------------------------

REFRESH_TOKEN_DAYS = 7


def generate_refresh_token(address: str, device_fingerprint: str = "") -> str:
    """Create a long-lived opaque refresh token stored in MongoDB."""
    import secrets as _secrets
    from .db import get_db

    token = _secrets.token_urlsafe(48)
    now = int(time.time())
    expires_at = now + REFRESH_TOKEN_DAYS * 86400

    get_db()["refresh_tokens"].insert_one({
        "token_hash": _hash_token(token),
        "address": address.lower(),
        "device": device_fingerprint,
        "created_at": now,
        "expires_at": expires_at,
        "revoked": False,
    })
    return token


def verify_refresh_token(token: str) -> Dict[str, Any] | None:
    """Validate a refresh token. Returns the token doc or None."""
    from .db import get_db

    token_hash = _hash_token(token)
    doc = get_db()["refresh_tokens"].find_one({
        "token_hash": token_hash,
        "revoked": False,
    })
    if not doc:
        return None
    if int(time.time()) > doc.get("expires_at", 0):
        return None
    return doc


def revoke_refresh_token(token: str) -> bool:
    """Revoke a refresh token. Returns True if found and revoked."""
    from .db import get_db

    result = get_db()["refresh_tokens"].update_one(
        {"token_hash": _hash_token(token)},
        {"$set": {"revoked": True}},
    )
    return result.modified_count > 0


def revoke_all_refresh_tokens(address: str) -> int:
    """Revoke every refresh token for a user. Returns count revoked."""
    from .db import get_db

    result = get_db()["refresh_tokens"].update_many(
        {"address": address.lower(), "revoked": False},
        {"$set": {"revoked": True}},
    )
    return result.modified_count


def rotate_refresh_token(old_token: str, device_fingerprint: str = "") -> tuple[str, str] | None:
    """Rotate: revoke old token, issue new access + refresh token pair.

    Returns (new_access_token, new_refresh_token) or None if invalid.
    """
    doc = verify_refresh_token(old_token)
    if not doc:
        return None
    revoke_refresh_token(old_token)
    address = doc["address"]
    new_access = generate_jwt({"sub": address})
    new_refresh = generate_refresh_token(address, device_fingerprint)
    return new_access, new_refresh


def _hash_token(token: str) -> str:
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Role resolution
# ---------------------------------------------------------------------------

def _resolve_role(address: str) -> Role:
    """Look up the user's role from MongoDB.  Defaults to USER if unset."""
    from .db import get_db  # noqa: WPS433 — late import to avoid circular deps
    users = get_db()["users"]
    doc = users.find_one({"address": address.lower()})
    if doc and "role" in doc:
        try:
            return Role(int(doc["role"]))
        except (ValueError, KeyError):
            pass
    return Role.USER


def _attach_role(address: str) -> None:
    """Resolve and attach role to the Flask request context."""
    role = _resolve_role(address)
    request.role = role  # type: ignore[attr-defined]
    request.role_name = role_name(role)  # type: ignore[attr-defined]


# ---------------------------------------------------------------------------
# Decorators
# ---------------------------------------------------------------------------

F = TypeVar("F", bound=Callable[..., Any])


def require_auth(fn: F) -> F:
    """Decorator: enforce JWT auth via ``Authorization: Bearer <token>``.

    Sets ``request.address`` and ``request.role``.
    """

    @wraps(fn)
    def wrapper(*args: Any, **kwargs: Any):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            abort(401, "missing bearer token")
        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            abort(401, "empty token")
        try:
            decoded = verify_jwt(token)
        except jwt.ExpiredSignatureError:
            abort(401, "token expired")
        except jwt.InvalidTokenError:
            abort(401, "invalid token")
        sub = decoded.get("sub")
        if not sub:
            abort(401, "invalid subject")
        request.address = sub  # type: ignore[attr-defined]
        _attach_role(sub)
        return fn(*args, **kwargs)

    return cast(F, wrapper)


def require_role(min_role: Role):
    """Decorator factory: enforce minimum role after ``@require_auth``.

    Usage::

        @bp.get("/admin-only")
        @require_auth
        @require_role(Role.ADMIN)
        def admin_endpoint(): ...
    """
    def decorator(fn: F) -> F:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any):
            user_role: int = getattr(request, "role", 0)
            if user_role < min_role:
                abort(403, f"{role_name(min_role)} role required")
            return fn(*args, **kwargs)
        return cast(F, wrapper)
    return decorator
