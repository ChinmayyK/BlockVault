from __future__ import annotations

import uuid
from flask import Blueprint, request, abort

from ..core.security import require_auth
from ..core.validation import sanitize_id, sanitize_str, sanitize_wallet, reject_nosql_operators
from ..core.workspaces import WorkspaceStore
from ..core.roles import WorkspaceRole, ws_role_gte

bp = Blueprint("workspaces", __name__)


def _store():
    return WorkspaceStore()


@bp.get("")
@require_auth
def list_my_workspaces():
    """List all workspaces the current user belongs to."""
    address = getattr(request, "address")
    store = _store()
    workspaces = store.get_user_workspaces(address)
    return {"workspaces": workspaces}


@bp.post("")
@require_auth
def create_workspace():
    """Create a new workspace."""
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    org_id = data.get("org_id")  # optional
    encrypted_workspace_key = data.get("encrypted_workspace_key")

    if not name or not isinstance(name, str) or len(name.strip()) < 2:
        abort(400, "Workspace name is required (min 2 chars)")

    if not encrypted_workspace_key or not isinstance(encrypted_workspace_key, str):
        abort(400, "encrypted_workspace_key string is required")

    address = getattr(request, "address")
    store = _store()

    ws = store.create_workspace(
        name=name.strip(),
        owner_wallet=address,
        org_id=org_id,
        encrypted_workspace_key=encrypted_workspace_key,
    )

    return {
        "workspace_id": ws["_id"],
        "name": ws["name"],
        "org_id": ws.get("org_id"),
        "role": WorkspaceRole.WORKSPACE_OWNER.value,
        "created_at": ws["created_at"],
    }, 201


@bp.get("/<workspace_id>")
@require_auth
def get_workspace(workspace_id: str):
    """Get workspace details (must be a member)."""
    workspace_id = sanitize_id(workspace_id, "workspace_id")
    address = getattr(request, "address")
    store = _store()

    role = store.get_member_role(workspace_id, address)
    if role is None:
        abort(403, "Not a member of this workspace")

    ws = store.get_workspace(workspace_id)
    if not ws:
        abort(404, "Workspace not found")

    members = store.get_members(workspace_id)

    return {
        "workspace_id": ws["_id"],
        "name": ws.get("name"),
        "org_id": ws.get("org_id"),
        "my_role": role.value,
        "members": members,
        "created_at": ws.get("created_at"),
    }


@bp.post("/<workspace_id>/members")
@require_auth
def add_member(workspace_id: str):
    """Add a member to a workspace. Requires WORKSPACE_OWNER."""
    workspace_id = sanitize_id(workspace_id, "workspace_id")
    address = getattr(request, "address")
    store = _store()

    requester_role = store.get_member_role(workspace_id, address)
    if not requester_role or requester_role != WorkspaceRole.WORKSPACE_OWNER:
        abort(403, "WORKSPACE_OWNER role required to add members")

    data = request.get_json(silent=True) or {}
    wallet = data.get("wallet_address")
    role_str = data.get("role", "WORKSPACE_VIEWER")
    encrypted_workspace_key = data.get("encrypted_workspace_key")

    if not wallet or not isinstance(wallet, str):
        abort(400, "wallet_address required")

    if not encrypted_workspace_key or not isinstance(encrypted_workspace_key, str):
        abort(400, "encrypted_workspace_key string is required")

    try:
        role = WorkspaceRole(role_str)
    except ValueError:
        abort(400, f"Invalid role: {role_str}")

    store.add_member(workspace_id, wallet, role, encrypted_workspace_key)
    return {"status": "ok", "wallet_address": wallet.lower(), "role": role.value}


@bp.patch("/<workspace_id>/members/<wallet>")
@require_auth
def update_member_role(workspace_id: str, wallet: str):
    """Update a member's role. Requires WORKSPACE_OWNER."""
    workspace_id = sanitize_id(workspace_id, "workspace_id")
    wallet = sanitize_wallet(wallet, "wallet")
    address = getattr(request, "address")
    store = _store()

    requester_role = store.get_member_role(workspace_id, address)
    if not requester_role or requester_role != WorkspaceRole.WORKSPACE_OWNER:
        abort(403, "WORKSPACE_OWNER role required")

    data = request.get_json(silent=True) or {}
    role_str = data.get("role")
    if not role_str:
        abort(400, "role required")

    try:
        new_role = WorkspaceRole(role_str)
    except ValueError:
        abort(400, f"Invalid role: {role_str}")

    store.update_member_role(workspace_id, wallet, new_role)
    return {"status": "ok", "role": new_role.value}
