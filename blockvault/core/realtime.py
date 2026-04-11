"""Real-time event infrastructure using Flask-SocketIO.

Provides push-based notifications and presence for BlockVault's collaborative
workflows. Events are broadcast to user-specific and workspace/case rooms.

Architecture:
    - JWT authentication on WebSocket handshake
    - Room-based routing: ``user:<address>``, ``workspace:<id>``, ``case:<id>``
    - Redis message queue for multi-worker consistency (optional, falls back to in-memory)

Usage::

    from blockvault.core.realtime import init_socketio, emit_to_user, emit_to_workspace

    # In app factory:
    socketio = init_socketio(app)

    # From any backend code:
    emit_to_user(address, "file:shared", {...})
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Module-level SocketIO instance (initialized in init_socketio)
_socketio = None


# ---------------------------------------------------------------------------
# Event type constants
# ---------------------------------------------------------------------------

class Events:
    """Canonical event names for the real-time system."""
    FILE_SHARED = "file:shared"
    FILE_UPLOAD_COMPLETE = "file:upload_complete"
    SIGNATURE_REQUESTED = "signature:requested"
    SIGNATURE_COMPLETED = "signature:completed"
    PROOF_PROGRESS = "proof:progress"
    PROOF_COMPLETE = "proof:complete"
    CASE_UPDATED = "case:updated"
    NOTIFICATION_NEW = "notification:new"
    PRESENCE_UPDATE = "presence:update"


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------

def init_socketio(app):
    """Initialize Flask-SocketIO with the Flask app.

    Attempts to use Redis as a message queue for multi-worker support.
    Falls back to in-memory transport if Redis is unavailable.

    Returns the SocketIO instance.
    """
    global _socketio

    try:
        from flask_socketio import SocketIO
    except ImportError:
        logger.warning(
            "flask-socketio not installed — real-time features disabled. "
            "Install with: pip install flask-socketio"
        )
        return None

    # Prefer Redis for cross-worker broadcast
    redis_url = app.config.get("RATELIMIT_STORAGE_URI") or app.config.get("REDIS_URL")
    message_queue = None
    if redis_url and redis_url.startswith("redis://"):
        message_queue = redis_url
        logger.info("SocketIO using Redis message queue: %s", redis_url.split("@")[-1])

    cors_origins = app.config.get("CORS_ALLOWED_ORIGINS", "*")
    if isinstance(cors_origins, str):
        cors_origins = [o.strip() for o in cors_origins.split(",") if o.strip()]

    _socketio = SocketIO(
        app,
        cors_allowed_origins=cors_origins or "*",
        message_queue=message_queue,
        async_mode="threading",
        logger=False,
        engineio_logger=False,
    )

    _register_handlers(_socketio)
    logger.info("SocketIO initialized (async_mode=threading)")
    return _socketio


def get_socketio():
    """Get the current SocketIO instance (may be None if not initialized)."""
    return _socketio


# ---------------------------------------------------------------------------
# JWT auth for WebSocket connections
# ---------------------------------------------------------------------------

def _authenticate_socket(auth_data: Dict[str, Any]) -> Optional[str]:
    """Validate JWT from socket auth payload. Returns wallet address or None."""
    token = None

    if isinstance(auth_data, dict):
        token = auth_data.get("token")
    if not token:
        return None

    try:
        from .security import verify_jwt
        decoded = verify_jwt(token)
        return decoded.get("sub")
    except Exception as exc:
        logger.debug("WebSocket auth failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------

def _register_handlers(sio):
    """Register all SocketIO event handlers."""
    from flask_socketio import emit, join_room, leave_room, disconnect
    from flask import request as flask_request

    @sio.on("connect")
    def handle_connect(auth=None):
        """Authenticate and auto-join user room on connect."""
        address = _authenticate_socket(auth or {})
        if not address:
            logger.debug("WebSocket connection rejected: auth failed")
            return False  # Reject connection

        address = address.lower()
        flask_request.address = address  # type: ignore[attr-defined]

        # Auto-join user-specific room
        user_room = f"user:{address}"
        join_room(user_room)
        logger.info("WebSocket connected: %s (room=%s)", address, user_room)

        # Notify presence
        emit("connected", {"address": address, "room": user_room})

    @sio.on("disconnect")
    def handle_disconnect():
        address = getattr(flask_request, "address", "unknown")
        logger.info("WebSocket disconnected: %s", address)

    @sio.on("join")
    def handle_join(data):
        """Join a room (workspace, case, etc.)."""
        room = data.get("room", "") if isinstance(data, dict) else ""
        if not room or not isinstance(room, str):
            return

        # Validate room format: must be type:id
        if ":" not in room:
            return

        room_type, room_id = room.split(":", 1)
        if room_type not in ("workspace", "case"):
            return

        # TODO: verify membership before allowing room join
        join_room(room)
        address = getattr(flask_request, "address", "unknown")
        logger.debug("User %s joined room %s", address, room)
        emit("room:joined", {"room": room})

    @sio.on("leave")
    def handle_leave(data):
        """Leave a room."""
        room = data.get("room", "") if isinstance(data, dict) else ""
        if room:
            leave_room(room)
            emit("room:left", {"room": room})

    @sio.on("ping")
    def handle_ping():
        """Keep-alive ping."""
        emit("pong", {"ts": __import__("time").time()})


# ---------------------------------------------------------------------------
# Emission helpers — call from anywhere in the backend
# ---------------------------------------------------------------------------

def emit_to_user(address: str, event: str, data: Dict[str, Any]) -> None:
    """Emit an event to a specific user's room."""
    if not _socketio:
        return
    room = f"user:{address.lower()}"
    try:
        _socketio.emit(event, data, room=room)
        logger.debug("Emitted %s to %s", event, room)
    except Exception as exc:
        logger.warning("Failed to emit %s to %s: %s", event, room, exc)


def emit_to_workspace(workspace_id: str, event: str, data: Dict[str, Any]) -> None:
    """Emit an event to all users in a workspace room."""
    if not _socketio:
        return
    room = f"workspace:{workspace_id}"
    try:
        _socketio.emit(event, data, room=room)
    except Exception as exc:
        logger.warning("Failed to emit %s to %s: %s", event, room, exc)


def emit_to_case(case_id: str, event: str, data: Dict[str, Any]) -> None:
    """Emit an event to all users viewing a case."""
    if not _socketio:
        return
    room = f"case:{case_id}"
    try:
        _socketio.emit(event, data, room=room)
    except Exception as exc:
        logger.warning("Failed to emit %s to %s: %s", event, room, exc)


def broadcast(event: str, data: Dict[str, Any]) -> None:
    """Broadcast an event to all connected clients."""
    if not _socketio:
        return
    try:
        _socketio.emit(event, data)
    except Exception as exc:
        logger.warning("Failed to broadcast %s: %s", event, exc)
