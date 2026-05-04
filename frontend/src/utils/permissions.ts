/**
 * Context-aware permission helpers for BlockVault.
 *
 * Uses the hierarchical role system from `@/types/roles.ts`.
 * Resolution order: file role → workspace role → org role → platform role.
 * The most specific role wins.
 */
import {
  PlatformRole,
  OrgRole,
  WorkspaceRole,
  FileRole,
  orgRoleGte,
  wsRoleGte,
  fileRoleGte,
  type OrgMembership,
  type WorkspaceMembership,
  type UserRoleContext,
} from '@/types/roles';

// Re-export for backward compatibility
export type UserRole = "ADMIN" | "USER" | "OWNER" | "EDITOR" | "VIEWER";

/** Minimal context for permission checks */
export interface PermissionContext {
  /** The user's full role context from AuthContext */
  userContext?: UserRoleContext | null;
  /** File-level role for the specific file being checked */
  fileRole?: FileRole | null;
  /** Workspace ID the file belongs to */
  workspaceId?: string | null;
  /** Org ID the workspace belongs to */
  orgId?: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getWorkspaceRole(
  ctx: PermissionContext
): WorkspaceRole | null {
  if (!ctx.userContext || !ctx.workspaceId) return null;
  const ws = ctx.userContext.workspaces?.find(
    (w) => w.workspace_id === ctx.workspaceId
  );
  return ws ? (ws.role as WorkspaceRole) : null;
}

function getOrgRole(ctx: PermissionContext): OrgRole | null {
  if (!ctx.userContext || !ctx.orgId) return null;
  const org = ctx.userContext.organizations?.find(
    (o) => o.org_id === ctx.orgId
  );
  return org ? (org.role as OrgRole) : null;
}

function getPlatformRole(ctx: PermissionContext): PlatformRole {
  return (ctx.userContext?.platform_role as PlatformRole) || PlatformRole.USER;
}

// ---------------------------------------------------------------------------
// Public permission checks (context-aware)
// ---------------------------------------------------------------------------

export function canRedactCtx(ctx: PermissionContext): boolean {
  // Platform admin can always redact
  if (getPlatformRole(ctx) === PlatformRole.ADMIN) return true;

  // File-level: OWNER or EDITOR
  if (ctx.fileRole && fileRoleGte(ctx.fileRole, FileRole.FILE_EDITOR)) return true;

  // Workspace-level: EDITOR or OWNER
  const wsRole = getWorkspaceRole(ctx);
  if (wsRole && wsRoleGte(wsRole, WorkspaceRole.WORKSPACE_EDITOR)) return true;

  // Org-level: ADMIN or OWNER
  const orgRole = getOrgRole(ctx);
  if (orgRole && orgRoleGte(orgRole, OrgRole.ORG_ADMIN)) return true;

  return false;
}

export function canShareCtx(ctx: PermissionContext): boolean {
  if (getPlatformRole(ctx) === PlatformRole.ADMIN) return true;
  if (ctx.fileRole === FileRole.FILE_OWNER) return true;

  const wsRole = getWorkspaceRole(ctx);
  if (wsRole === WorkspaceRole.WORKSPACE_OWNER) return true;

  const orgRole = getOrgRole(ctx);
  if (orgRole && orgRoleGte(orgRole, OrgRole.ORG_ADMIN)) return true;

  return false;
}

export function canDeleteCtx(ctx: PermissionContext): boolean {
  if (getPlatformRole(ctx) === PlatformRole.ADMIN) return true;
  if (ctx.fileRole === FileRole.FILE_OWNER) return true;

  const wsRole = getWorkspaceRole(ctx);
  if (wsRole === WorkspaceRole.WORKSPACE_OWNER) return true;

  const orgRole = getOrgRole(ctx);
  if (orgRole === OrgRole.ORG_OWNER) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Legacy simple helpers (backward compatible, used during migration)
// These use just the platform role string for quick checks.
// ---------------------------------------------------------------------------

export function canRedact(role?: UserRole | string): boolean {
  if (!role) return false;
  const r = role.toUpperCase();
  return r === "OWNER" || r === "EDITOR" || r === "ADMIN" || r === "USER";
}

export function canShare(role?: UserRole | string): boolean {
  if (!role) return false;
  const r = role.toUpperCase();
  return r === "OWNER" || r === "ADMIN" || r === "USER";
}

export function canDelete(role?: UserRole | string): boolean {
  if (!role) return false;
  const r = role.toUpperCase();
  return r === "OWNER" || r === "ADMIN" || r === "USER";
}

export function canRevokeShare(role?: UserRole | string): boolean {
  if (!role) return false;
  const r = role.toUpperCase();
  return r === "OWNER" || r === "ADMIN" || r === "USER";
}

export function isAdmin(role?: UserRole | string): boolean {
  if (!role) return false;
  return role.toUpperCase() === "ADMIN";
}
