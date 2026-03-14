"""
Canonical role definitions for BlockVault.

This module is the SINGLE SOURCE OF TRUTH for all role enums.
The frontend mirrors these exact strings in `src/types/roles.ts`.

Four role layers:
  1. PlatformRole  — global system role (ADMIN / USER)
  2. OrgRole       — organization membership role
  3. WorkspaceRole — workspace membership role
  4. FileRole      — per-file permission role
"""
from __future__ import annotations

from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Platform-level roles
# ---------------------------------------------------------------------------

class PlatformRole(str, Enum):
    ADMIN = "ADMIN"
    USER = "USER"


# ---------------------------------------------------------------------------
# Organization-level roles
# ---------------------------------------------------------------------------

class OrgRole(str, Enum):
    ORG_OWNER = "ORG_OWNER"
    ORG_ADMIN = "ORG_ADMIN"
    ORG_MEMBER = "ORG_MEMBER"
    ORG_VIEWER = "ORG_VIEWER"


# Hierarchy: higher value = more privilege
_ORG_ROLE_RANK = {
    OrgRole.ORG_VIEWER: 0,
    OrgRole.ORG_MEMBER: 1,
    OrgRole.ORG_ADMIN: 2,
    OrgRole.ORG_OWNER: 3,
}


def org_role_gte(role: OrgRole, min_role: OrgRole) -> bool:
    """Return True if *role* is >= *min_role* in the org hierarchy."""
    return _ORG_ROLE_RANK.get(role, -1) >= _ORG_ROLE_RANK.get(min_role, 99)


# ---------------------------------------------------------------------------
# Workspace-level roles
# ---------------------------------------------------------------------------

class WorkspaceRole(str, Enum):
    WORKSPACE_OWNER = "WORKSPACE_OWNER"
    WORKSPACE_EDITOR = "WORKSPACE_EDITOR"
    WORKSPACE_VIEWER = "WORKSPACE_VIEWER"


_WS_ROLE_RANK = {
    WorkspaceRole.WORKSPACE_VIEWER: 0,
    WorkspaceRole.WORKSPACE_EDITOR: 1,
    WorkspaceRole.WORKSPACE_OWNER: 2,
}


def ws_role_gte(role: WorkspaceRole, min_role: WorkspaceRole) -> bool:
    """Return True if *role* is >= *min_role* in the workspace hierarchy."""
    return _WS_ROLE_RANK.get(role, -1) >= _WS_ROLE_RANK.get(min_role, 99)


# ---------------------------------------------------------------------------
# File-level roles
# ---------------------------------------------------------------------------

class FileRole(str, Enum):
    FILE_OWNER = "FILE_OWNER"
    FILE_EDITOR = "FILE_EDITOR"
    FILE_VIEWER = "FILE_VIEWER"


_FILE_ROLE_RANK = {
    FileRole.FILE_VIEWER: 0,
    FileRole.FILE_EDITOR: 1,
    FileRole.FILE_OWNER: 2,
}


def file_role_gte(role: FileRole, min_role: FileRole) -> bool:
    """Return True if *role* is >= *min_role* in the file hierarchy."""
    return _FILE_ROLE_RANK.get(role, -1) >= _FILE_ROLE_RANK.get(min_role, 99)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_platform_role(value: Optional[str]) -> PlatformRole:
    """Parse a stored role string into a PlatformRole, defaulting to USER."""
    if not value:
        return PlatformRole.USER
    try:
        return PlatformRole(value.upper())
    except (ValueError, AttributeError):
        return PlatformRole.USER
