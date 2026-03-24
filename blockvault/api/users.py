from __future__ import annotations

import time
from typing import Any, Dict

from flask import Blueprint, abort, request, current_app
from cryptography.hazmat.primitives import serialization

from ..core.db import get_db
from ..core.security import require_auth, require_role, Role, role_name

bp = Blueprint("users", __name__)


def _users_collection():
    return get_db()["users"]


@bp.get("/profile")
@require_auth
@require_role(Role.AUDITOR)
def profile():  # type: ignore
    address = getattr(request, "address")
    doc: Dict[str, Any] = _users_collection().find_one({"address": address}) or {}
    include_key = request.args.get("with_key") == "1"
    resp: Dict[str, Any] = {
        "address": address,
        "role": role_name(getattr(request, "role", Role.AUDITOR)),
        "role_value": int(getattr(request, "role", Role.AUDITOR)),
        "has_public_key": bool(doc.get("sharing_pubkey")),
        "wrapped_vault_key": doc.get("wrapped_vault_key"),
    }
    if include_key and doc.get("sharing_pubkey"):
        resp["public_key_pem"] = doc.get("sharing_pubkey")
    return resp
    
@bp.post("/vault")
@require_auth
def set_vault_key():  # type: ignore
    """Store or rotate the user's Master Passphrase-wrapped Vault Key."""
    payload = request.get_json(silent=True) or {}
    wrapped_vault_key = payload.get("wrapped_vault_key")
    
    if not wrapped_vault_key or not isinstance(wrapped_vault_key, str):
        abort(400, "wrapped_vault_key string is required")
        
    now_ms = int(time.time() * 1000)
    address = getattr(request, "address")
    
    _users_collection().update_one(
        {"address": address},
        {"$set": {"wrapped_vault_key": wrapped_vault_key, "vault_key_updated_at": now_ms}},
        upsert=True,
    )
    return {"status": "ok", "updated_at": now_ms}


@bp.post("/public_key")
@require_auth
@require_role(Role.AUDITOR)
def set_public_key():  # type: ignore
    payload = request.get_json(silent=True) or {}
    pem = payload.get("public_key_pem")
    if not pem or not isinstance(pem, str):
        abort(400, "public_key_pem required")
    try:
        serialization.load_pem_public_key(pem.encode("utf-8"))
    except Exception as exc:
        abort(400, f"invalid public key: {exc}")
    now_ms = int(time.time() * 1000)
    address = getattr(request, "address")
    _users_collection().update_one(
        {"address": address},
        {"$set": {"sharing_pubkey": pem, "sharing_key_updated_at": now_ms}},
        upsert=True,
    )
    return {"status": "ok", "updated_at": now_ms}


@bp.delete("/public_key")
@require_auth
@require_role(Role.AUDITOR)
def delete_public_key():  # type: ignore
    address = getattr(request, "address")
    coll = _users_collection()
    doc = coll.find_one({"address": address})
    if not doc or not doc.get("sharing_pubkey"):
        abort(404, "public key not set")
    coll.update_one({"address": address}, {"$set": {"sharing_pubkey": None}})
    return {"status": "deleted"}


@bp.get("/public_key/<address>")
@require_auth
@require_role(Role.AUDITOR)
def get_user_public_key(address: str):  # type: ignore
    """Lookup a user's public key by wallet address.

    Used during file sharing to encrypt the file key for the recipient.
    Any authenticated user can lookup public keys.
    """
    normalized_address = address.strip().lower()

    if not normalized_address.startswith('0x') or len(normalized_address) != 42:
        abort(400, "invalid wallet address format")

    coll = _users_collection()
    doc = coll.find_one({"address": normalized_address})

    if not doc or not doc.get("sharing_pubkey"):
        abort(404, "user has no registered public key")

    return {
        "address": normalized_address,
        "public_key_pem": doc["sharing_pubkey"],
        "has_public_key": True,
    }
