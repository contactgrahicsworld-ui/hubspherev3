/**
 * Role-Based Access Control enforcement.
 * Permissions are enforced at the backend API level.
 * Frontend hiding is NOT security.
 */

import { db } from '@/lib/db';
import { AuthorizationError } from '@/lib/errors';

/**
 * Check if a role has a specific permission.
 * Super admins always have all permissions.
 * System roles (tenantId=null) are shared across tenants.
 * Custom roles are verified to belong to the tenant.
 */
export async function hasPermission(
  roleCode: string | null,
  permission: string,
  tenantId?: string,
  isSuperAdmin?: boolean
): Promise<boolean> {
  // Super admins have all permissions (via role code OR isSuperAdmin flag)
  if (roleCode === 'SUPER_ADMIN' || isSuperAdmin) {
    return true;
  }

  if (!roleCode) {
    return false;
  }

  // For tenant-scoped checks, verify the role exists for this tenant
  // (either as a system role or a tenant-specific custom role)
  if (tenantId) {
    const roleExists = await db.role.findFirst({
      where: {
        code: roleCode,
        OR: [
          { tenantId: null },  // System role
          { tenantId },          // Tenant-specific role
        ],
      },
    });
    if (!roleExists) {
      return false;
    }
  }

  // Check for wildcard permissions (e.g., users.*)
  const [module, action] = permission.split('.');
  if (!module || !action) {
    return false;
  }

  // Check for exact permission
  const exactPermission = await db.permission.findUnique({
    where: { code: permission },
    include: {
      roles: {
        where: { roleCode },
      },
    },
  });

  if (exactPermission && exactPermission.roles.length > 0) {
    return true;
  }

  // Check for wildcard permission (module.*)
  if (action !== '*') {
    const wildcardPermission = await db.permission.findUnique({
      where: { code: `${module}.*` },
      include: {
        roles: {
          where: { roleCode },
        },
      },
    });

    if (wildcardPermission && wildcardPermission.roles.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Require a specific permission. Throws AuthorizationError if not granted.
 */
export async function requirePermission(
  roleCode: string | null,
  permission: string,
  tenantId?: string,
  isSuperAdmin?: boolean
): Promise<void> {
  const granted = await hasPermission(roleCode, permission, tenantId, isSuperAdmin);
  if (!granted) {
    throw new AuthorizationError(
      `Permission denied: ${permission}`
    );
  }
}

/**
 * Get all permissions for a given role.
 */
export async function getUserPermissions(
  roleCode: string | null,
  tenantId?: string
): Promise<string[]> {
  if (roleCode === 'SUPER_ADMIN') {
    // Return all permissions for super admin
    const allPermissions = await db.permission.findMany({
      select: { code: true },
    });
    return allPermissions.map((p) => p.code);
  }

  if (!roleCode) {
    return [];
  }

  const rolePermissions = await db.rolePermission.findMany({
    where: { roleCode },
    include: {
      permission: {
        select: { code: true },
      },
    },
  });

  return rolePermissions.map((rp) => rp.permission.code);
}

/**
 * Check if a role is a system-level role (not tenant-scoped).
 */
export function isSystemRole(roleCode: string): boolean {
  const systemRoles = [
    'SUPER_ADMIN',
    'TENANT_OWNER',
    'ADMIN',
    'MANAGER',
    'SALES_MANAGER',
    'SALES_EXECUTIVE',
    'TELECALLER',
    'HR_MANAGER',
    'HR_EXECUTIVE',
    'FIELD_MANAGER',
    'FIELD_EXECUTIVE',
    'ACCOUNTANT',
    'VIEWER',
  ];
  return systemRoles.includes(roleCode);
}
// trigger deploy
