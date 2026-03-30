"""Background tasks for IPFS pinning and Merkle-batched blockchain anchoring.

Each task is self-contained: it fetches records from MongoDB,
performs the I/O-heavy operation, and writes the result back.  A
minimal Flask application context is created so that modules like
``ipfs`` and ``onchain`` (which depend on ``current_app.config``) work
outside the request cycle.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from .celery_app import celery

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers — lightweight Flask context for config access
# ---------------------------------------------------------------------------

def _make_app():
    """Create a throwaway Flask app so that ``current_app.config`` is
    available inside Celery workers.  The app is cached on the module to
    avoid re-init on every task invocation.
    """
    from blockvault import create_app  # noqa: WPS433
    return create_app()


_app = None


def _get_app():
    global _app  # noqa: PLW0603
    if _app is None:
        _app = _make_app()
    return _app


def _files_collection():
    from blockvault.core.db import get_db  # noqa: WPS433
    return get_db()["files"]


# ---------------------------------------------------------------------------
# IPFS pinning (per-file, enqueued on upload)
# ---------------------------------------------------------------------------

@celery.task(bind=True, max_retries=3, default_retry_delay=30)
def pin_to_ipfs(self: Any, file_id: str) -> Dict[str, Any]:
    """Pin the encrypted blob for *file_id* to IPFS.

    Updates the MongoDB record with ``cid``, ``gateway_url``, and
    ``ipfs_status`` (``"complete"`` or ``"failed"``).
    """
    app = _get_app()
    with app.app_context():
        from blockvault.core import s3 as s3_mod  # noqa: WPS433
        from blockvault.core import ipfs as ipfs_mod  # noqa: WPS433

        coll = _files_collection()

        rec = _find_record(coll, file_id)
        if rec is None:
            logger.error("pin_to_ipfs: file %s not found", file_id)
            return {"file_id": file_id, "ipfs_status": "failed", "error": "not found"}

        enc_filename = rec.get("enc_filename")
        if not enc_filename:
            _set_status(coll, rec, "ipfs_status", "failed")
            return {"file_id": file_id, "ipfs_status": "failed", "error": "no enc_filename"}

        try:
            encrypted_bytes = s3_mod.download_blob(enc_filename)
        except Exception as exc:
            logger.warning("pin_to_ipfs: S3 download failed for %s: %s", file_id, exc)
            _set_status(coll, rec, "ipfs_status", "failed")
            return {"file_id": file_id, "ipfs_status": "failed", "error": str(exc)}

        try:
            cid = ipfs_mod.add_bytes(encrypted_bytes) if hasattr(ipfs_mod, "add_bytes") else None
            if cid is None:
                raise RuntimeError("add_bytes returned None")
        except Exception as exc:
            logger.warning("pin_to_ipfs: IPFS add failed for %s: %s", file_id, exc)
            try:
                raise self.retry(exc=exc)
            except self.MaxRetriesExceededError:
                _set_status(coll, rec, "ipfs_status", "failed")
                return {"file_id": file_id, "ipfs_status": "failed", "error": str(exc)}

        gateway = ipfs_mod.gateway_url(cid) if cid else None
        coll.update_one(
            {"_id": rec["_id"]},
            {"$set": {"cid": cid, "gateway_url": gateway, "ipfs_status": "complete"}},
        )
        logger.info("pin_to_ipfs: file %s pinned as %s", file_id, cid)
        return {"file_id": file_id, "ipfs_status": "complete", "cid": cid}


# ---------------------------------------------------------------------------
# ZK redaction proof generation (async)
# ---------------------------------------------------------------------------

@celery.task(bind=True, max_retries=2, default_retry_delay=60)
def generate_redaction_proof_task(self: Any, file_id: str) -> Dict[str, Any]:
    """Generate ZK redaction proofs asynchronously from stored inputs."""
    app = _get_app()
    with app.app_context():
        from blockvault.core import s3 as s3_mod  # noqa: WPS433
        from blockvault.core import onchain as onchain_mod  # noqa: WPS433
        from blockvault.core.zk_redaction import (
            generate_redaction_proof_from_inputs,
            is_snarkjs_ready,
            redaction_proof_key,
        )  # noqa: WPS433

        coll = _files_collection()
        rec = _find_record(coll, file_id)
        if rec is None:
            logger.error("redaction_proof: file %s not found", file_id)
            return {"file_id": file_id, "status": "failed", "error": "not found"}

        if rec.get("redaction_status") != "pending":
            return {"file_id": file_id, "status": rec.get("redaction_status", "unknown")}

        inputs_key = rec.get("redaction_inputs_location")
        if not inputs_key:
            _set_status(coll, rec, "redaction_status", "failed")
            coll.update_one(
                {"_id": rec["_id"]},
                {"$set": {"redaction_error": "missing inputs", "redaction_progress": None}},
            )
            return {"file_id": file_id, "status": "failed", "error": "missing inputs"}

        if not is_snarkjs_ready():
            error = (
                "zk redaction runtime not ready "
                "(missing node_modules or circuit artifacts in zk/redaction)"
            )
            _set_status(coll, rec, "redaction_status", "failed")
            coll.update_one(
                {"_id": rec["_id"]},
                {"$set": {"redaction_error": error, "redaction_progress": None}},
            )
            return {"file_id": file_id, "status": "failed", "error": error}

        try:
            inputs_blob = s3_mod.download_blob(inputs_key)
            inputs = json.loads(inputs_blob.decode("utf-8"))
        except Exception as exc:
            _set_status(coll, rec, "redaction_status", "failed")
            coll.update_one(
                {"_id": rec["_id"]},
                {"$set": {"redaction_error": str(exc), "redaction_progress": None}},
            )
            return {"file_id": file_id, "status": "failed", "error": str(exc)}

        def _on_progress(current: int, total: int):
            try:
                coll.update_one(
                    {"_id": rec["_id"]},
                    {"$set": {"redaction_progress": {"current": current, "total": total}}}
                )
            except Exception as e:
                logger.warning("Failed to update redaction progress for %s: %s", file_id, e)

        try:
            proof_bundle = generate_redaction_proof_from_inputs(inputs, progress_callback=_on_progress)
        except Exception as exc:
            try:
                raise self.retry(exc=exc)
            except self.MaxRetriesExceededError:
                _set_status(coll, rec, "redaction_status", "failed")
                coll.update_one(
                    {"_id": rec["_id"]},
                    {"$set": {"redaction_error": str(exc), "redaction_progress": None}},
                )
                return {"file_id": file_id, "status": "failed", "error": str(exc)}

        proof_package = proof_bundle.get("proof_package", {})
        metadata = proof_bundle.get("metadata", {})
        proof_location = redaction_proof_key(file_id)

        try:
            s3_mod.upload_blob(proof_location, json.dumps(proof_package).encode("utf-8"))
        except Exception as exc:
            _set_status(coll, rec, "redaction_status", "failed")
            coll.update_one(
                {"_id": rec["_id"]},
                {"$set": {"redaction_error": str(exc), "redaction_progress": None}},
            )
            return {"file_id": file_id, "status": "failed", "error": str(exc)}

        # Anchor redaction proof commitment on-chain (best-effort)
        anchor_hash = metadata.get("anchor_hash")
        anchor_tx = None
        if anchor_hash:
            try:
                anchor_tx = onchain_mod.anchor_redaction_proof(anchor_hash)
            except Exception:
                anchor_tx = None

        existing_proof = rec.get("redaction_proof") or {}
        existing_proof.update(
            {
                "proof_hash": metadata.get("proof_hash"),
                "proof_location": proof_location,
                "original_root": metadata.get("original_root"),
                "redacted_root": metadata.get("redacted_root"),
                "chunk_size": metadata.get("chunk_size"),
                "block_size": metadata.get("block_size"),
                "chunk_count": metadata.get("chunk_count"),
                "modified_chunks": metadata.get("modified_chunks"),
                "anchor_hash": anchor_hash,
            }
        )

        update = {
            "redaction_status": "complete",
            "redaction_proof": existing_proof,
            "redaction_anchor_tx": anchor_tx,
            "redaction_inputs_location": None,
            "redaction_error": None,
            "redaction_progress": {
                "current": len(metadata.get("modified_chunks") or []),
                "total": len(metadata.get("modified_chunks") or []),
            },
        }
        coll.update_one({"_id": rec["_id"]}, {"$set": update})

        # Best-effort cleanup of inputs blob
        try:
            s3_mod.delete_blob(inputs_key)
        except Exception:
            pass

        try:
            from blockvault.core.audit import log_event
            log_event("proof_generation", target_id=file_id, details={"user_id": rec.get("owner"), "tx": anchor_tx})
        except Exception as exc:
            logger.warning("Failed to log proof_generation event: %s", exc)

        logger.info("redaction_proof: generated proof for %s", file_id)
        return {"file_id": file_id, "status": "complete", "proof_location": proof_location}


# ---------------------------------------------------------------------------
# Merkle-batched blockchain anchoring (periodic)
# ---------------------------------------------------------------------------

@celery.task(bind=True, max_retries=2, default_retry_delay=60)
def batch_anchor(self: Any) -> Dict[str, Any]:
    """Collect all unanchored file hashes, build a Merkle tree, and
    anchor the root on-chain.

    Each file record is updated with:
      - ``merkle_root``   — hex root of the batch tree
      - ``merkle_proof``  — list of {hash, position} inclusion proof steps
      - ``anchor_tx``     — on-chain transaction hash
      - ``anchor_status`` — "complete" or "failed"

    Runs as a Celery Beat periodic task (default: daily).
    """
    app = _get_app()
    with app.app_context():
        from blockvault.core import onchain as onchain_mod  # noqa: WPS433
        from blockvault.core.merkle import MerkleTree  # noqa: WPS433

        coll = _files_collection()

        # Gather all files waiting for anchoring
        pending = list(coll.find({"anchor_status": "pending", "sha256": {"$ne": None}}))
        if not pending:
            logger.info("batch_anchor: no pending files")
            return {"anchored": 0}

        # De-duplicate sha256 values while preserving file list
        leaf_hashes: List[str] = []
        seen: set[str] = set()
        for rec in pending:
            h = rec["sha256"]
            if h not in seen:
                leaf_hashes.append(h)
                seen.add(h)

        # §4 — Merkle duplicate protection: skip already-anchored hashes
        from blockvault.core.db import get_db
        db = get_db()
        anchored_coll = db["anchored_hashes"]
        already_anchored = set()
        try:
            existing = anchored_coll.find(
                {"sha256": {"$in": leaf_hashes}},
                {"sha256": 1},
            )
            already_anchored = {r["sha256"] for r in existing}
        except Exception:
            pass  # collection may not exist yet

        leaf_hashes = [h for h in leaf_hashes if h not in already_anchored]
        pending = [r for r in pending if r["sha256"] not in already_anchored]

        if not leaf_hashes:
            logger.info("batch_anchor: all hashes already anchored")
            return {"anchored": 0, "skipped_duplicates": len(already_anchored)}

        # Single-leaf edge case: Merkle tree still works (root == leaf)
        tree = MerkleTree.build(leaf_hashes)
        merkle_root = tree.root

        # Anchor the Merkle root on-chain (single transaction for entire batch)
        try:
            anchor_tx = onchain_mod.anchor_merkle_root(merkle_root, len(pending))
        except Exception as exc:
            logger.warning("batch_anchor: on-chain anchor failed: %s", exc)
            try:
                raise self.retry(exc=exc)
            except self.MaxRetriesExceededError:
                # Mark all as failed
                ids = [r["_id"] for r in pending]
                coll.update_many(
                    {"_id": {"$in": ids}},
                    {"$set": {"anchor_status": "failed"}},
                )
                return {"anchored": 0, "error": str(exc)}

        # Update each file record with its proof
        for rec in pending:
            sha = rec["sha256"]
            try:
                proof = tree.proof_dicts(sha)
            except ValueError:
                proof = []
            coll.update_one(
                {"_id": rec["_id"]},
                {"$set": {
                    "merkle_root": merkle_root,
                    "merkle_proof": proof,
                    "anchor_tx": anchor_tx,
                    "anchor_status": "complete",
                }},
            )
            
            try:
                from blockvault.core.audit import log_event
                log_event("blockchain_anchor", target_id=str(rec["_id"]), details={"user_id": rec.get("owner"), "tx": anchor_tx})
            except Exception as exc:
                logger.warning("Failed to log blockchain_anchor event: %s", exc)

        # §4 — Record anchored hashes for dedup
        try:
            anchored_coll.insert_many(
                [{"sha256": h, "merkle_root": merkle_root, "anchor_tx": anchor_tx} for h in leaf_hashes],
                ordered=False,
            )
        except Exception:
            pass  # best effort — index will prevent exact duplicates

        logger.info(
            "batch_anchor: anchored %d files, root=%s, tx=%s",
            len(pending), merkle_root, anchor_tx,
        )
        return {"anchored": len(pending), "merkle_root": merkle_root, "anchor_tx": anchor_tx}


# ---------------------------------------------------------------------------
# §7 — Audit chain anchoring (periodic)
# ---------------------------------------------------------------------------

@celery.task(bind=True, max_retries=1, default_retry_delay=120)
def anchor_audit_chain(self: Any) -> Dict[str, Any]:
    """Hash the latest audit entry and anchor it on-chain.

    Runs hourly via Celery Beat.  Provides external proof that
    the audit log was not tampered with between anchoring points.
    """
    app = _get_app()
    with app.app_context():
        from blockvault.core import onchain as onchain_mod  # noqa: WPS433
        import hashlib
        from blockvault.core.db import get_db

        db = get_db()
        last_entry = db["audit_events"].find_one(sort=[("timestamp", -1)])
        if not last_entry:
            return {"status": "no_entries"}

        entry_hash = last_entry.get("entry_hash", "")
        if not entry_hash:
            return {"status": "no_hash"}

        # Anchor the audit chain hash as a pseudo-file hash
        chain_hash = hashlib.sha256(f"audit_chain::{entry_hash}".encode()).hexdigest()
        try:
            tx = onchain_mod.anchor_file(chain_hash, 0, f"audit_chain::{last_entry.get('timestamp', 0)}")
        except Exception as exc:
            logger.warning("anchor_audit_chain failed: %s", exc)
            return {"status": "failed", "error": str(exc)}

        # Store the anchor reference
        db["audit_anchors"].insert_one({
            "entry_hash": entry_hash,
            "chain_hash": chain_hash,
            "anchor_tx": tx,
            "timestamp": last_entry.get("timestamp"),
        })

        logger.info("audit chain anchored: tx=%s", tx)
        return {"status": "anchored", "anchor_tx": tx}


# ---------------------------------------------------------------------------
# Shared utilities
# ---------------------------------------------------------------------------

def _find_record(coll: Any, file_id: str) -> Optional[Dict[str, Any]]:
    """Look up a file record by string ID (tries ObjectId first)."""
    candidates = []
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        candidates.append(ObjectId(file_id))
    except InvalidId:
        pass
    except Exception:
        pass
    candidates.append(file_id)
    for candidate in candidates:
        rec = coll.find_one({"_id": candidate})
        if rec:
            return rec
    return None


def _set_status(coll: Any, rec: Dict[str, Any], field: str, value: str) -> None:
    """Convenience: set a single status field on a file record."""
    coll.update_one({"_id": rec["_id"]}, {"$set": {field: value}})

# ---------------------------------------------------------------------------
# Async Analysis (OCR / Risk Scan)
# ---------------------------------------------------------------------------

@celery.task(bind=True, max_retries=1, default_retry_delay=10)
def analyze_redaction_async_task(self, file_id: str, key: str, org_id: str, owner: str, canonical_id: str):
    app = _get_app()
    with app.app_context():
        import requests
        from flask import current_app
        from blockvault.api.files import _decrypt_file_bytes, _lookup_file, _calculate_risk_score

        coll = _files_collection()
        rec, _ = _lookup_file(file_id)
        if not rec:
            return

        try:
            decrypted_bytes = _decrypt_file_bytes(rec, key)
            filename = rec.get("original_name", "document.bin")

            compliance_profile = None
            profile_name = None
            if org_id:
                try:
                    from blockvault.core.organizations import OrganizationStore
                    from blockvault.core.compliance_profiles import ComplianceProfileStore
                    org_store = OrganizationStore()
                    profile_name = org_store.get_compliance_profile(org_id)
                    if profile_name:
                        profile_store = ComplianceProfileStore()
                        compliance_profile = profile_store.get_profile_by_name(profile_name)
                except Exception as exc:
                    logger.warning("Failed to load compliance profile: %s", exc)

            redactor_url = current_app.config.get("REDACTOR_SERVICE_URL")
            entities = []
            if redactor_url:
                try:
                    resp = requests.post(
                        f"{redactor_url}/analyze",
                        files={"file": (filename, decrypted_bytes)},
                        timeout=30,
                    )
                    resp.raise_for_status()
                    entities = resp.json().get("entities", [])
                except Exception as exc:
                    logger.warning("External redactor unavailable (%s)", exc)

            if not entities:
                from blockvault.core.inline_redactor import analyze_pdf_bytes
                entities = analyze_pdf_bytes(
                    decrypted_bytes,
                    org_id=org_id,
                    compliance_profile=compliance_profile,
                )

            try:
                from blockvault.core.audit import log_event
                log_event("entity_detection", target_id=canonical_id, details={"user_id": owner, "count": len(entities)})
            except Exception as exc:
                logger.warning("Failed to log entity_detection event: %s", exc)

            risk_report = _calculate_risk_score(entities)
            if profile_name:
                risk_report["profile_name"] = profile_name
                detection_counts = {}
                for entity in entities:
                    entity_type = entity.get("entity_type", "UNKNOWN").upper()
                    detection_counts[entity_type] = detection_counts.get(entity_type, 0) + 1
                risk_report["detection_counts"] = detection_counts

            try:
                from blockvault.core.audit import log_event
                log_event("risk_scan", target_id=canonical_id, details={"user_id": owner, "risk_level": risk_report.get("risk_level")})
                if profile_name:
                    log_event(
                        action="compliance_scan",
                        target_id=canonical_id,
                        details={
                            "user_id": owner,
                            "profile_name": profile_name,
                            "detection_counts": risk_report.get("detection_counts", {}),
                            "total_detections": len(entities),
                        },
                    )
            except Exception as exc:
                logger.warning("Failed to log scan events: %s", exc)

            coll.update_one(
                {"_id": rec["_id"]},
                {
                    "$set": {
                        "analysis_status": "complete",
                        "analysis_result": {"entities": entities, "risk_report": risk_report},
                        "risk_scan": risk_report
                    }
                }
            )

        except Exception as e:
            logger.error("analyze_redaction_async_task failed: %s", e)
            coll.update_one(
                {"_id": rec["_id"]},
                {
                    "$set": {
                        "analysis_status": "failed",
                        "analysis_error": str(e)
                    }
                }
            )
