"""Notifications API blueprint.

Provides endpoints for listing, reading, and managing in-app notifications.
All endpoints require authentication.
"""
from __future__ import annotations

import logging
from flask import Blueprint, request, abort, jsonify

from ..core.security import require_auth
from ..core.validation import sanitize_id
from ..core.notifications import (
    get_notifications,
    mark_read,
    mark_all_read,
)

logger = logging.getLogger(__name__)

bp = Blueprint("notifications", __name__)


@bp.get("/notifications")
@require_auth
def list_notifications():
    """List notifications for the authenticated user.

    Query params:
        unread_only — if "true", only return unread notifications
        limit       — max items (default 50, max 100)
        before      — cursor timestamp (ms) for pagination
    """
    address = getattr(request, "address")
    unread_only = request.args.get("unread_only", "false").lower() == "true"
    limit = min(int(request.args.get("limit", 50)), 100)
    before = request.args.get("before")

    result = get_notifications(
        recipient=address,
        unread_only=unread_only,
        limit=limit,
        before=int(before) if before else None,
    )
    return jsonify(result)


@bp.post("/notifications/<notification_id>/read")
@require_auth
def mark_notification_read(notification_id: str):
    """Mark a single notification as read."""
    notification_id = sanitize_id(notification_id, "notification_id")
    address = getattr(request, "address")
    ok = mark_read(address, notification_id)
    if not ok:
        abort(404, "notification not found")
    return jsonify({"ok": True})


@bp.post("/notifications/read-all")
@require_auth
def mark_all_notifications_read():
    """Mark all notifications as read for the authenticated user."""
    address = getattr(request, "address")
    count = mark_all_read(address)
    return jsonify({"marked_read": count})


@bp.get("/notifications/unread-count")
@require_auth
def unread_count():
    """Quick endpoint for the notification bell badge."""
    address = getattr(request, "address")
    result = get_notifications(recipient=address, unread_only=True, limit=1)
    return jsonify({"unread_count": result["unread_count"]})
