"""Notification store — MongoDB-backed notification persistence.

Handles creation, retrieval, and read-status management of in-app
notifications for BlockVault users.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from blockvault.core.db import get_db

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Collection + indexes
# ---------------------------------------------------------------------------

def _notifications_coll():
    db = get_db()
    return db["notifications"]


def ensure_notification_indexes():
    """Create indexes for the notifications collection (idempotent)."""
    try:
        coll = _notifications_coll()
        coll.create_index(
            [("recipient", 1), ("created_at", -1)],
            name="idx_notif_recipient_time",
            background=True,
        )
        coll.create_index(
            [("recipient", 1), ("read", 1)],
            name="idx_notif_recipient_read",
            background=True,
        )
        logger.info("Notification indexes ensured.")
    except Exception as exc:
        logger.warning("Failed to create notification indexes: %s", exc)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

VALID_TYPES = {
    "file_shared",
    "signature_requested",
    "signature_completed",
    "case_update",
    "key_rotated",
    "system",
}

VALID_CHANNELS = {"product", "blockchain", "legal", "security"}


def create_notification(
    recipient: str,
    title: str,
    message: str,
    notif_type: str = "system",
    channel: str = "product",
    link: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> dict[str, Any]:
    """Create a notification for a user.

    Args:
        recipient: wallet address of the recipient
        title: short notification title
        message: notification body
        notif_type: one of VALID_TYPES
        channel: one of VALID_CHANNELS (maps to user preferences)
        link: optional in-app link (e.g. "/files/abc123")
        metadata: optional extra data

    Returns:
        The created notification document.
    """
    now = int(datetime.utcnow().timestamp() * 1000)
    notif = {
        "id": str(uuid.uuid4()),
        "recipient": recipient.lower(),
        "title": title,
        "message": message,
        "type": notif_type if notif_type in VALID_TYPES else "system",
        "channel": channel if channel in VALID_CHANNELS else "product",
        "link": link,
        "metadata": metadata or {},
        "read": False,
        "created_at": now,
    }
    _notifications_coll().insert_one(notif)
    logger.debug("Notification created for %s: %s", recipient, title)
    return _serialize(notif)


def get_notifications(
    recipient: str,
    unread_only: bool = False,
    limit: int = 50,
    before: Optional[int] = None,
) -> dict[str, Any]:
    """Fetch notifications for a user.

    Returns:
        {"notifications": [...], "unread_count": N, "total": N}
    """
    query: dict = {"recipient": recipient.lower()}
    if unread_only:
        query["read"] = False
    if before:
        query["created_at"] = {"$lt": before}

    coll = _notifications_coll()
    docs = list(
        coll.find(query)
        .sort("created_at", -1)
        .limit(min(limit, 100))
    )

    unread_count = coll.count_documents({"recipient": recipient.lower(), "read": False})

    return {
        "notifications": [_serialize(d) for d in docs],
        "unread_count": unread_count,
        "total": len(docs),
    }


def mark_read(recipient: str, notification_id: str) -> bool:
    """Mark a single notification as read."""
    result = _notifications_coll().update_one(
        {"id": notification_id, "recipient": recipient.lower()},
        {"$set": {"read": True}},
    )
    return result.modified_count > 0


def mark_all_read(recipient: str) -> int:
    """Mark all notifications as read for a user. Returns count updated."""
    result = _notifications_coll().update_many(
        {"recipient": recipient.lower(), "read": False},
        {"$set": {"read": True}},
    )
    return result.modified_count


# ---------------------------------------------------------------------------
# Convenience dispatchers
# ---------------------------------------------------------------------------

def notify_file_shared(recipient: str, sender: str, file_name: str, file_id: str):
    """Dispatch a notification when a file is shared."""
    sender_short = f"{sender[:6]}…{sender[-4:]}" if len(sender) > 10 else sender
    create_notification(
        recipient=recipient,
        title="File Shared With You",
        message=f"{sender_short} shared '{file_name}' with you.",
        notif_type="file_shared",
        channel="product",
        link=f"/files?highlight={file_id}",
        metadata={"sender": sender, "file_id": file_id, "file_name": file_name},
    )


def notify_signature_requested(recipient: str, requester: str, doc_name: str, doc_id: str):
    """Dispatch a notification when a signature is requested."""
    requester_short = f"{requester[:6]}…{requester[-4:]}" if len(requester) > 10 else requester
    create_notification(
        recipient=recipient,
        title="Signature Requested",
        message=f"{requester_short} requests your signature on '{doc_name}'.",
        notif_type="signature_requested",
        channel="legal",
        link=f"/legal/signatures?doc={doc_id}",
        metadata={"requester": requester, "doc_id": doc_id, "doc_name": doc_name},
    )


def notify_case_update(recipient: str, case_title: str, case_id: str, update_type: str = "updated"):
    """Dispatch a notification for case updates."""
    create_notification(
        recipient=recipient,
        title=f"Case {update_type.title()}",
        message=f"Case '{case_title}' has been {update_type}.",
        notif_type="case_update",
        channel="legal",
        link=f"/legal/cases/{case_id}",
        metadata={"case_id": case_id, "update_type": update_type},
    )


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def _serialize(doc: dict) -> dict:
    """Convert a MongoDB document to a JSON-safe dict."""
    doc.pop("_id", None)
    return doc
