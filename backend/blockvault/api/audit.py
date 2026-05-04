import logging
from flask import Blueprint, jsonify
from blockvault.core.security import require_auth
from blockvault.core.audit import _audit_collection
from blockvault.core.merkle_tree import MerkleLog

logger = logging.getLogger(__name__)

audit_bp = Blueprint("audit", __name__, url_prefix="/audit")

@audit_bp.route("/root", methods=["GET"])
def get_root():
    """Returns the current global Merkle Root of all audit events."""
    try:
        log = MerkleLog()
        return jsonify({"root": log.get_root()})
    except Exception as e:
        logger.error("Failed to compute Merkle root", exc_info=True)
        return jsonify({"error": "Failed to compute root"}), 500

@audit_bp.route("/logs", methods=["GET"])
@require_auth
def get_logs():
    """Returns the most recent audit logs for display in the dashboard."""
    try:
        coll = _audit_collection()
        # In a real system we'd paginate, here we return the last 100
        events = list(coll.find().sort("timestamp", -1).limit(100))
        for e in events:
            e["_id"] = str(e["_id"])
        return jsonify({"events": events})
    except Exception as e:
        logger.error("Failed to fetch audit logs", exc_info=True)
        return jsonify({"error": "Failed to fetch logs"}), 500

@audit_bp.route("/proof/<entry_hash>", methods=["GET"])
@require_auth
def get_proof(entry_hash):
    """Returns the sibling hash path required to cryptographically verify an event."""
    try:
        coll = _audit_collection()
        event = coll.find_one({"entry_hash": entry_hash})
        
        if not event or "leaf_index" not in event:
            return jsonify({"error": "Event not found or has no Merkle index"}), 404
            
        log = MerkleLog()
        proof = log.get_proof(event["leaf_index"])
        
        # Strip _id object before returning
        safe_event = {k: v for k, v in event.items() if k != "_id"}
        
        return jsonify({
            "event": safe_event,
            "proof": proof,
            "leaf_index": event["leaf_index"]
        })
    except Exception as e:
        logger.error(f"Failed to generate Merkle proof for {entry_hash}", exc_info=True)
        return jsonify({"error": "Failed to generate proof"}), 500


@audit_bp.route("/recent", methods=["GET"])
@require_auth
def get_recent_activity():
    """Return recent audit events for the live activity feed.

    Query params:
        limit  — max events to return (default 20, max 100)
        types  — comma-separated action types to include (e.g. upload,share,download)
        before — cursor timestamp (ms) for pagination
    """
    from flask import request

    try:
        coll = _audit_collection()

        # Parse params
        limit = min(int(request.args.get("limit", 20)), 100)
        types_param = request.args.get("types", "")
        before = request.args.get("before")
        workspace_id = request.args.get("workspace_id")

        query: dict = {}
        if types_param:
            type_list = [t.strip() for t in types_param.split(",") if t.strip()]
            if type_list:
                query["action"] = {"$in": type_list}

        if before:
            query["timestamp"] = {"$lt": int(before)}
            
        if workspace_id:
            query["details.workspace_id"] = workspace_id

        events = list(
            coll.find(query)
            .sort("timestamp", -1)
            .limit(limit)
        )

        # Serialize for JSON
        serialized = []
        for e in events:
            e["_id"] = str(e["_id"])
            # Map to frontend-friendly shape
            serialized.append({
                "id": e["_id"],
                "action": e.get("action", "unknown"),
                "user_address": e.get("user_id", ""),
                "user_name": _shorten_address(e.get("user_id", "")),
                "target": e.get("target_id", ""),
                "details": e.get("details", {}),
                "timestamp": e.get("timestamp", 0),
                "iconType": _map_action_to_icon(e.get("action", "")),
            })

        # Include cursor for next page
        next_cursor = serialized[-1]["timestamp"] if serialized else None

        return jsonify({
            "events": serialized,
            "total": len(serialized),
            "next_cursor": next_cursor,
        })
    except Exception as e:
        logger.error("Failed to fetch recent activity", exc_info=True)
        return jsonify({"error": "Failed to fetch activity"}), 500


def _shorten_address(addr: str) -> str:
    """0x1234...abcd display format."""
    if not addr or len(addr) < 10:
        return addr or "System"
    return f"{addr[:6]}…{addr[-4:]}"


def _map_action_to_icon(action: str) -> str:
    """Map audit action strings to frontend icon types."""
    mapping = {
        "upload": "upload",
        "download": "download",
        "share_create": "upload",
        "share_revoke": "upload",
        "redact": "redact",
        "verify": "proof",
        "anchor": "proof",
        "login": "certificate",
        "delete": "upload",
        "sign": "certificate",
    }
    return mapping.get(action, "upload")
