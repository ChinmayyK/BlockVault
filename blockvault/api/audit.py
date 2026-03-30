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
