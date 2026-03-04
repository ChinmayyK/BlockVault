"""Background tasks for IPFS pinning and blockchain anchoring.

Each task is self-contained: it fetches the file record from MongoDB,
performs the I/O-heavy operation, and writes the result back.  A
minimal Flask application context is created so that modules like
``ipfs`` and ``onchain`` (which depend on ``current_app.config``) work
outside the request cycle.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

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
    # Import late to avoid circular imports at module load time.
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
# Tasks
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

        # Resolve file_id (may be ObjectId string)
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


@celery.task(bind=True, max_retries=3, default_retry_delay=30)
def anchor_on_chain(self: Any, file_id: str) -> Dict[str, Any]:
    """Anchor the file's SHA-256 hash on-chain.

    Updates the MongoDB record with ``anchor_tx`` and ``anchor_status``
    (``"complete"`` or ``"failed"``).
    """
    app = _get_app()
    with app.app_context():
        from blockvault.core import onchain as onchain_mod  # noqa: WPS433

        coll = _files_collection()
        rec = _find_record(coll, file_id)
        if rec is None:
            logger.error("anchor_on_chain: file %s not found", file_id)
            return {"file_id": file_id, "anchor_status": "failed", "error": "not found"}

        sha256 = rec.get("sha256")
        size = rec.get("size")
        cid = rec.get("cid")  # may still be None if IPFS task hasn't finished

        if not sha256:
            _set_status(coll, rec, "anchor_status", "failed")
            return {"file_id": file_id, "anchor_status": "failed", "error": "no sha256"}

        try:
            anchor_tx = onchain_mod.anchor_file(sha256, size, cid)
        except Exception as exc:
            logger.warning("anchor_on_chain: failed for %s: %s", file_id, exc)
            try:
                raise self.retry(exc=exc)
            except self.MaxRetriesExceededError:
                _set_status(coll, rec, "anchor_status", "failed")
                return {"file_id": file_id, "anchor_status": "failed", "error": str(exc)}

        coll.update_one(
            {"_id": rec["_id"]},
            {"$set": {"anchor_tx": anchor_tx, "anchor_status": "complete"}},
        )
        logger.info("anchor_on_chain: file %s anchored tx=%s", file_id, anchor_tx)
        return {"file_id": file_id, "anchor_status": "complete", "anchor_tx": anchor_tx}


# ---------------------------------------------------------------------------
# Shared utilities
# ---------------------------------------------------------------------------

def _find_record(coll: Any, file_id: str) -> Optional[Dict[str, Any]]:
    """Look up a file record by string ID (tries ObjectId first)."""
    candidates = []
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


def _set_status(coll: Any, rec: Dict[str, Any], field: str, value: str) -> None:
    """Convenience: set a single status field on a file record."""
    coll.update_one({"_id": rec["_id"]}, {"$set": {field: value}})
