"""MongoDB-backed case management data store.

Provides CRUD operations for cases, tasks, team members,
and signature requests with proper schema enforcement.
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from .db import get_db

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------

def _cases_collection():
    return get_db()["cases"]


def _signature_requests_collection():
    return get_db()["signature_requests"]


def _ensure_indexes() -> None:
    """Create MongoDB indexes (idempotent)."""
    try:
        cases = _cases_collection()
        cases.create_index("owner")
        cases.create_index("status")
        cases.create_index("created_at")

        sig = _signature_requests_collection()
        sig.create_index("document_id")
        sig.create_index("requested_by")
        sig.create_index([("signers.address", 1)])
    except Exception as exc:
        logger.debug("Index creation skipped (may already exist): %s", exc)


_indexes_ensured = False


def _lazy_ensure_indexes():
    global _indexes_ensured
    if not _indexes_ensured:
        _ensure_indexes()
        _indexes_ensured = True


# ---------------------------------------------------------------------------
# CASE CRUD
# ---------------------------------------------------------------------------

def create_case(owner: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new case and return the created record."""
    _lazy_ensure_indexes()
    now_ms = int(time.time() * 1000)
    case = {
        "_id": str(uuid.uuid4()),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "status": data.get("status", "active"),
        "priority": data.get("priority", "medium"),
        "client_name": data.get("clientName", ""),
        "matter_number": data.get("matterNumber", ""),
        "practice_area": data.get("practiceArea", "corporate"),
        "lead_attorney": owner,
        "owner": owner,
        "team": data.get("team", []),
        "tasks": [],
        "deadlines": [],
        "document_ids": [],
        "created_at": now_ms,
        "updated_at": now_ms,
    }
    _cases_collection().insert_one(case)
    logger.info("Case created: %s by %s", case["_id"], owner)
    return _serialize_case(case)


def get_case(case_id: str, owner: str) -> Optional[Dict[str, Any]]:
    """Return a single case if the user owns it or is on the team."""
    _lazy_ensure_indexes()
    case = _cases_collection().find_one({
        "_id": case_id,
        "$or": [
            {"owner": owner},
            {"lead_attorney": owner},
            {"team.walletAddress": owner},
        ],
    })
    if case:
        return _serialize_case(case)
    return None


def list_cases(
    owner: str,
    *,
    status: Optional[List[str]] = None,
    priority: Optional[List[str]] = None,
    practice_area: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """List all cases visible to the user, with optional filters."""
    _lazy_ensure_indexes()
    flt: Dict[str, Any] = {
        "$or": [
            {"owner": owner},
            {"lead_attorney": owner},
            {"team.walletAddress": owner},
        ],
    }
    if status:
        flt["status"] = {"$in": status}
    if priority:
        flt["priority"] = {"$in": priority}
    if practice_area:
        flt["practice_area"] = {"$in": practice_area}

    docs = list(_cases_collection().find(flt).sort("created_at", -1))
    return [_serialize_case(d) for d in docs]


def update_case(case_id: str, owner: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update an existing case. Returns the updated record or None."""
    # Whitelist allowed update fields
    allowed = {
        "title", "description", "status", "priority",
        "clientName", "client_name", "matterNumber", "matter_number",
        "practiceArea", "practice_area",
    }
    safe_updates: Dict[str, Any] = {}
    for k, v in updates.items():
        if k in allowed:
            # Normalize camelCase to snake_case
            key = _to_snake(k)
            safe_updates[key] = v
    safe_updates["updated_at"] = int(time.time() * 1000)

    result = _cases_collection().find_one_and_update(
        {"_id": case_id, "owner": owner},
        {"$set": safe_updates},
        return_document=True,
    )
    if result:
        return _serialize_case(result)
    return None


def delete_case(case_id: str, owner: str) -> bool:
    """Delete a case. Returns True if deleted."""
    result = _cases_collection().delete_one({"_id": case_id, "owner": owner})
    return result.deleted_count > 0


# ---------------------------------------------------------------------------
# TASKS (embedded in case document)
# ---------------------------------------------------------------------------

def add_task(case_id: str, owner: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Add a task to a case."""
    task = {
        "id": str(uuid.uuid4()),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "assigned_to": data.get("assignedTo", ""),
        "assigned_by": owner,
        "status": data.get("status", "pending"),
        "priority": data.get("priority", "medium"),
        "due_date": data.get("dueDate", ""),
        "created_at": int(time.time() * 1000),
        "completed_at": None,
        "document_ids": data.get("documentIds", []),
    }
    result = _cases_collection().find_one_and_update(
        {"_id": case_id, "$or": [{"owner": owner}, {"lead_attorney": owner}]},
        {"$push": {"tasks": task}, "$set": {"updated_at": int(time.time() * 1000)}},
        return_document=True,
    )
    if result:
        return _serialize_task(task, case_id)
    return None


def get_tasks(case_id: str, owner: str) -> Optional[List[Dict[str, Any]]]:
    """Return tasks for a case."""
    case = _cases_collection().find_one({
        "_id": case_id,
        "$or": [{"owner": owner}, {"lead_attorney": owner}, {"team.walletAddress": owner}],
    })
    if not case:
        return None
    return [_serialize_task(t, case_id) for t in case.get("tasks", [])]


# ---------------------------------------------------------------------------
# TEAM MEMBERS (embedded in case document)
# ---------------------------------------------------------------------------

def add_team_member(case_id: str, owner: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Add a team member to a case."""
    member = {
        "walletAddress": data.get("walletAddress", ""),
        "role": data.get("role", "associate"),
        "name": data.get("name", ""),
        "email": data.get("email", ""),
        "permissions": data.get("permissions", ["view"]),
        "added_at": int(time.time() * 1000),
        "added_by": owner,
    }
    result = _cases_collection().find_one_and_update(
        {"_id": case_id, "owner": owner},
        {"$push": {"team": member}, "$set": {"updated_at": int(time.time() * 1000)}},
        return_document=True,
    )
    if result:
        return member
    return None


# ---------------------------------------------------------------------------
# SIGNATURE REQUESTS (separate collection)
# ---------------------------------------------------------------------------

def create_signature_request(
    document_id: str,
    requested_by: str,
    data: Dict[str, Any],
) -> Dict[str, Any]:
    """Create a signature request and return it."""
    _lazy_ensure_indexes()
    now_ms = int(time.time() * 1000)
    sig_req = {
        "_id": str(uuid.uuid4()),
        "document_id": document_id,
        "document_name": data.get("documentName", "Unknown Document"),
        "requested_by": requested_by,
        "signers": data.get("signers", []),
        "status": "pending",
        "created_at": now_ms,
        "expires_at": data.get("expiresAt", ""),
        "message": data.get("message", "Please sign this document"),
    }
    _signature_requests_collection().insert_one(sig_req)
    return _serialize_sig_request(sig_req)


def get_pending_signature_requests(user_address: str) -> List[Dict[str, Any]]:
    """Get signature requests where the user is a signer."""
    _lazy_ensure_indexes()
    docs = list(_signature_requests_collection().find({
        "signers.address": {"$regex": f"^{user_address}$", "$options": "i"},
    }))
    return [_serialize_sig_request(d) for d in docs]


def get_sent_signature_requests(user_address: str) -> List[Dict[str, Any]]:
    """Get signature requests sent by the user."""
    _lazy_ensure_indexes()
    docs = list(_signature_requests_collection().find({
        "requested_by": {"$regex": f"^{user_address}$", "$options": "i"},
    }))
    return [_serialize_sig_request(d) for d in docs]


def update_signature_request_status(
    request_id: str,
    status: str,
    signer: str = "",
) -> Optional[Dict[str, Any]]:
    """Update the status of a signature request."""
    update: Dict[str, Any] = {"status": status, "updated_at": int(time.time() * 1000)}
    if status == "signed":
        update["signed_by"] = signer
        update["signed_at"] = int(time.time() * 1000)
    elif status == "declined":
        update["declined_by"] = signer
        update["declined_at"] = int(time.time() * 1000)

    result = _signature_requests_collection().find_one_and_update(
        {"_id": request_id},
        {"$set": update},
        return_document=True,
    )
    if result:
        return _serialize_sig_request(result)
    return None


def sign_document(document_id: str, signer_address: str, signature: str) -> Dict[str, Any]:
    """Record a signature for a document. Updates the matching signature request."""
    now_ms = int(time.time() * 1000)
    # Update the first matching pending request for this document
    _signature_requests_collection().find_one_and_update(
        {"document_id": document_id, "status": "pending"},
        {"$set": {"status": "signed", "signed_by": signer_address, "signed_at": now_ms}},
    )
    return {
        "id": str(uuid.uuid4()),
        "documentId": document_id,
        "signerAddress": signer_address,
        "signature": signature,
        "signedAt": now_ms,
        "status": "signed",
    }


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

def get_case_dashboard(case_id: str, owner: str) -> Optional[Dict[str, Any]]:
    """Return dashboard data for a case."""
    case = _cases_collection().find_one({
        "_id": case_id,
        "$or": [{"owner": owner}, {"lead_attorney": owner}, {"team.walletAddress": owner}],
    })
    if not case:
        return None
    tasks = case.get("tasks", [])
    pending_tasks = [t for t in tasks if t.get("status") == "pending"]
    return {
        "caseId": case_id,
        "overview": {
            "totalDocuments": len(case.get("document_ids", [])),
            "documentsAwaitingSignature": 0,
            "upcomingDeadlines": len(case.get("deadlines", [])),
            "pendingTasks": len(pending_tasks),
            "recentActivity": 0,
            "teamMembers": len(case.get("team", [])),
            "lastUpdated": case.get("updated_at"),
        },
        "recentActivity": [],
        "upcomingDeadlines": case.get("deadlines", []),
        "pendingTasks": [_serialize_task(t, case_id) for t in pending_tasks],
        "documentStats": {
            "total": len(case.get("document_ids", [])),
            "byType": {},
            "byStatus": {},
            "byAccessLevel": {},
            "totalSize": 0,
            "averageSize": 0,
        },
        "teamActivity": [],
    }


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _serialize_case(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a MongoDB case document to a JSON-safe response dict."""
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "description": doc.get("description", ""),
        "status": doc.get("status", "active"),
        "priority": doc.get("priority", "medium"),
        "clientName": doc.get("client_name", ""),
        "matterNumber": doc.get("matter_number", ""),
        "practiceArea": doc.get("practice_area", "corporate"),
        "createdAt": doc.get("created_at"),
        "updatedAt": doc.get("updated_at"),
        "leadAttorney": doc.get("lead_attorney", ""),
        "team": doc.get("team", []),
        "documents": doc.get("document_ids", []),
        "tasks": [_serialize_task(t, str(doc["_id"])) for t in doc.get("tasks", [])],
        "deadlines": doc.get("deadlines", []),
        "accessControl": {
            "caseId": str(doc["_id"]),
            "permissions": {},
            "roleAssignments": {},
            "createdAt": doc.get("created_at"),
            "updatedAt": doc.get("updated_at"),
        },
    }


def _serialize_task(task: Dict[str, Any], case_id: str) -> Dict[str, Any]:
    """Convert a task sub-document to a JSON-safe dict."""
    return {
        "id": task.get("id", ""),
        "caseId": case_id,
        "title": task.get("title", ""),
        "description": task.get("description", ""),
        "assignedTo": task.get("assigned_to", ""),
        "assignedBy": task.get("assigned_by", ""),
        "status": task.get("status", "pending"),
        "priority": task.get("priority", "medium"),
        "dueDate": task.get("due_date", ""),
        "createdAt": task.get("created_at"),
        "completedAt": task.get("completed_at"),
        "documentIds": task.get("document_ids", []),
        "comments": task.get("comments", []),
        "blockchainTxId": task.get("blockchain_tx_id"),
    }


def _serialize_sig_request(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a signature request doc to a JSON-safe dict."""
    return {
        "id": str(doc["_id"]),
        "documentId": doc.get("document_id", ""),
        "documentName": doc.get("document_name", ""),
        "requestedBy": doc.get("requested_by", ""),
        "status": doc.get("status", "pending"),
        "createdAt": doc.get("created_at"),
        "expiresAt": doc.get("expires_at", ""),
        "message": doc.get("message", ""),
        "signers": doc.get("signers", []),
        "signedBy": doc.get("signed_by", ""),
        "signedAt": doc.get("signed_at", ""),
    }


def _to_snake(name: str) -> str:
    """Convert camelCase to snake_case."""
    import re
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()
