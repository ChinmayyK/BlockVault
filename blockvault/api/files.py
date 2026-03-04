from __future__ import annotations

import base64
import io
import os
import time
import traceback
import hashlib
from typing import Dict, Any, List, Optional, Tuple

from flask import Blueprint, request, abort, send_file, current_app
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from ..core.security import require_auth
from ..core.db import get_db
from ..core.crypto_client import (
    encrypt_data as crypto_encrypt,
    decrypt_data as crypto_decrypt,
    generate_encrypted_filename,
    CryptoDaemonError,
)
from ..core import s3 as s3_mod
from ..core import ipfs as ipfs_mod
from ..core import onchain as onchain_mod

# Simplified role constants (on-chain RBAC removed)
class Role:
    VIEWER = 1
    OWNER = 2
    ADMIN = 3

def ensure_role(_min_role: int):  # no-op: all authenticated users act as owners
    return True

bp = Blueprint("files", __name__)


def _files_collection():
    return get_db()["files"]


def _shares_collection():
    return get_db()["shares"]


def _users_collection():
    return get_db()["users"]


def _file_access_collection():
    # Off-chain convenience index of granted on-chain roles (for UI listing only)
    return get_db()["file_access_roles"]


def _canonical_file_id(rec: Dict[str, Any], fallback: str) -> str:
    if rec.get("_id") is not None:
        return str(rec["_id"])
    return fallback


def _lookup_file(file_id: str) -> Tuple[Dict[str, Any], str]:
    coll = _files_collection()
    candidates: List[Any] = []
    try:
        from bson import ObjectId  # type: ignore

        candidates.append(ObjectId(file_id))
    except Exception:
        pass
    candidates.append(file_id)
    
    current_app.logger.debug(f"Looking up file_id: {file_id}, candidates: {candidates}")
    
    for candidate in candidates:
        rec = coll.find_one({"_id": candidate})
        if rec:
            current_app.logger.debug(f"Found file: {rec.get('original_name')}")
            return rec, _canonical_file_id(rec, file_id)
    
    # Additional debug: List all files to see what's in the database
    all_files = list(coll.find({}))
    current_app.logger.error(f"File not found. Available files: {[str(f.get('_id')) for f in all_files[:10]]}")
    
    abort(404, "file not found")


def _maybe_get_file(file_id: str) -> Optional[Dict[str, Any]]:
    coll = _files_collection()
    candidates: List[Any] = []
    try:
        from bson import ObjectId  # type: ignore

        candidates.append(ObjectId(file_id))
    except Exception:
        pass
    candidates.append(file_id)
    for candidate in candidates:
        rec = coll.find_one({"_id": candidate})
        if rec:
            return rec
    return None


def _load_public_key(pem: str):
    try:
        return serialization.load_pem_public_key(pem.encode("utf-8"))
    except Exception as exc:
        abort(400, f"invalid recipient public key: {exc}")


def _serialize_share(doc: Dict[str, Any], include_encrypted: bool = True) -> Dict[str, Any]:
    base = {
        "share_id": str(doc.get("_id")),
        "file_id": doc.get("file_id"),
        "owner": doc.get("owner"),
        "recipient": doc.get("recipient"),
        "encrypted_key": doc.get("encrypted_key") if include_encrypted else None,
        "note": doc.get("note"),
        "created_at": doc.get("created_at"),
        "expires_at": doc.get("expires_at"),
    }
    if "file_name" in doc:
        base["file_name"] = doc.get("file_name")
    if "file_size" in doc:
        base["file_size"] = doc.get("file_size")
    if "sha256" in doc:
        base["sha256"] = doc.get("sha256")
    if "cid" in doc:
        base["cid"] = doc.get("cid")
    if "gateway_url" in doc:
        base["gateway_url"] = doc.get("gateway_url")
    return base


@bp.post("/", strict_slashes=False)
@require_auth
def upload_file():  # type: ignore
    ensure_role(Role.OWNER)
    if "file" not in request.files:
        abort(400, "file part required (multipart/form-data)")
    up_file = request.files["file"]
    if up_file.filename == "":
        abort(400, "empty filename")
    key = request.form.get("key")
    if not key:
        abort(400, "key (passphrase) required")
    aad = request.form.get("aad") or None
    folder = request.form.get("folder") or None
    if folder is not None:
        folder = folder.strip() or None
        if folder and len(folder) > 120:
            abort(400, "folder name too long (max 120 chars)")

    original_name = up_file.filename
    data = up_file.read()
    if not data:
        abort(400, "empty file content")

    owner = getattr(request, "address").lower()
    
    # Encrypt the passphrase with owner's public key for secure storage
    owner_encrypted_key = None
    owner_doc = _users_collection().find_one({"address": owner})
    if owner_doc and owner_doc.get("sharing_pubkey"):
        try:
            owner_pubkey = _load_public_key(owner_doc["sharing_pubkey"])
            encrypted_bytes = owner_pubkey.encrypt(
                key.encode("utf-8"),
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None,
                ),
            )
            owner_encrypted_key = base64.b64encode(encrypted_bytes).decode("utf-8")
            current_app.logger.info(f"🔐 Stored owner-encrypted key for file upload by {owner}")
        except Exception as e:
            current_app.logger.warning(f"⚠️ Failed to encrypt key for owner: {e}")
            # Non-fatal: continue without stored key (legacy behavior)
    
    enc_filename = generate_encrypted_filename()

    # Encrypt in-memory via the crypto daemon, then push to S3.
    try:
        encrypted_bytes = crypto_encrypt(data, key, aad)
    except CryptoDaemonError:
        abort(503, "crypto service unavailable")

    # Upload encrypted blob to S3
    s3_mod.upload_blob(enc_filename, encrypted_bytes)

    sha256 = hashlib.sha256(data).hexdigest()

    # Store file metadata immediately — IPFS and blockchain run in background.
    record = {
        "owner": owner,
        "original_name": original_name,
        "enc_filename": enc_filename,
        "size": len(data),
        # millisecond precision for better pagination granularity
        "created_at": int(time.time() * 1000),
        "aad": aad,
        "sha256": sha256,
        "cid": None,
        "anchor_tx": None,
        "ipfs_status": "pending",
        "anchor_status": "pending",
        "folder": folder,
        "owner_encrypted_key": owner_encrypted_key,  # Encrypted with owner's public key
    }
    ins = _files_collection().insert_one(record)
    file_id_str = str(ins.inserted_id)

    # Enqueue background tasks (non-blocking)
    try:
        from ..core.tasks import pin_to_ipfs, anchor_on_chain
        pin_to_ipfs.delay(file_id_str)
        anchor_on_chain.delay(file_id_str)
    except Exception as exc:
        current_app.logger.warning("Failed to enqueue background tasks: %s", exc)

    return {
        "file_id": file_id_str,
        "name": original_name,
        "sha256": sha256,
        "cid": None,
        "gateway_url": None,
        "anchor_tx": None,
        "ipfs_status": "pending",
        "anchor_status": "pending",
        "has_stored_key": owner_encrypted_key is not None,
    }



@bp.get("/<file_id>/status", strict_slashes=False)
@require_auth
def file_status(file_id: str):  # type: ignore
    """Return the async processing status for a file.

    Response:
    {
        "ipfs_status": "pending|complete|failed",
        "anchor_status": "pending|complete|failed",
        "cid": "...",
        "anchor_tx": "..."
    }
    """
    rec, canonical_id = _lookup_file(file_id)
    requester = getattr(request, "address").lower()
    if rec.get("owner") != requester:
        # Also allow recipients who have a share
        share = _shares_collection().find_one({"file_id": canonical_id, "recipient": requester})
        if not share:
            abort(404, "file not found")
    return {
        "file_id": canonical_id,
        "ipfs_status": rec.get("ipfs_status", "complete" if rec.get("cid") else "pending"),
        "anchor_status": rec.get("anchor_status", "complete" if rec.get("anchor_tx") else "pending"),
        "cid": rec.get("cid"),
        "gateway_url": ipfs_mod.gateway_url(rec["cid"]) if rec.get("cid") else None,
        "anchor_tx": rec.get("anchor_tx"),
    }


@bp.get("/<file_id>", strict_slashes=False)
@require_auth
def download_file(file_id: str):  # type: ignore
    key = request.args.get("key") or request.headers.get("X-File-Key")
    if not key:
        abort(400, "key required (query ?key= or X-File-Key header)")
    inline = request.args.get("inline") == "1"

    rec, canonical_id = _lookup_file(file_id)
    owner = rec.get("owner")
    requester = getattr(request, "address").lower()  # Normalize to lowercase
    if owner != requester:
        share = _shares_collection().find_one({"file_id": canonical_id, "recipient": requester})
        if not share:
            abort(404, "file not found")
        expires_at = share.get("expires_at")
        if expires_at and int(time.time() * 1000) > int(expires_at):
            abort(403, "share expired")

    # Fetch encrypted blob from S3
    try:
        try:
            encrypted_bytes = s3_mod.download_blob(rec["enc_filename"])
        except FileNotFoundError:
            abort(410, "encrypted blob missing from object storage")

        # Decrypt in-memory via the crypto daemon.
        try:
            data = crypto_decrypt(encrypted_bytes, key, rec.get("aad"))
        except CryptoDaemonError:
            abort(503, "crypto service unavailable")
        except Exception as e:  # wrong key / corrupted
            abort(400, f"decryption failed (bad key or corrupted data): {type(e).__name__}")

        # Determine MIME type for inline viewing
        mimetype = None
        if inline:
            filename = rec["original_name"].lower()
            if filename.endswith('.pdf'):
                mimetype = 'application/pdf'
            elif filename.endswith(('.png', '.jpg', '.jpeg')):
                mimetype = 'image/jpeg' if filename.endswith(('.jpg', '.jpeg')) else 'image/png'
            elif filename.endswith('.gif'):
                mimetype = 'image/gif'
            elif filename.endswith('.webp'):
                mimetype = 'image/webp'
            elif filename.endswith('.svg'):
                mimetype = 'image/svg+xml'
            elif filename.endswith(('.txt', '.md')):
                mimetype = 'text/plain; charset=utf-8'
            elif filename.endswith('.html'):
                mimetype = 'text/html; charset=utf-8'
            else:
                mimetype = 'application/octet-stream'
        
        return send_file(
            io.BytesIO(data),
            as_attachment=not inline,
            download_name=rec["original_name"],
            mimetype=mimetype,
        )
    except Exception as e:  # unexpected
        # Log stack for diagnostics
        tb = traceback.format_exc(limit=6)
        print(f"[ERROR] download_file id={file_id} owner={getattr(request,'address',None)}: {e}\n{tb}")
        if isinstance(e, SystemExit):
            raise
        # If it's already an HTTPException, let Flask handler format
        from werkzeug.exceptions import HTTPException
        if isinstance(e, HTTPException):
            raise
        # Generic fallback
        abort(500, "download failed (internal error)")


@bp.get("/", strict_slashes=False)
@require_auth
def list_files():  # type: ignore
    ensure_role(Role.OWNER)
    # Simple listing for the owner; optional limit & after (created_at cursor)
    try:
        limit = int(request.args.get("limit", "50"))
    except ValueError:
        abort(400, "limit must be int")
    limit = max(1, min(limit, 100))
    after = request.args.get("after")
    try:
        after_i = int(after) if after else None
    except ValueError:
        abort(400, "after must be int timestamp")
    q = (request.args.get("q") or "").strip() or None
    folder_filter = (request.args.get("folder") or "").strip() or None

    owner = getattr(request, "address").lower()  # Normalize to lowercase for consistent lookups
    if request.headers.get('X-Debug-Files') == '1':
        print(f"[DEBUG] list_files owner={owner} after={after_i} limit={limit} q={q} folder={folder_filter}")
    coll = _files_collection()

    items: List[Dict[str, Any]] = []
    try:
        flt: Dict[str, Any] = {"owner": owner}
        if folder_filter:
            flt["folder"] = folder_filter
        if after_i is not None:
            flt["created_at"] = {"$gt": after_i}
        if q:
            flt["original_name"] = {"$regex": q, "$options": "i"}
        cursor = coll.find(flt).sort("created_at", 1).limit(limit + 1)
        for idx, doc in enumerate(cursor):
            if idx >= limit:
                items.append({"_extra": True, "_created_at": doc.get("created_at")})
                break
            items.append({
                "file_id": str(doc.get("_id")),
                "name": doc.get("original_name"),
                "size": doc.get("size"),
                "created_at": doc.get("created_at"),
                "aad": doc.get("aad"),
                "sha256": doc.get("sha256"),
                "cid": doc.get("cid"),
                "anchor_tx": doc.get("anchor_tx"),
                "gateway_url": ipfs_mod.gateway_url(doc.get("cid")) if doc.get("cid") else None,
                "folder": doc.get("folder"),
            })
    except Exception as e:
        abort(500, f"list failed: {e}")

    has_more = False
    if items and items[-1].get("_extra"):
        has_more = True
        items = items[:-1]
    next_after = items[-1]["created_at"] if items else None
    return {"items": items, "next_after": next_after, "has_more": has_more}


@bp.delete("/<file_id>", strict_slashes=False)
@require_auth
def delete_file(file_id: str):  # type: ignore
    ensure_role(Role.OWNER)
    owner = getattr(request, "address").lower()  # Normalize to lowercase
    oid = file_id
    try:
        from bson import ObjectId  # type: ignore
        oid = ObjectId(file_id)  # type: ignore
    except Exception:
        pass
    coll = _files_collection()
    rec = coll.find_one({"_id": oid, "owner": owner})
    if not rec:
        abort(404, "file not found")
    # Delete encrypted blob from S3
    s3_mod.delete_blob(rec["enc_filename"])
    # Attempt IPFS unpin (best-effort)
    cid = rec.get("cid")
    if cid:
        try:
            if ipfs_mod.ipfs_enabled():
                client = ipfs_mod._get_client()  # type: ignore[attr-defined]
                client.pin.rm(cid)  # type: ignore
        except Exception:
            pass
    # Delete record
    try:
        coll.delete_one({"_id": oid, "owner": owner})
    except Exception:
        pass
    return {"status": "deleted", "file_id": file_id}


@bp.patch("/<file_id>", strict_slashes=False)
@require_auth
def update_file(file_id: str):  # type: ignore
    """Update mutable file metadata (folder, name).

    Only the owner may update. Name change does not affect stored encrypted blob.
    """
    ensure_role(Role.OWNER)
    owner = getattr(request, "address").lower()  # Normalize to lowercase
    rec, canonical_id = _lookup_file(file_id)
    if rec.get("owner") != owner:
        abort(403, "only owner can update file")
    data = request.get_json(silent=True) or {}
    new_folder = data.get("folder") if "folder" in data else None
    rename = data.get("name") if "name" in data else None
    update: Dict[str, Any] = {}
    if new_folder is not None:
        if new_folder:
            if not isinstance(new_folder, str):
                abort(400, "folder must be string")
            nf = new_folder.strip()
            if len(nf) > 120:
                abort(400, "folder name too long (max 120 chars)")
            update["folder"] = nf
        else:
            update["folder"] = None
    if rename is not None:
        if not isinstance(rename, str) or not rename.strip():
            abort(400, "name must be non-empty string")
        if len(rename) > 255:
            abort(400, "name too long (max 255 chars)")
        update["original_name"] = rename.strip()
    if not update:
        return {"updated": False, "file_id": canonical_id}
    _files_collection().update_one({"_id": rec.get("_id")}, {"$set": update})
    new_rec = _maybe_get_file(canonical_id) or rec
    return {"updated": True, "file_id": canonical_id, "name": new_rec.get("original_name"), "folder": new_rec.get("folder")}


@bp.get("/folders", strict_slashes=False)
@require_auth
def list_folders():  # type: ignore
    """List distinct non-null folder names for current owner."""
    ensure_role(Role.OWNER)
    owner = getattr(request, "address").lower()  # Normalize to lowercase
    coll = _files_collection()
    folders: List[str] = []
    try:
        if hasattr(coll, 'distinct'):
            try:
                raw = coll.distinct("folder", {"owner": owner})  # type: ignore
                folders = [f for f in raw if f]
            except Exception:
                pass
        if not folders:
            for d in coll.find({"owner": owner, "folder": {"$ne": None}}):
                f = d.get("folder")
                if f and f not in folders:
                    folders.append(f)
    except Exception:
        pass
    folders.sort(key=str.lower)
    return {"folders": folders}


@bp.get("/<file_id>/verify", strict_slashes=False)
@require_auth
def verify_file(file_id: str):  # type: ignore
    ensure_role(Role.OWNER)
    owner = getattr(request, "address").lower()  # Normalize to lowercase
    oid = file_id
    try:
        from bson import ObjectId  # type: ignore
        oid = ObjectId(file_id)  # type: ignore
    except Exception:
        pass
    rec = _files_collection().find_one({"_id": oid, "owner": owner})
    if not rec:
        # Debug assist: if a record exists with that id but different owner, indicate mismatch (only when explicitly requested)
        dbg = request.args.get("debug")
        if dbg == "1":
            any_rec = _files_collection().find_one({"_id": oid})
            if any_rec and any_rec.get("owner") != owner:
                abort(404, "file not found (ownership mismatch)")
        abort(404, "file not found")
    blob_present = s3_mod.blob_exists(rec["enc_filename"])
    if request.headers.get('X-Debug-Files') == '1':
        print(f"[DEBUG] verify_file owner={owner} id={file_id} blob_present={blob_present}")
    result = {
        "file_id": file_id,
        "has_encrypted_blob": blob_present,
        "cid": rec.get("cid"),
        "sha256": rec.get("sha256"),
        "presigned_url": s3_mod.generate_presigned_url(rec["enc_filename"]) if blob_present else None,
    }
    return result


@bp.get("/<file_id>/key", strict_slashes=False)
@require_auth
def get_owner_encrypted_key(file_id: str):  # type: ignore
    """Retrieve the owner's encrypted file key for sharing.
    
    Only the file owner can retrieve this key. The key is encrypted with
    the owner's public key and must be decrypted client-side before
    re-encrypting for recipients.
    """
    ensure_role(Role.OWNER)
    owner = getattr(request, "address").lower()
    
    rec, canonical_id = _lookup_file(file_id)
    if rec.get("owner") != owner:
        abort(403, "only the file owner can retrieve the encryption key")
    
    owner_encrypted_key = rec.get("owner_encrypted_key")
    if not owner_encrypted_key:
        abort(404, "no stored encryption key for this file")
    
    return {
        "file_id": canonical_id,
        "owner_encrypted_key": owner_encrypted_key,
        "message": "Decrypt this key with your private key before re-encrypting for recipient",
    }


@bp.post("/<file_id>/share", strict_slashes=False)

@require_auth
def share_file(file_id: str):  # type: ignore
    ensure_role(Role.OWNER)
    owner = getattr(request, "address").lower()  # Normalize to lowercase
    current_app.logger.info(f"📤 Share request: file_id={file_id}, owner={owner}")
    
    try:
        file_rec, canonical_id = _lookup_file(file_id)
    except Exception as e:
        current_app.logger.error(f"❌ File lookup failed for {file_id}: {str(e)}")
        abort(404, f"File not found: {file_id}")
    
    if file_rec.get("owner") != owner:
        current_app.logger.error(f"❌ Owner mismatch: file owner={file_rec.get('owner')}, requester={owner}")
        abort(403, "only the file owner can share")

    data = request.get_json(silent=True) or {}
    recipient = data.get("recipient")
    passphrase = data.get("passphrase")
    encrypted_for_recipient = data.get("encrypted_for_recipient")  # Pre-encrypted key from frontend
    note = (data.get("note") or "").strip() or None
    expires_at = data.get("expires_at")

    if not recipient or not isinstance(recipient, str):
        abort(400, "recipient address required")
    
    # Accept either passphrase OR encrypted_for_recipient (for zero-knowledge sharing)
    if not passphrase and not encrypted_for_recipient:
        abort(400, "passphrase or encrypted_for_recipient required")
    
    if note and len(note) > 280:
        abort(400, "note too long (max 280 chars)")

    recipient_addr = recipient.strip().lower()
    if not recipient_addr.startswith('0x') or len(recipient_addr) != 42:
        abort(400, "invalid recipient address")
    if recipient_addr == owner:
        abort(400, "cannot share with yourself")

    users_coll = _users_collection()
    recipient_doc = users_coll.find_one({"address": recipient_addr})
    pub_pem = recipient_doc.get("sharing_pubkey") if recipient_doc else None
    
    # Auto-generate RSA keys for recipient if they don't have any
    recipient_keys_generated = False
    recipient_private_key = None
    if not pub_pem:
        current_app.logger.info(f"🔐 Auto-generating RSA keys for recipient {recipient_addr}")
        try:
            from .auth import _generate_rsa_keypair
            recipient_private_key, pub_pem = _generate_rsa_keypair()
            
            # Store public key for recipient (create user record if needed)
            users_coll.update_one(
                {"address": recipient_addr},
                {
                    "$set": {
                        "sharing_pubkey": pub_pem,
                        "sharing_key_updated_at": int(time.time() * 1000),
                        "keys_generated_by_share": True,  # Mark that keys were auto-generated
                    },
                    "$setOnInsert": {"created_at": int(time.time())}
                },
                upsert=True,
            )
            recipient_keys_generated = True
            current_app.logger.info(f"✅ RSA keys auto-generated for recipient {recipient_addr}")
        except Exception as e:
            current_app.logger.error(f"❌ Failed to auto-generate RSA keys for recipient: {e}")
            abort(400, "Failed to generate encryption keys for recipient. Recipient must login first to generate their keys.")

    # Use pre-encrypted key if provided (zero-knowledge mode), otherwise encrypt server-side
    if encrypted_for_recipient:
        # Frontend already encrypted the key with recipient's public key
        encrypted_b64 = encrypted_for_recipient
        current_app.logger.info(f"🔐 Using pre-encrypted key for zero-knowledge sharing")
    else:
        # Legacy mode: server encrypts the passphrase (passphrase visible to server)
        public_key = _load_public_key(pub_pem)
        encrypted_bytes = public_key.encrypt(
            passphrase.encode("utf-8"),
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
        encrypted_b64 = base64.b64encode(encrypted_bytes).decode("utf-8")


    now_ms = int(time.time() * 1000)
    expires_val: Optional[int] = None
    if expires_at is not None:
        try:
            expires_val = int(expires_at)
        except (TypeError, ValueError):
            abort(400, "expires_at must be an integer timestamp (ms)")

    share_filter = {"file_id": canonical_id, "owner": owner, "recipient": recipient_addr}
    share_doc = {
        **share_filter,
        "encrypted_key": encrypted_b64,
        "note": note,
        "expires_at": expires_val,
        "file_name": file_rec.get("original_name"),
        "file_size": file_rec.get("size"),
        "sha256": file_rec.get("sha256"),
        "cid": file_rec.get("cid"),
        "gateway_url": ipfs_mod.gateway_url(file_rec.get("cid")) if file_rec.get("cid") else None,
    }
    
    # If keys were auto-generated, store the private key for recipient retrieval
    if recipient_keys_generated and recipient_private_key:
        share_doc["recipient_private_key_pending"] = recipient_private_key

    coll = _shares_collection()
    existing = coll.find_one(share_filter)
    if existing:
        coll.update_one(share_filter, {"$set": {**share_doc, "updated_at": now_ms}})
        result_doc = coll.find_one(share_filter) or {**existing, **share_doc}
        result_doc.setdefault("created_at", existing.get("created_at", now_ms))
    else:
        share_doc["created_at"] = now_ms
        insert_result = coll.insert_one(share_doc)
        result_doc = coll.find_one({"_id": getattr(insert_result, "inserted_id", None)}) or share_doc

    response = _serialize_share(result_doc, include_encrypted=True)
    
    # Add flag to indicate keys were auto-generated for recipient
    if recipient_keys_generated:
        response["recipient_keys_generated"] = True
        response["message"] = f"RSA keys were auto-generated for recipient {recipient_addr}. They will receive these keys on their first login."
    
    return response


def _collect_shares(filter_query: Dict[str, Any]) -> List[Dict[str, Any]]:
    coll = _shares_collection()
    docs: List[Dict[str, Any]] = []
    try:
        docs = list(coll.find(filter_query))
    except Exception as exc:
        abort(500, f"failed to fetch shares: {exc}")
    return docs


def _merge_metadata(doc: Dict[str, Any]) -> Dict[str, Any]:
    metadata = dict(doc)
    if not metadata.get("file_name") or not metadata.get("file_size"):
        rec = _maybe_get_file(metadata.get("file_id", ""))
        if rec:
            metadata.setdefault("file_name", rec.get("original_name"))
            metadata.setdefault("file_size", rec.get("size"))
            metadata.setdefault("sha256", rec.get("sha256"))
            metadata.setdefault("cid", rec.get("cid"))
            metadata.setdefault(
                "gateway_url",
                ipfs_mod.gateway_url(rec.get("cid")) if rec.get("cid") else None,
            )
    return metadata


def _get_share_by_id(share_id: str) -> Optional[Dict[str, Any]]:
    coll = _shares_collection()
    candidates: List[Any] = []
    try:
        from bson import ObjectId  # type: ignore

        candidates.append(ObjectId(share_id))
    except Exception:
        pass
    candidates.append(share_id)
    for candidate in candidates:
        doc = coll.find_one({"_id": candidate})
        if doc:
            return doc
    return None


@bp.get("/shared", strict_slashes=False)
@require_auth
def list_shared_with_me():  # type: ignore
    ensure_role(Role.VIEWER)
    address = getattr(request, "address").lower()  # Normalize to lowercase
    now_ms = int(time.time() * 1000)
    docs = _collect_shares({"recipient": address})
    results: List[Dict[str, Any]] = []
    for doc in docs:
        expires_at = doc.get("expires_at")
        if expires_at and now_ms > int(expires_at):
            continue
        metadata = _merge_metadata(doc)
        results.append(_serialize_share(metadata, include_encrypted=True))
    return {"shares": results}


@bp.get("/shares/outgoing", strict_slashes=False)
@require_auth
def list_outgoing_shares():  # type: ignore
    ensure_role(Role.OWNER)
    owner = getattr(request, "address").lower()  # Normalize to lowercase
    docs = _collect_shares({"owner": owner})
    results = [_serialize_share(_merge_metadata(doc), include_encrypted=False) for doc in docs]
    return {"shares": results}


@bp.delete("/shares/<share_id>", strict_slashes=False)
@require_auth
def revoke_share(share_id: str):  # type: ignore
    address = getattr(request, "address").lower()  # Normalize to lowercase
    target = _get_share_by_id(share_id)
    if not target:
        abort(404, "share not found")

    if target.get("owner") != address and target.get("recipient") != address:
        ensure_role(Role.ADMIN)
    coll = _shares_collection()
    delete_filter: Dict[str, Any]
    if target.get("_id") is not None:
        delete_filter = {"_id": target.get("_id")}
    else:
        delete_filter = {
            "file_id": target.get("file_id"),
            "owner": target.get("owner"),
            "recipient": target.get("recipient"),
        }
    coll.delete_one(delete_filter)
    return {
        "status": "revoked",
        "share_id": share_id,
    }


@bp.post("/<file_id>/zkml-summary", strict_slashes=False)
@require_auth
def zkml_summarize_document(file_id: str):  # type: ignore
    """
    Generate ZKML-verified summary for a document
    
    POST /files/<file_id>/zkml-summary
    {
        "key": "encryption_passphrase",
        "max_length": 150,  // optional
        "min_length": 30   // optional
    }
    
    Returns:
    {
        "summary": "Generated summary text",
        "proof": {...},  // ZK proof
        "metadata": {...},  // Inference metadata
        "verified": true,
        "file_id": "...",
        "timestamp": 1234567890
    }
    """
    try:
        from flask import current_app
        import json
        import PyPDF2
        
        data = request.get_json()
        if not data:
            abort(400, "JSON data required")
            
        passphrase = data.get('key')
        max_length = data.get('max_length', 150)
        min_length = data.get('min_length', 30)
        
        if not passphrase:
            abort(400, "Encryption key required")
        
        # Get file record
        file_record = _maybe_get_file(file_id)
        if not file_record:
            abort(404, "File not found")
        
        # Check permissions
        address = getattr(request, "address").lower()  # Normalize to lowercase
        if file_record.get('owner') != address:
            abort(403, "Unauthorized: You don't own this file")
        
        current_app.logger.info(f"ZKML summarization requested for file {file_id} by {address}")
        
        # Reconstruct encrypted file path (same as download_file does)
        enc_filename = file_record.get('enc_filename')
        if not enc_filename:
            abort(404, f"No enc_filename in file record for file_id: {file_id}")
        
        # Fetch encrypted blob from S3
        try:
            encrypted_bytes = s3_mod.download_blob(enc_filename)
        except FileNotFoundError:
            current_app.logger.error(f"Encrypted file not found in S3: {enc_filename}")
            abort(404, f"Encrypted file not found in object storage: {enc_filename}")
        
        # Decrypt in-memory via the crypto daemon
        try:
            decrypted_content = crypto_decrypt(encrypted_bytes, passphrase, file_record.get("aad"))
        except CryptoDaemonError:
            current_app.logger.error("Crypto daemon unreachable during ZKML decrypt")
            abort(503, "crypto service unavailable")
        except Exception as e:
            current_app.logger.error(f"Decryption failed: {str(e)}")
            abort(400, f"Decryption failed (bad passphrase or corrupted data): {str(e)}")
        
        # Convert to text based on file type
        filename = file_record.get('original_name', '')
        text_content = ""
        
        if filename.lower().endswith('.pdf'):
            try:
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(decrypted_content))
                text_content = '\n'.join([page.extract_text() for page in pdf_reader.pages])
            except Exception as e:
                current_app.logger.error(f"PDF extraction failed: {str(e)}")
                abort(400, f"Failed to extract text from PDF: {str(e)}")
        elif filename.lower().endswith(('.txt', '.md')):
            try:
                text_content = decrypted_content.decode('utf-8')
            except UnicodeDecodeError:
                text_content = decrypted_content.decode('utf-8', errors='ignore')
        else:
            abort(400, f"Unsupported file type: {filename}")
        
        if not text_content.strip():
            abort(400, "No text content found in document")
        
        current_app.logger.info(f"Extracted {len(text_content)} characters from {filename}")
        
        # Run ZKML inference
        try:
            from ..core.zkml_inference import get_zkml_summarizer
            summarizer = get_zkml_summarizer()
            
            summary, metadata = summarizer.run_inference(
                text_content, 
                max_length=max_length, 
                min_length=min_length
            )
            
            proof = summarizer.generate_zk_proof(text_content, summary, metadata)
            verified = summarizer.verify_inference(text_content, summary, proof)
            
            current_app.logger.info(f"ZKML summary generated: {len(summary)} chars, verified: {verified}")
            
        except Exception as e:
            current_app.logger.error(f"ZKML inference failed: {str(e)}")
            abort(500, f"ZKML inference failed: {str(e)}")
        
        # Return results
        response = {
            "summary": summary,
            "proof": proof,
            "metadata": metadata,
            "verified": verified,
            "file_id": file_id,
            "filename": filename,
            "timestamp": metadata['timestamp']
        }
        
        return response, 200
        
    except Exception as e:
        current_app.logger.error(f'ZKML summary error: {str(e)}')
        current_app.logger.error(traceback.format_exc())
        abort(500, f"Internal server error: {str(e)}")


# ---------------------- On-chain File Access (off-chain index) ----------------------

## On-chain access endpoints removed