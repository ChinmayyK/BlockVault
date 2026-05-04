/**
 * Canonical role definitions for BlockVault.
 *
 * These enums EXACTLY MIRROR the backend Python enums in
 * `blockvault/core/roles.py`. Any change here MUST be reflected there
 * and vice-versa.
 */

// ---------------------------------------------------------------------------
// Platform-level roles
// ---------------------------------------------------------------------------

export enum PlatformRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

// ---------------------------------------------------------------------------
// Organization-level roles
// ---------------------------------------------------------------------------

export enum OrgRole {
  ORG_OWNER = "ORG_OWNER",
  ORG_ADMIN = "ORG_ADMIN",
  ORG_MEMBER = "ORG_MEMBER",
  ORG_VIEWER = "ORG_VIEWER",
}

const ORG_ROLE_RANK: Record<OrgRole, number> = {
  [OrgRole.ORG_VIEWER]: 0,
  [OrgRole.ORG_MEMBER]: 1,
  [OrgRole.ORG_ADMIN]: 2,
  [OrgRole.ORG_OWNER]: 3,
};

export function orgRoleGte(role: OrgRole, minRole: OrgRole): boolean {
  return (ORG_ROLE_RANK[role] ?? -1) >= (ORG_ROLE_RANK[minRole] ?? 99);
}

// ---------------------------------------------------------------------------
// Workspace-level roles
// ---------------------------------------------------------------------------

export enum WorkspaceRole {
  WORKSPACE_OWNER = "WORKSPACE_OWNER",
  WORKSPACE_EDITOR = "WORKSPACE_EDITOR",
  WORKSPACE_VIEWER = "WORKSPACE_VIEWER",
}

const WS_ROLE_RANK: Record<WorkspaceRole, number> = {
  [WorkspaceRole.WORKSPACE_VIEWER]: 0,
  [WorkspaceRole.WORKSPACE_EDITOR]: 1,
  [WorkspaceRole.WORKSPACE_OWNER]: 2,
};

export function wsRoleGte(role: WorkspaceRole, minRole: WorkspaceRole): boolean {
  return (WS_ROLE_RANK[role] ?? -1) >= (WS_ROLE_RANK[minRole] ?? 99);
}

// ---------------------------------------------------------------------------
// File-level roles
// ---------------------------------------------------------------------------

export enum FileRole {
  FILE_OWNER = "FILE_OWNER",
  FILE_EDITOR = "FILE_EDITOR",
  FILE_VIEWER = "FILE_VIEWER",
}

const FILE_ROLE_RANK: Record<FileRole, number> = {
  [FileRole.FILE_VIEWER]: 0,
  [FileRole.FILE_EDITOR]: 1,
  [FileRole.FILE_OWNER]: 2,
};

export function fileRoleGte(role: FileRole, minRole: FileRole): boolean {
  return (FILE_ROLE_RANK[role] ?? -1) >= (FILE_ROLE_RANK[minRole] ?? 99);
}

// ---------------------------------------------------------------------------
// Permission context (passed to permission helpers)
// ---------------------------------------------------------------------------

export interface OrgMembership {
  org_id: string;
  role: OrgRole;
}

export interface WorkspaceMembership {
  workspace_id: string;
  org_id?: string;
  role: WorkspaceRole;
}

export interface UserRoleContext {
  platform_role: PlatformRole;
  organizations: OrgMembership[];
  workspaces: WorkspaceMembership[];
}
