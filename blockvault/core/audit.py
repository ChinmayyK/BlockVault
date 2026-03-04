"""Append-only audit event logging.

Every security-sensitive action is recorded in the ``audit_events``
MongoDB collection.  Records are **never** updated or deleted — this
provides a tamper-evident log for compliance and forensic analysis.

Usage::

    from blockvault.core.audit import log_event
    log_event("upload", target_id=file_id, details={"size": 1234})
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

from flask import request

logger = logging.getLogger(__name__)


def _audit_collection():
    from .db import get_db  # noqa: WPS433
    return get_db()["audit_events"]


def log_event(
    action: str,
    *,
    target_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Insert an immutable audit record.

    Parameters
    ----------
    action : one of login, upload, download, share, delete, verify
    target_id : ID of the affected resource (file, share, etc.)
    details : free-form dict with extra context
    """
    try:
        user_id = getattr(request, "address", None)
        ip_address = request.remote_addr
        request_id = getattr(request, "request_id", None)
    except RuntimeError:
        # Outside request context (e.g. Celery worker)
        user_id = None
        ip_address = None
        request_id = None

    doc = {
        "action": action,
        "user_id": user_id,
        "target_id": target_id,
        "timestamp": int(time.time() * 1000),
        "ip_address": ip_address,
        "request_id": request_id,
    }
    if details:
        doc["details"] = details

    try:
        _audit_collection().insert_one(doc)
    except Exception:
        # Audit logging must never crash the request
        logger.warning("Failed to write audit event: %s", action, exc_info=True)
