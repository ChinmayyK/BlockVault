from __future__ import annotations
from flask import Blueprint, request, abort, current_app
import secrets
import time
import random
from eth_account.messages import encode_defunct
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from ..core.db import get_db
from ..core.security import generate_jwt, require_auth

def _normalize_address(addr: str) -> str:
    a = addr.strip()
    if a.startswith('0x'):
        a = a[2:]
    if len(a) != 40 or any(c not in '0123456789abcdefABCDEF' for c in a):
        raise ValueError('invalid address')
    return '0x' + a.lower()


def _generate_rsa_keypair():
    """Generate RSA-2048 key pair and return PEM strings."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    return private_pem, public_pem


bp = Blueprint("auth", __name__)

NONCE_TTL_SECONDS = 300  # 5 minutes


def _nonce_collection():
    return get_db()["nonces"]


def _users_collection():
    return get_db()["users"]


@bp.post("/get_nonce")
def get_nonce():
    data = request.get_json(silent=True) or {}
    address = data.get("address")
    if not address or not isinstance(address, str):
        abort(400, "address required")
    try:
        address = _normalize_address(address)
    except ValueError:
        abort(400, "invalid address")

    nonce = secrets.token_hex(16)
    now = int(time.time())

    _nonce_collection().update_one(
        {"address": address},
        {"$set": {"nonce": nonce, "created_at": now}},
        upsert=True,
    )

    return {"address": address, "nonce": nonce, "message": f"BlockVault login nonce: {nonce}"}


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    address = data.get("address")
    signature = data.get("signature")
    if not address or not signature:
        abort(400, "address and signature required")

    try:
        address = _normalize_address(address)
    except ValueError:
        abort(400, "invalid address")

    rec = _nonce_collection().find_one({"address": address})
    if not rec:
        abort(400, "nonce not found; request a new one")

    # Check TTL
    if int(time.time()) - int(rec.get("created_at", 0)) > NONCE_TTL_SECONDS:
        abort(400, "nonce expired; request a new one")

    nonce = rec.get("nonce")
    if not nonce:
        abort(400, "nonce missing; request a new one")

    message = f"BlockVault login nonce: {nonce}"
    encoded = encode_defunct(text=message)

    from eth_account import Account
    try:
        recovered = Account.recover_message(encoded, signature=signature)
    except Exception:
        time.sleep(random.uniform(0.01, 0.03))  # timing defense
        from ..core.audit import log_event
        log_event("failed_login", details={"address": address, "reason": "invalid_signature"})
        abort(400, "invalid signature")
    if recovered.lower() != address.lower():
        time.sleep(random.uniform(0.01, 0.03))  # timing defense
        from ..core.audit import log_event
        log_event("failed_login", details={"address": address, "reason": "address_mismatch"})
        abort(401, "signature does not match address")

    # Check if user already has RSA keys registered
    users_coll = _users_collection()
    user_doc = users_coll.find_one({"address": address})
    has_rsa_keys = user_doc and user_doc.get("sharing_pubkey")

    rsa_private_key = None
    rsa_public_key = None
    rsa_message = None

    if not has_rsa_keys:
        # Generate RSA keys for first-time users
        try:
            current_app.logger.info("Auto-generating RSA keys for user %s", address)
            rsa_private_key, rsa_public_key = _generate_rsa_keypair()
            
            # Store public key in database
            users_coll.update_one(
                {"address": address},
                {
                    "$set": {
                        "sharing_pubkey": rsa_public_key,
                        "sharing_key_updated_at": int(time.time() * 1000)
                    },
                    "$setOnInsert": {"created_at": int(time.time())}
                },
                upsert=True,
            )
            rsa_message = "RSA keys auto-generated for secure sharing"
            current_app.logger.info("RSA keys registered for user %s", address)
        except Exception as e:
            current_app.logger.warning("Failed to auto-generate RSA keys: %s", e)
            # Non-fatal - user can generate later manually
    else:
        # User already has keys - check if there are pending private keys from shares
        # This handles the case where keys were auto-generated during a share
        if user_doc.get("keys_generated_by_share"):
            # Look for pending private keys in shares
            try:
                shares_coll = get_db()["shares"]
                pending_share = shares_coll.find_one({
                    "recipient": address,
                    "recipient_private_key_pending": {"$exists": True, "$ne": None}
                })
                
                if pending_share:
                    rsa_private_key = pending_share.get("recipient_private_key_pending")
                    rsa_public_key = user_doc.get("sharing_pubkey")
                    rsa_message = "Retrieved RSA keys that were generated for you by a file sharer"
                    current_app.logger.info(f"🔑 Retrieved pending private key for user {address}")
                    
                    # Clear the pending key from all shares for this recipient
                    shares_coll.update_many(
                        {"recipient": address},
                        {"$unset": {"recipient_private_key_pending": ""}}
                    )
                    
                    # Clear the flag from user doc
                    users_coll.update_one(
                        {"address": address},
                        {"$unset": {"keys_generated_by_share": ""}}
                    )
            except Exception as e:
                current_app.logger.warning(f"⚠️ Failed to retrieve pending RSA keys: {e}")
        
        # Update last login
        users_coll.update_one(
            {"address": address},
            {"$setOnInsert": {"created_at": int(time.time())}},
            upsert=True,
        )

    # Invalidate used nonce
    _nonce_collection().delete_one({"address": address})

    from ..core.roles import parse_platform_role
    from ..core.permissions import _get_platform_role

    platform_role = _get_platform_role(address)
    token = generate_jwt({"sub": address})

    from ..core.audit import log_event
    log_event("login", details={"address": address})

    # Auto-create personal vault workspace on login
    try:
        from ..core.workspaces import WorkspaceStore
        ws_store = WorkspaceStore()
        ws_store.ensure_personal_vault(address)
    except Exception as e:
        current_app.logger.warning("Failed to ensure personal vault: %s", e)

    # Fetch org and workspace memberships for the response
    orgs = []
    workspaces = []
    try:
        from ..core.organizations import OrganizationStore
        from ..core.workspaces import WorkspaceStore
        org_store = OrganizationStore()
        ws_store = WorkspaceStore()
        orgs = org_store.get_user_orgs(address)
        workspaces = ws_store.get_user_workspaces(address)
    except Exception as e:
        current_app.logger.warning("Failed to load role context: %s", e)

    response = {
        "token": token,
        "address": address,
        "platform_role": platform_role.value,
        # Legacy field for backward compatibility
        "role": platform_role.value,
        "organizations": orgs,
        "workspaces": workspaces,
        "wrapped_vault_key": user_doc.get("wrapped_vault_key") if user_doc else None,
    }
    
    # Return RSA keys to frontend for local storage (only on first generation or retrieval)
    if rsa_private_key and rsa_public_key:
        response["rsa_private_key"] = rsa_private_key
        response["rsa_public_key"] = rsa_public_key
        response["message"] = rsa_message
    
    return response


@bp.get("/me")
@require_auth
def me():  # type: ignore
    from flask import request as _req
    from ..core.security import role_name
    address = getattr(_req, "address")
    role = getattr(_req, "role", 2)
    
    # Needs to eagerly fetch the user document to load Vault status 
    user_doc = _users_collection().find_one({"address": address}) or {}
    
    return {
        "address": address,
        "role": role_name(role),
        "role_value": int(role),
        "wrapped_vault_key": user_doc.get("wrapped_vault_key"),
    }
