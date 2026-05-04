"""Organization API endpoints."""
from __future__ import annotations

import uuid
from flask import Blueprint, request, abort

from ..core.security import require_auth
from ..core.validation import sanitize_id, sanitize_wallet, reject_nosql_operators
from ..core.organizations import OrganizationStore
from ..core.roles import OrgRole, org_role_gte

bp = Blueprint("organizations", __name__)


def _store():
    return OrganizationStore()


@bp.post("")
@require_auth
def create_organization():
    """Create a new organization. Creator becomes ORG_OWNER."""
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    if not name or not isinstance(name, str) or len(name.strip()) < 2:
        abort(400, "Organization name is required (min 2 chars)")

    address = getattr(request, "address")
    org_id = str(uuid.uuid4())

    store = _store()
    org = store.create_organization(org_id, name.strip(), address)

    return {
        "org_id": org["_id"],
        "name": org["name"],
        "role": OrgRole.ORG_OWNER.value,
        "created_at": org["created_at"],
    }, 201


@bp.get("")
@require_auth
def list_my_organizations():
    """List all organizations the current user belongs to."""
    address = getattr(request, "address")
    store = _store()
    orgs = store.get_user_orgs(address)
    return {"organizations": orgs}


@bp.get("/<org_id>")
@require_auth
def get_organization(org_id: str):
    """Get organization details (must be a member)."""
    org_id = sanitize_id(org_id, "org_id")
    address = getattr(request, "address")
    store = _store()

    role = store.get_member_role(org_id, address)
    if role is None:
        abort(403, "Not a member of this organization")

    org = store.get_organization(org_id)
    if not org:
        abort(404, "Organization not found")

    members = store.get_members(org_id)

    return {
        "org_id": org["_id"],
        "name": org.get("name"),
        "my_role": role.value,
        "members": members,
        "created_at": org.get("created_at"),
        "compliance_profile": org.get("compliance_profile"),
    }


@bp.post("/<org_id>/members")
@require_auth
def add_member(org_id: str):
    """Add a member to the organization. Requires ORG_ADMIN+."""
    org_id = sanitize_id(org_id, "org_id")
    address = getattr(request, "address")
    store = _store()

    requester_role = store.get_member_role(org_id, address)
    if not requester_role or not org_role_gte(requester_role, OrgRole.ORG_ADMIN):
        abort(403, "ORG_ADMIN role required to add members")

    data = request.get_json(silent=True) or {}
    wallet = data.get("wallet_address")
    role_str = data.get("role", "ORG_MEMBER")

    if not wallet or not isinstance(wallet, str):
        abort(400, "wallet_address required")

    try:
        role = OrgRole(role_str)
    except ValueError:
        abort(400, f"Invalid role: {role_str}")

    # Cannot assign a role higher than your own
    if org_role_gte(role, requester_role):
        if role != requester_role or requester_role != OrgRole.ORG_OWNER:
            abort(403, "Cannot assign a role equal to or higher than your own")

    store.add_member(org_id, wallet, role)
    return {"status": "ok", "wallet_address": wallet.lower(), "role": role.value}


@bp.patch("/<org_id>/members/<wallet>")
@require_auth
def update_member_role(org_id: str, wallet: str):
    """Update a member's role. Requires ORG_ADMIN+."""
    org_id = sanitize_id(org_id, "org_id")
    wallet = sanitize_wallet(wallet, "wallet")
    address = getattr(request, "address")
    store = _store()

    requester_role = store.get_member_role(org_id, address)
    if not requester_role or not org_role_gte(requester_role, OrgRole.ORG_ADMIN):
        abort(403, "ORG_ADMIN role required")

    data = request.get_json(silent=True) or {}
    role_str = data.get("role")
    if not role_str:
        abort(400, "role required")

    try:
        new_role = OrgRole(role_str)
    except ValueError:
        abort(400, f"Invalid role: {role_str}")

    store.update_member_role(org_id, wallet, new_role)
    return {"status": "ok", "role": new_role.value}


@bp.delete("/<org_id>/members/<wallet>")
@require_auth
def remove_member(org_id: str, wallet: str):
    """Remove a member from the organization. Requires ORG_ADMIN+."""
    org_id = sanitize_id(org_id, "org_id")
    wallet = sanitize_wallet(wallet, "wallet")
    address = getattr(request, "address")
    store = _store()

    requester_role = store.get_member_role(org_id, address)
    if not requester_role or not org_role_gte(requester_role, OrgRole.ORG_ADMIN):
        abort(403, "ORG_ADMIN role required")

    removed = store.remove_member(org_id, wallet)
    if not removed:
        abort(404, "Member not found")

    return {"status": "removed"}
