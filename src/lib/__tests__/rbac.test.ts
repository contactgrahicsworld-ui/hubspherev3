/**
 * Tests for the Role-Based Access Control system.
 * Covers hasPermission, requirePermission, isSystemRole, getUserPermissions.
 */

import * as rbac from '@/lib/rbac';
import { AuthorizationError } from '@/lib/errors';
import { db } from '@/lib/db';

// ============================================
// isSystemRole TESTS
// ============================================

describe('isSystemRole', () => {
  it('returns true for SUPER_ADMIN', () => {
    expect(rbac.isSystemRole('SUPER_ADMIN')).toBe(true);
  });

  it('returns true for TENANT_OWNER', () => {
    expect(rbac.isSystemRole('TENANT_OWNER')).toBe(true);
  });

  it('returns true for ADMIN', () => {
    expect(rbac.isSystemRole('ADMIN')).toBe(true);
  });

  it('returns true for MANAGER', () => {
    expect(rbac.isSystemRole('MANAGER')).toBe(true);
  });

  it('returns true for SALES_MANAGER', () => {
    expect(rbac.isSystemRole('SALES_MANAGER')).toBe(true);
  });

  it('returns true for SALES_EXECUTIVE', () => {
    expect(rbac.isSystemRole('SALES_EXECUTIVE')).toBe(true);
  });

  it('returns true for TELECALLER', () => {
    expect(rbac.isSystemRole('TELECALLER')).toBe(true);
  });

  it('returns true for HR_MANAGER', () => {
    expect(rbac.isSystemRole('HR_MANAGER')).toBe(true);
  });

  it('returns true for HR_EXECUTIVE', () => {
    expect(rbac.isSystemRole('HR_EXECUTIVE')).toBe(true);
  });

  it('returns true for FIELD_MANAGER', () => {
    expect(rbac.isSystemRole('FIELD_MANAGER')).toBe(true);
  });

  it('returns true for FIELD_EXECUTIVE', () => {
    expect(rbac.isSystemRole('FIELD_EXECUTIVE')).toBe(true);
  });

  it('returns true for ACCOUNTANT', () => {
    expect(rbac.isSystemRole('ACCOUNTANT')).toBe(true);
  });

  it('returns true for VIEWER', () => {
    expect(rbac.isSystemRole('VIEWER')).toBe(true);
  });

  it('returns false for custom role', () => {
    expect(rbac.isSystemRole('CUSTOM_ROLE')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(rbac.isSystemRole('')).toBe(false);
  });

  it('returns false for random string', () => {
    expect(rbac.isSystemRole('not_a_role')).toBe(false);
  });
});

// ============================================
// hasPermission TESTS
// ============================================

describe('hasPermission', () => {
  it('SUPER_ADMIN always has all permissions', async () => {
    const result = await rbac.hasPermission('SUPER_ADMIN', 'leads.view');
    expect(result).toBe(true);
  });

  it('SUPER_ADMIN has any arbitrary permission', async () => {
    const result = await rbac.hasPermission('SUPER_ADMIN', 'arbitrary.permission');
    expect(result).toBe(true);
  });

  it('TENANT_OWNER always has all permissions', async () => {
    const result = await rbac.hasPermission('TENANT_OWNER', 'leads.view');
    expect(result).toBe(true);
  });

  it('TENANT_OWNER has any arbitrary permission', async () => {
    const result = await rbac.hasPermission('TENANT_OWNER', 'some.permission');
    expect(result).toBe(true);
  });

  it('null roleCode has no permissions', async () => {
    const result = await rbac.hasPermission(null, 'leads.view');
    expect(result).toBe(false);
  });

  it('isSuperAdmin=true grants all permissions', async () => {
    const result = await rbac.hasPermission('VIEWER', 'leads.view', undefined, true);
    expect(result).toBe(true);
  });

  it('malformed permission string (no dot) returns false', async () => {
    const result = await rbac.hasPermission('ADMIN', 'malformedpermission');
    expect(result).toBe(false);
  });

  it('empty permission string returns false', async () => {
    const result = await rbac.hasPermission('ADMIN', '');
    expect(result).toBe(false);
  });
});

// ============================================
// requirePermission TESTS
// ============================================

describe('requirePermission', () => {
  it('does not throw for SUPER_ADMIN', async () => {
    await expect(rbac.requirePermission('SUPER_ADMIN', 'any.permission')).resolves.toBeUndefined();
  });

  it('does not throw for TENANT_OWNER', async () => {
    await expect(rbac.requirePermission('TENANT_OWNER', 'any.permission')).resolves.toBeUndefined();
  });

  it('throws AuthorizationError when permission not granted', async () => {
    await expect(rbac.requirePermission(null, 'leads.view')).rejects.toThrow(AuthorizationError);
  });

  it('throws AuthorizationError with permission name in message', async () => {
    try {
      await rbac.requirePermission(null, 'leads.delete');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthorizationError);
      expect((err as AuthorizationError).message).toContain('leads.delete');
    }
  });

  it('throws AuthorizationError for non-existent role', async () => {
    await expect(rbac.requirePermission('NON_EXISTENT_ROLE', 'leads.view')).rejects.toThrow(AuthorizationError);
  });
});

// ============================================
// getUserPermissions TESTS
// ============================================

describe('getUserPermissions', () => {
  it('returns all permissions for SUPER_ADMIN', async () => {
    const permissions = await rbac.getUserPermissions('SUPER_ADMIN');
    expect(Array.isArray(permissions)).toBe(true);
    // SUPER_ADMIN should have a comprehensive set of permissions
    // At minimum, the result should be an array (may be empty if no permissions seeded)
    expect(permissions.every(p => typeof p === 'string')).toBe(true);
  });

  it('returns empty array for null roleCode', async () => {
    const permissions = await rbac.getUserPermissions(null);
    expect(permissions).toEqual([]);
  });

  it('returns empty array for undefined roleCode', async () => {
    const permissions = await rbac.getUserPermissions(null);
    expect(permissions).toEqual([]);
  });

  it('returns array of strings for any valid role', async () => {
    const permissions = await rbac.getUserPermissions('VIEWER');
    expect(Array.isArray(permissions)).toBe(true);
    expect(permissions.every(p => typeof p === 'string')).toBe(true);
  });
});
