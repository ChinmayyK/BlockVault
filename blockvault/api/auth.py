from __future__ import annotations
from flask import Blueprint, request, abort, current_app
import secrets
import time
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

    from eth_account import Account  # local import to avoid heavy import if unused
    try:
        recovered = Account.recover_message(encoded, signature=signature)
    except Exception:
        abort(400, "invalid signature")
    if recovered.lower() != address.lower():
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
            current_app.logger.info(f"🔐 Auto-generating RSA keys for user {address}")
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
            current_app.logger.info(f"✅ RSA keys registered for user {address}")
        except Exception as e:
            current_app.logger.warning(f"⚠️ Failed to auto-generate RSA keys: {e}")
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

    token = generate_jwt({"sub": address})
    
    response = {"token": token, "address": address}
    
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
    role = getattr(_req, "role", 2)
    return {
        "address": getattr(_req, "address"),
        "role": role_name(role),
        "role_value": int(role),
    }
