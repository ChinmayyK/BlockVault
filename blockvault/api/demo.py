import uuid
import time
from datetime import datetime
from flask import Blueprint, jsonify, request

bp = Blueprint('demo', __name__)

# ---------------------------------------------------------------------------
# Mock Data
# ---------------------------------------------------------------------------

_MOCK_FILES = [
    {
        "id": "demo-file-01",
        "file_id": "demo-file-01",
        "name": "employment_contract.pdf",
        "file_name": "employment_contract.pdf",
        "size": 1245000,
        "file_size": 1245000,
        "mime_type": "application/pdf",
        "created_at": "2024-05-12T09:15:00Z",
        "uploader_address": "demo_user",
        "is_redacted": True,
        "redactions_applied": 14,
        "security_score": 92,
        "proof_verified": True,
        "blockchain_anchor": True,
        "tx_hash": "0x8fB32c9...ae21",
        "ipfs_cid": "QmXZ7d...kP9L",
        "timeline": [
            {"event_type": "upload", "timestamp": "2024-05-12T09:15:00Z", "description": "Document uploaded securely"},
            {"event_type": "analyze", "timestamp": "2024-05-12T09:16:12Z", "description": "AI analysis complete. Found 14 PII instances"},
            {"event_type": "redact", "timestamp": "2024-05-12T09:20:05Z", "description": "Applied 14 redactions securely"},
            {"event_type": "zk_proof", "timestamp": "2024-05-12T09:21:40Z", "description": "Generated Circom zero-knowledge proof"},
            {"event_type": "anchor", "timestamp": "2024-05-12T09:25:11Z", "description": "Anchored validity proof to blockchain anchor"}
        ],
        "compliance_violations": 0
    },
    {
        "id": "demo-file-02",
        "file_id": "demo-file-02",
        "name": "medical_record.pdf",
        "file_name": "medical_record.pdf",
        "size": 3482000,
        "file_size": 3482000,
        "mime_type": "application/pdf",
        "created_at": "2024-06-01T14:30:22Z",
        "uploader_address": "demo_user",
        "is_redacted": False,
        "redactions_applied": 0,
        "security_score": 45,
        "proof_verified": False,
        "blockchain_anchor": False,
        "timeline": [
            {"event_type": "upload", "timestamp": "2024-06-01T14:30:22Z", "description": "Document uploaded securely"},
            {"event_type": "analyze", "timestamp": "2024-06-01T14:32:05Z", "description": "AI analysis complete. Found 28 PII instances. Action required."}
        ],
        "compliance_violations": 4
    },
    {
        "id": "demo-file-03",
        "file_id": "demo-file-03",
        "name": "legal_statement.pdf",
        "file_name": "legal_statement.pdf",
        "size": 512000,
        "file_size": 512000,
        "mime_type": "application/pdf",
        "created_at": "2024-06-15T11:45:10Z",
        "uploader_address": "demo_user",
        "is_redacted": True,
        "redactions_applied": 6,
        "security_score": 100,
        "proof_verified": True,
        "blockchain_anchor": True,
        "tx_hash": "0x4A1F...9b2C",
        "ipfs_cid": "QmY5m...zX1Q",
        "timeline": [
            {"event_type": "upload", "timestamp": "2024-06-15T11:45:10Z", "description": "Document uploaded securely"},
            {"event_type": "analyze", "timestamp": "2024-06-15T11:46:02Z", "description": "AI analysis complete. Found 6 PII instances"},
            {"event_type": "redact", "timestamp": "2024-06-15T11:48:33Z", "description": "Applied 6 redactions securely"},
            {"event_type": "zk_proof", "timestamp": "2024-06-15T11:50:11Z", "description": "Generated Circom zero-knowledge proof"},
            {"event_type": "anchor", "timestamp": "2024-06-15T11:51:00Z", "description": "Anchored validity proof to blockchain anchor"}
        ],
        "compliance_violations": 0
    }
]

_MOCK_ENTITIES = {
    "demo-file-01": [
        {"id": "ent-1", "text": "John Doe", "entity_type": "PERSON", "page": 1, "bbox": [100, 150, 180, 165], "score": 0.98, "group_id": "g-john"},
        {"id": "ent-2", "text": "John Doe", "entity_type": "PERSON", "page": 2, "bbox": [100, 200, 180, 215], "score": 0.98, "group_id": "g-john"},
        {"id": "ent-3", "text": "555-0198", "entity_type": "PHONE", "page": 1, "bbox": [200, 150, 270, 165], "score": 0.92},
        {"id": "ent-4", "text": "john.doe@example.com", "entity_type": "EMAIL", "page": 1, "bbox": [100, 170, 250, 185], "score": 0.99},
        {"id": "ent-5", "text": "123 Main St, Anytown", "entity_type": "ADDRESS", "page": 2, "bbox": [100, 240, 280, 255], "score": 0.88},
    ],
    "demo-file-02": [
        {"id": "ent-6", "text": "Jane Smith", "entity_type": "PERSON", "page": 1, "bbox": [120, 100, 220, 115], "score": 0.99, "group_id": "g-jane"},
        {"id": "ent-7", "text": "Jane Smith", "entity_type": "PERSON", "page": 1, "bbox": [120, 300, 220, 315], "score": 0.99, "group_id": "g-jane"},
        {"id": "ent-8", "text": "SSN: 000-00-0000", "entity_type": "ID_NUM", "page": 1, "bbox": [120, 150, 260, 165], "score": 0.95},
        {"id": "ent-9", "text": "jane.smith@medical.org", "entity_type": "EMAIL", "page": 1, "bbox": [120, 180, 300, 195], "score": 0.96},
    ],
    "demo-file-03": [
         {"id": "ent-10", "text": "Acme Corp", "entity_type": "ORGANIZATION", "page": 1, "bbox": [150, 100, 250, 115], "score": 0.85},
         {"id": "ent-11", "text": "Confidential Settlement", "entity_type": "FINANCIAL", "page": 1, "bbox": [150, 140, 320, 155], "score": 0.78},
    ]
}

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@bp.route('/files', methods=['GET'])
def list_demo_files():
    """Return the mocked files for the demo environment."""
    return jsonify({
        "files": _MOCK_FILES,
        "has_more": False,
        "total": len(_MOCK_FILES)
    })

@bp.route('/files/<file_id>', methods=['GET'])
def get_demo_file(file_id):
    """Return a single mocked file by its ID."""
    file = next((f for f in _MOCK_FILES if f.get('file_id') == file_id or f.get('id') == file_id), None)
    if not file:
        return jsonify({"error": "File not found in demo environment"}), 404
    
    return jsonify(file)

@bp.route('/files/shared', methods=['GET'])
def list_shared_demo_files():
    """Mock shared files."""
    return jsonify({
        "files": [],
        "has_more": False,
        "total": 0
    })

@bp.route('/files/shares/outgoing', methods=['GET'])
def list_outgoing_shares():
    """Mock outgoing shares."""
    return jsonify({
        "shares": [],
        "has_more": False,
        "total": 0
    })

@bp.route('/files/<file_id>/entities', methods=['GET'])
def get_demo_entities(file_id):
    """Return mock entities for the given demo file."""
    entities = _MOCK_ENTITIES.get(file_id, [])
    # Return in the format expected by analyze response
    return jsonify({
        "entities": entities,
        "risk_report": {
            "risk_level": "High" if len(entities) > 5 else "Medium",
            "entities": {ent["entity_type"]: sum(1 for e in entities if e["entity_type"] == ent["entity_type"]) for ent in entities},
            "insights": ["Simulated demo risk analysis complete."]
        }
    })

@bp.route('/files/<file_id>/timeline', methods=['GET'])
def get_demo_timeline(file_id):
    """Return mock timeline for the given demo file."""
    file = next((f for f in _MOCK_FILES if f.get('file_id') == file_id or f.get('id') == file_id), None)
    if not file:
        return jsonify({"error": "File not found"}), 404
    return jsonify({
        "timeline": file.get('timeline', [])
    })

@bp.route('/files/<file_id>/redact', methods=['POST'])
def apply_demo_redaction(file_id):
    """Simulate applying redactions."""
    data = request.json or {}
    entities_to_redact = data.get("entities", [])
    manual_boxes = data.get("manual_boxes", [])
    
    # Simulate processing delay
    time.sleep(1.5)
    
    # Return simulated success response
    return jsonify({
        "file_id": file_id,
        "name": f"redacted_demo_{file_id}.pdf",
        "sha256": "abcdef1234567890" * 4,
        "proof_type": "groth16",
        "proof_version": "v1.0",
        "redaction_status": "completed",
        "proof_location": "simulated_proof_path.json",
        "source_file_id": file_id,
        "anchor_hash": "0x123abc456def" + "0" * 48,
        "anchor_tx": "0xfade000" + "1" * 57
    })
