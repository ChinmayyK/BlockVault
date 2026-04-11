"""Case management API blueprint.

Replaces the in-memory mock_cases module with MongoDB-backed endpoints.
All mutating endpoints are protected by @require_auth and emit audit events.
"""
from __future__ import annotations

import logging
from flask import Blueprint, request, abort, jsonify

from ..core.security import require_auth
from ..core.audit import log_event
from ..core.validation import sanitize_id, sanitize_str, reject_nosql_operators
from ..core import cases as case_store

logger = logging.getLogger(__name__)

bp = Blueprint("cases", __name__)


# ---------------------------------------------------------------------------
# CASE CRUD
# ---------------------------------------------------------------------------

@bp.get("/cases")
@require_auth
def list_cases():
    """List all cases for the authenticated user, with optional filtering."""
    owner = getattr(request, "address", "").lower()
    status = request.args.get("status", "").split(",") if request.args.get("status") else None
    priority = request.args.get("priority", "").split(",") if request.args.get("priority") else None
    practice_area = request.args.get("practiceArea", "").split(",") if request.args.get("practiceArea") else None

    # Remove empty strings from filter lists
    if status:
        status = [s for s in status if s]
    if priority:
        priority = [p for p in priority if p]
    if practice_area:
        practice_area = [p for p in practice_area if p]

    cases = case_store.list_cases(
        owner, status=status or None, priority=priority or None, practice_area=practice_area or None,
    )
    return jsonify({"cases": cases, "total": len(cases), "page": 1, "limit": 50})


@bp.post("/cases")
@require_auth
def create_case():
    """Create a new case."""
    owner = getattr(request, "address", "").lower()
    data = request.get_json(silent=True) or {}

    if not data.get("title"):
        abort(400, "title is required")

    case = case_store.create_case(owner, data)
    log_event("case_created", target_id=case["id"], details={"title": case["title"]})
    return jsonify(case), 201


@bp.get("/cases/<case_id>")
@require_auth
def get_case(case_id: str):
    """Get a specific case by ID."""
    case_id = sanitize_id(case_id, "case_id")
    owner = getattr(request, "address", "").lower()
    case = case_store.get_case(case_id, owner)
    if not case:
        abort(404, "Case not found")
    return jsonify(case)


@bp.put("/cases/<case_id>")
@require_auth
def update_case(case_id: str):
    """Update a case."""
    case_id = sanitize_id(case_id, "case_id")
    owner = getattr(request, "address", "").lower()
    data = request.get_json(silent=True) or {}
    reject_nosql_operators(data)
    updated = case_store.update_case(case_id, owner, data)
    if not updated:
        abort(404, "Case not found")
    log_event("case_updated", target_id=case_id, details={"fields": list(data.keys())})
    return jsonify(updated)


@bp.delete("/cases/<case_id>")
@require_auth
def delete_case(case_id: str):
    """Delete a case."""
    case_id = sanitize_id(case_id, "case_id")
    owner = getattr(request, "address", "").lower()
    if not case_store.delete_case(case_id, owner):
        abort(404, "Case not found")
    log_event("case_deleted", target_id=case_id)
    return jsonify({"message": "Case deleted successfully"})


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

@bp.get("/cases/<case_id>/dashboard")
@require_auth
def get_dashboard(case_id: str):
    """Get dashboard overview for a case."""
    case_id = sanitize_id(case_id, "case_id")
    owner = getattr(request, "address", "").lower()
    dashboard = case_store.get_case_dashboard(case_id, owner)
    if not dashboard:
        abort(404, "Case not found")
    return jsonify(dashboard)


# ---------------------------------------------------------------------------
# TASKS
# ---------------------------------------------------------------------------

@bp.get("/cases/<case_id>/tasks")
@require_auth
def get_tasks(case_id: str):
    """Get tasks for a case."""
    case_id = sanitize_id(case_id, "case_id")
    owner = getattr(request, "address", "").lower()
    tasks = case_store.get_tasks(case_id, owner)
    if tasks is None:
        abort(404, "Case not found")
    return jsonify({"tasks": tasks, "total": len(tasks), "page": 1, "limit": 50})


@bp.post("/cases/<case_id>/tasks")
@require_auth
def create_task(case_id: str):
    """Create a task on a case."""
    case_id = sanitize_id(case_id, "case_id")
    owner = getattr(request, "address", "").lower()
    data = request.get_json(silent=True) or {}
    reject_nosql_operators(data)
    task = case_store.add_task(case_id, owner, data)
    if not task:
        abort(404, "Case not found or access denied")
    log_event("task_created", target_id=case_id, details={"task_id": task["id"]})
    return jsonify(task), 201


# ---------------------------------------------------------------------------
# TEAM
# ---------------------------------------------------------------------------

@bp.post("/cases/<case_id>/team")
@require_auth
def add_team_member(case_id: str):
    """Add a team member to a case."""
    case_id = sanitize_id(case_id, "case_id")
    owner = getattr(request, "address", "").lower()
    data = request.get_json(silent=True) or {}
    reject_nosql_operators(data)
    member = case_store.add_team_member(case_id, owner, data)
    if not member:
        abort(404, "Case not found or access denied")
    log_event("team_member_added", target_id=case_id, details={"member": data.get("walletAddress")})
    return jsonify(member), 201


# ---------------------------------------------------------------------------
# AUDIT
# ---------------------------------------------------------------------------

@bp.get("/cases/<case_id>/audit")
@require_auth
def get_audit_trail(case_id: str):
    """Get audit trail for a case (via the global audit log)."""
    from ..core.db import get_db
    owner = getattr(request, "address", "").lower()

    # Verify access to the case first
    case = case_store.get_case(case_id, owner)
    if not case:
        abort(404, "Case not found")

    # Fetch audit events related to this case
    db = get_db()
    events = list(
        db["audit_events"]
        .find({"target_id": case_id})
        .sort("timestamp", -1)
        .limit(100)
    )
    result = []
    for evt in events:
        result.append({
            "id": str(evt.get("_id")),
            "caseId": case_id,
            "action": evt.get("action", ""),
            "performedBy": evt.get("user_id", ""),
            "performedAt": evt.get("timestamp"),
            "details": str(evt.get("details", "")),
            "metadata": {},
        })
    return jsonify(result)


# ---------------------------------------------------------------------------
# SIGNATURE REQUESTS
# ---------------------------------------------------------------------------

@bp.post("/documents/<document_id>/request-signature")
@require_auth
def request_signature(document_id: str):
    """Request e-signatures on a document."""
    document_id = sanitize_id(document_id, "document_id")
    user = getattr(request, "address", "").lower()
    data = request.get_json(silent=True) or {}
    reject_nosql_operators(data)
    sig_req = case_store.create_signature_request(document_id, user, data)
    log_event("signature_requested", target_id=document_id, details={
        "request_id": sig_req["id"],
        "signer_count": len(data.get("signers", [])),
    })
    return jsonify({"signatureRequest": sig_req, "message": "Signature requests sent to all signers"}), 201


@bp.post("/documents/<document_id>/sign")
@require_auth
def sign_document(document_id: str):
    """Sign a document."""
    document_id = sanitize_id(document_id, "document_id")
    user = getattr(request, "address", "").lower()
    data = request.get_json(silent=True) or {}
    reject_nosql_operators(data)
    sig = case_store.sign_document(
        document_id,
        signer_address=data.get("signerAddress", user),
        signature=data.get("signature", ""),
    )
    log_event("document_signed", target_id=document_id, details={"signer": sig["signerAddress"]})
    return jsonify({"signature": sig, "message": "Document signed successfully"}), 201


@bp.get("/signature-requests")
@require_auth
def get_signature_requests():
    """Get signature requests where the user is a signer."""
    user = getattr(request, "address", "").lower()
    # Also support query param for backward compat
    user_address = request.args.get("user_address", user)
    reqs = case_store.get_pending_signature_requests(user_address)
    return jsonify({"signatureRequests": reqs, "total": len(reqs)})


@bp.get("/signature-requests-sent")
@require_auth
def get_signature_requests_sent():
    """Get signature requests sent by the user."""
    user = getattr(request, "address", "").lower()
    user_address = request.args.get("user_address", user)
    reqs = case_store.get_sent_signature_requests(user_address)
    return jsonify({"signatureRequests": reqs, "total": len(reqs)})


@bp.post("/signature-requests/<request_id>/status")
@require_auth
def update_signature_status(request_id: str):
    """Update signature request status (signed/declined)."""
    request_id = sanitize_id(request_id, "request_id")
    data = request.get_json(silent=True) or {}
    reject_nosql_operators(data)
    status = data.get("status")
    signer = data.get("signer", "")
    updated = case_store.update_signature_request_status(request_id, status, signer)
    if not updated:
        abort(404, "Signature request not found")
    log_event("signature_status_updated", details={"request_id": request_id, "status": status})
    return jsonify({"signatureRequest": updated})


# ---------------------------------------------------------------------------
# CASE DOCUMENTS
# ---------------------------------------------------------------------------

@bp.get("/cases/<case_id>/documents")
@require_auth
def get_case_documents(case_id: str):
    """Get documents linked to a case."""
    from ..core.db import get_db
    owner = getattr(request, "address", "").lower()
    case = case_store.get_case(case_id, owner)
    if not case:
        abort(404, "Case not found")

    doc_ids = case.get("documents", [])
    if not doc_ids:
        return jsonify({"documents": [], "total": 0})

    db = get_db()
    from bson import ObjectId
    from bson.errors import InvalidId

    oid_candidates = []
    for did in doc_ids:
        try:
            oid_candidates.append(ObjectId(did))
        except (InvalidId, TypeError):
            oid_candidates.append(did)

    docs = list(db["files"].find({"_id": {"$in": oid_candidates}}))
    result = []
    for d in docs:
        result.append({
            "id": str(d["_id"]),
            "name": d.get("original_name", ""),
            "hash": d.get("sha256", ""),
            "cid": d.get("cid", ""),
            "size": d.get("size", 0),
            "type": d.get("content_type", ""),
            "uploadedAt": d.get("created_at"),
            "uploadedBy": d.get("owner", ""),
            "status": "verified" if d.get("anchor_status") == "complete" else "pending",
        })
    return jsonify({"documents": result, "total": len(result)})


@bp.post("/cases/<case_id>/documents")
@require_auth
def add_document_to_case(case_id: str):
    """Link an existing file to a case."""
    case_id = sanitize_id(case_id, "case_id")
    owner = getattr(request, "address", "").lower()
    data = request.get_json(silent=True) or {}
    reject_nosql_operators(data)
    file_id = data.get("fileId") or data.get("id")
    if not file_id:
        abort(400, "fileId required")
    file_id = sanitize_id(file_id, "fileId")

    from ..core.db import get_db
    result = get_db()["cases"].find_one_and_update(
        {"_id": case_id, "owner": owner},
        {
            "$addToSet": {"document_ids": file_id},
            "$set": {"updated_at": __import__("time").time() * 1000},
        },
        return_document=True,
    )
    if not result:
        abort(404, "Case not found")
    log_event("document_linked_to_case", target_id=case_id, details={"file_id": file_id})
    return jsonify({"message": "Document added to case successfully"}), 201
