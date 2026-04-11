/**
 * Tests for the context-aware permission helpers.
 *
 * Validates the hierarchical role resolution: file → workspace → org → platform.
 * Ensures the most specific role wins and admin bypasses work correctly.
 */
import { describe, it, expect } from 'vitest';
import {
  canRedact,
  canShare,
  canDelete,
  canRevokeShare,
  isAdmin,
  canRedactCtx,
  canShareCtx,
  canDeleteCtx,
  type PermissionContext,
} from '@/utils/permissions';
import {
  PlatformRole,
  OrgRole,
  WorkspaceRole,
  FileRole,
  type UserRoleContext,
} from '@/types/roles';

// ---------------------------------------------------------------------------
// Helper: build a PermissionContext
// ---------------------------------------------------------------------------
function makeCtx(overrides: Partial<PermissionContext> = {}): PermissionContext {
  return {
    userContext: {
      platform_role: PlatformRole.USER,
      organizations: [],
      workspaces: [],
    },
    fileRole: null,
    workspaceId: null,
    orgId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Legacy (string-based) helpers
// ---------------------------------------------------------------------------
describe('Legacy Permission Helpers', () => {
  describe('canRedact', () => {
    it('returns true for OWNER', () => {
      expect(canRedact('OWNER')).toBe(true);
    });

    it('returns true for USER', () => {
      expect(canRedact('USER')).toBe(true);
    });

    it('returns true for ADMIN', () => {
      expect(canRedact('ADMIN')).toBe(true);
    });

    it('returns false for undefined', () => {
      expect(canRedact(undefined)).toBe(false);
    });

    it('is case insensitive', () => {
      expect(canRedact('admin')).toBe(true);
      expect(canRedact('Owner')).toBe(true);
    });
  });

  describe('canShare', () => {
    it('returns true for OWNER', () => {
      expect(canShare('OWNER')).toBe(true);
    });

    it('returns true for ADMIN', () => {
      expect(canShare('ADMIN')).toBe(true);
    });

    it('returns false for VIEWER', () => {
      expect(canShare('VIEWER')).toBe(false);
    });
  });

  describe('canDelete', () => {
    it('returns true for OWNER', () => {
      expect(canDelete('OWNER')).toBe(true);
    });

    it('returns true for USER', () => {
      expect(canDelete('USER')).toBe(true);
    });

    it('returns false for EDITOR', () => {
      expect(canDelete('EDITOR')).toBe(false);
    });
  });

  describe('canRevokeShare', () => {
    it('mirrors canDelete behavior', () => {
      expect(canRevokeShare('OWNER')).toBe(true);
      expect(canRevokeShare('USER')).toBe(true);
      expect(canRevokeShare('VIEWER')).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('returns true only for ADMIN', () => {
      expect(isAdmin('ADMIN')).toBe(true);
      expect(isAdmin('admin')).toBe(true);
      expect(isAdmin('USER')).toBe(false);
      expect(isAdmin('OWNER')).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Context-aware helpers
// ---------------------------------------------------------------------------
describe('Context-Aware Permission Helpers', () => {
  describe('canRedactCtx', () => {
    it('platform ADMIN can always redact', () => {
      const ctx = makeCtx({
        userContext: {
          platform_role: PlatformRole.ADMIN,
          organizations: [],
          workspaces: [],
        },
      });
      expect(canRedactCtx(ctx)).toBe(true);
    });

    it('FILE_EDITOR can redact', () => {
      const ctx = makeCtx({ fileRole: FileRole.FILE_EDITOR });
      expect(canRedactCtx(ctx)).toBe(true);
    });

    it('FILE_OWNER can redact', () => {
      const ctx = makeCtx({ fileRole: FileRole.FILE_OWNER });
      expect(canRedactCtx(ctx)).toBe(true);
    });

    it('FILE_VIEWER cannot redact', () => {
      const ctx = makeCtx({ fileRole: FileRole.FILE_VIEWER });
      expect(canRedactCtx(ctx)).toBe(false);
    });

    it('WORKSPACE_EDITOR can redact', () => {
      const ctx = makeCtx({
        workspaceId: 'ws-1',
        userContext: {
          platform_role: PlatformRole.USER,
          organizations: [],
          workspaces: [{ workspace_id: 'ws-1', role: WorkspaceRole.WORKSPACE_EDITOR }],
        },
      });
      expect(canRedactCtx(ctx)).toBe(true);
    });

    it('WORKSPACE_VIEWER cannot redact', () => {
      const ctx = makeCtx({
        workspaceId: 'ws-1',
        userContext: {
          platform_role: PlatformRole.USER,
          organizations: [],
          workspaces: [{ workspace_id: 'ws-1', role: WorkspaceRole.WORKSPACE_VIEWER }],
        },
      });
      expect(canRedactCtx(ctx)).toBe(false);
    });

    it('ORG_ADMIN can redact', () => {
      const ctx = makeCtx({
        orgId: 'org-1',
        userContext: {
          platform_role: PlatformRole.USER,
          organizations: [{ org_id: 'org-1', role: OrgRole.ORG_ADMIN }],
          workspaces: [],
        },
      });
      expect(canRedactCtx(ctx)).toBe(true);
    });

    it('ORG_MEMBER cannot redact', () => {
      const ctx = makeCtx({
        orgId: 'org-1',
        userContext: {
          platform_role: PlatformRole.USER,
          organizations: [{ org_id: 'org-1', role: OrgRole.ORG_MEMBER }],
          workspaces: [],
        },
      });
      expect(canRedactCtx(ctx)).toBe(false);
    });

    it('returns false with no context', () => {
      expect(canRedactCtx({})).toBe(false);
    });
  });

  describe('canShareCtx', () => {
    it('FILE_OWNER can share', () => {
      const ctx = makeCtx({ fileRole: FileRole.FILE_OWNER });
      expect(canShareCtx(ctx)).toBe(true);
    });

    it('FILE_EDITOR cannot share', () => {
      const ctx = makeCtx({ fileRole: FileRole.FILE_EDITOR });
      expect(canShareCtx(ctx)).toBe(false);
    });

    it('WORKSPACE_OWNER can share', () => {
      const ctx = makeCtx({
        workspaceId: 'ws-1',
        userContext: {
          platform_role: PlatformRole.USER,
          organizations: [],
          workspaces: [{ workspace_id: 'ws-1', role: WorkspaceRole.WORKSPACE_OWNER }],
        },
      });
      expect(canShareCtx(ctx)).toBe(true);
    });
  });

  describe('canDeleteCtx', () => {
    it('FILE_OWNER can delete', () => {
      const ctx = makeCtx({ fileRole: FileRole.FILE_OWNER });
      expect(canDeleteCtx(ctx)).toBe(true);
    });

    it('FILE_EDITOR cannot delete', () => {
      const ctx = makeCtx({ fileRole: FileRole.FILE_EDITOR });
      expect(canDeleteCtx(ctx)).toBe(false);
    });

    it('ORG_OWNER can delete', () => {
      const ctx = makeCtx({
        orgId: 'org-1',
        userContext: {
          platform_role: PlatformRole.USER,
          organizations: [{ org_id: 'org-1', role: OrgRole.ORG_OWNER }],
          workspaces: [],
        },
      });
      expect(canDeleteCtx(ctx)).toBe(true);
    });

    it('ORG_ADMIN cannot delete', () => {
      const ctx = makeCtx({
        orgId: 'org-1',
        userContext: {
          platform_role: PlatformRole.USER,
          organizations: [{ org_id: 'org-1', role: OrgRole.ORG_ADMIN }],
          workspaces: [],
        },
      });
      expect(canDeleteCtx(ctx)).toBe(false);
    });
  });
});
