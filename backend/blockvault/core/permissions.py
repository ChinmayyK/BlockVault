"""
Unified permission resolver for BlockVault.

Evaluates the full role hierarchy:
  File role → Workspace role → Organization role → Platform role

The most specific role takes precedence.
"""
from __future__ import annotations

import logging
from typing import Optional

from blockvault.core.db import get_db
from blockvault.core.roles import (
    PlatformRole,
    OrgRole,
    WorkspaceRole,
    FileRole,
    org_role_gte,
    ws_role_gte,
    file_role_gte,
    parse_platform_role,
)

logger = logging.getLogger(__name__)


def _get_platform_role(wallet: str) -> PlatformRole:
    """Look up the user's platform role from MongoDB."""
    db = get_db()
    doc = db["users"].find_one({"address": wallet.lower()})
    if doc and "platform_role" in doc:
        return parse_platform_role(doc["platform_role"])
    # Legacy fallback: check old 'role' field
    if doc and "role" in doc:
        old_role = doc["role"]
        if isinstance(old_role, int) and old_role >= 3:
            return PlatformRole.ADMIN
        if isinstance(old_role, str) and old_role.upper() == "ADMIN":
            return PlatformRole.ADMIN
    return PlatformRole.USER


def _get_file_role(wallet: str, file_id: str) -> Optional[FileRole]:
    """Get the user's role for a specific file."""
    db = get_db()
    wallet_lower = wallet.lower()

    # Check if user is the file owner
    file_doc = db["files"].find_one({"_id": file_id})
    if not file_doc:
        # Try with string ID match on 'id' field
        from bson import ObjectId
        from bson.errors import InvalidId
        try:
            file_doc = db["files"].find_one({"_id": ObjectId(file_id)})
        except (InvalidId, TypeError):
            pass  # file_id is not a valid ObjectId format

    if file_doc:
        owner = (file_doc.get("owner") or "").lower()
        if owner == wallet_lower:
            return FileRole.FILE_OWNER

    # Check file_permissions collection
    perm_doc = db["file_permissions"].find_one({
        "file_id": file_id,
        "wallet_address": wallet_lower,
    })
    if perm_doc:
        try:
            return FileRole(perm_doc["role"])
        except (ValueError, KeyError):
            pass

    # Check shares collection (shared files = FILE_VIEWER)
    share_doc = db["shares"].find_one({
        "file_id": file_id,
        "recipient": wallet_lower,
    })
    if share_doc:
        return FileRole.FILE_VIEWER

    return None


def _get_workspace_role(wallet: str, workspace_id: str) -> Optional[WorkspaceRole]:
    """Get the user's role in a workspace."""
    db = get_db()
    doc = db["workspace_members"].find_one({
        "workspace_id": workspace_id,
        "wallet_address": wallet.lower(),
    })
    if not doc:
        return None
    try:
        return WorkspaceRole(doc["role"])
    except (ValueError, KeyError):
        return None


def _get_org_role(wallet: str, org_id: str) -> Optional[OrgRole]:
    """Get the user's role in an organization."""
    db = get_db()
    doc = db["org_members"].find_one({
        "org_id": org_id,
        "wallet_address": wallet.lower(),
    })
    if not doc:
        return None
    try:
        return OrgRole(doc["role"])
    except (ValueError, KeyError):
        return None


def _get_workspace_for_file(file_id: str) -> Optional[str]:
    """Look up which workspace a file belongs to."""
    db = get_db()
    file_doc = db["files"].find_one({"_id": file_id})
    if not file_doc:
        from bson import ObjectId
        from bson.errors import InvalidId
        try:
            file_doc = db["files"].find_one({"_id": ObjectId(file_id)})
        except (InvalidId, TypeError):
            pass  # file_id is not a valid ObjectId format
    if file_doc:
        return file_doc.get("workspace_id")
    return None


def _get_org_for_workspace(workspace_id: str) -> Optional[str]:
    """Look up which org a workspace belongs to."""
    db = get_db()
    ws_doc = db["workspaces"].find_one({"_id": workspace_id})
    if ws_doc:
        return ws_doc.get("org_id")
    return None


# ------------------------------------------------------------------
# Public permission checks
# ------------------------------------------------------------------

def can_redact(wallet: str, file_id: str) -> bool:
    """Check if a user can redact a file.

    Allowed: FILE_OWNER, FILE_EDITOR, WORKSPACE_EDITOR+, ORG_ADMIN+, ADMIN
    """
    platform = _get_platform_role(wallet)
    if platform == PlatformRole.ADMIN:
        return True

    file_role = _get_file_role(wallet, file_id)
    if file_role and file_role_gte(file_role, FileRole.FILE_EDITOR):
        return True

    workspace_id = _get_workspace_for_file(file_id)
    if workspace_id:
        ws_role = _get_workspace_role(wallet, workspace_id)
        if ws_role and ws_role_gte(ws_role, WorkspaceRole.WORKSPACE_EDITOR):
            return True

        org_id = _get_org_for_workspace(workspace_id)
        if org_id:
            o_role = _get_org_role(wallet, org_id)
            if o_role and org_role_gte(o_role, OrgRole.ORG_ADMIN):
                return True

    return False


def can_share(wallet: str, file_id: str) -> bool:
    """Check if a user can share a file.

    Allowed: FILE_OWNER, WORKSPACE_OWNER, ORG_ADMIN+, ADMIN
    """
    platform = _get_platform_role(wallet)
    if platform == PlatformRole.ADMIN:
        return True

    file_role = _get_file_role(wallet, file_id)
    if file_role == FileRole.FILE_OWNER:
        return True

    workspace_id = _get_workspace_for_file(file_id)
    if workspace_id:
        ws_role = _get_workspace_role(wallet, workspace_id)
        if ws_role == WorkspaceRole.WORKSPACE_OWNER:
            return True

        org_id = _get_org_for_workspace(workspace_id)
        if org_id:
            o_role = _get_org_role(wallet, org_id)
            if o_role and org_role_gte(o_role, OrgRole.ORG_ADMIN):
                return True

    return False


def can_delete(wallet: str, file_id: str) -> bool:
    """Check if a user can delete a file.

    Allowed: FILE_OWNER, WORKSPACE_OWNER, ORG_OWNER, ADMIN
    """
    platform = _get_platform_role(wallet)
    if platform == PlatformRole.ADMIN:
        return True

    file_role = _get_file_role(wallet, file_id)
    if file_role == FileRole.FILE_OWNER:
        return True

    workspace_id = _get_workspace_for_file(file_id)
    if workspace_id:
        ws_role = _get_workspace_role(wallet, workspace_id)
        if ws_role == WorkspaceRole.WORKSPACE_OWNER:
            return True

        org_id = _get_org_for_workspace(workspace_id)
        if org_id:
            o_role = _get_org_role(wallet, org_id)
            if o_role == OrgRole.ORG_OWNER:
                return True

    return False


def can_download(wallet: str, file_id: str) -> bool:
    """Check if a user can download a file.

    Allowed: any file role, any workspace role, any org role, ADMIN
    """
    platform = _get_platform_role(wallet)
    if platform == PlatformRole.ADMIN:
        return True

    file_role = _get_file_role(wallet, file_id)
    if file_role is not None:
        return True

    workspace_id = _get_workspace_for_file(file_id)
    if workspace_id:
        ws_role = _get_workspace_role(wallet, workspace_id)
        if ws_role is not None:
            return True

    return False
