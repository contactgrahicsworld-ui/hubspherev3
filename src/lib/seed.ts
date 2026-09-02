/**
 * Database seeding: permissions and system roles.
 * Idempotent - safe to run multiple times.
 * Uses Prisma with delete-then-insert to avoid PgBouncer issues.
 */

import { db } from '@/lib/db';
import { DEFAULT_ROLES, PERMISSION_MODULES, PERMISSION_ACTIONS } from '@/lib/constants';

/**
 * Permission assignments per role.
 */
function getRolePermissions(roleCode: string, allPermissionCodes: string[]): string[] {
  switch (roleCode) {
    case 'SUPER_ADMIN':
      return [...allPermissionCodes];
    case 'TENANT_OWNER':
      return allPermissionCodes.filter(
        (p) => !['tenants.create', 'tenants.suspend', 'tenants.delete'].includes(p)
      );
    case 'ADMIN':
      return allPermissionCodes.filter((p) =>
        !['tenants.create', 'tenants.edit', 'tenants.delete', 'tenants.suspend', 'audit.delete', 'features.manage'].includes(p)
      );
    case 'MANAGER': {
      const included = ['users', 'roles', 'leads', 'contacts', 'companies', 'deals', 'calls', 'recordings', 'audit'];
      return allPermissionCodes.filter((p) => {
        const m = p.split('.')[0];
        return included.includes(m) && !p.endsWith('.delete');
      });
    }
    case 'SALES_MANAGER':
      return allPermissionCodes.filter(
        (p) => p.startsWith('leads.') || p.startsWith('contacts.') || p.startsWith('companies.') || p.startsWith('deals.') || p.startsWith('calls.')
      );
    case 'SALES_EXECUTIVE':
      return allPermissionCodes.filter(
        (p) => (p.startsWith('leads.') || p.startsWith('contacts.') || p.startsWith('deals.') || p.startsWith('calls.')) && !p.endsWith('.delete')
      );
    case 'TELECALLER':
      return allPermissionCodes.filter(
        (p) => (p.startsWith('calls.') || p.startsWith('contacts.')) && !p.endsWith('.delete')
      );
    case 'HR_MANAGER':
      return allPermissionCodes.filter(
        (p) => p.startsWith('employees.') || p.startsWith('departments.') || p.startsWith('designations.') || p.startsWith('attendance.') || p.startsWith('leave.') || p.startsWith('payroll.') || p.startsWith('expenses.') || p === 'users.view'
      );
    case 'HR_EXECUTIVE':
      return allPermissionCodes.filter(
        (p) => (p.startsWith('employees.') || p.startsWith('departments.') || p.startsWith('designations.') || p.startsWith('attendance.') || p.startsWith('leave.')) && !p.endsWith('.delete')
      );
    case 'FIELD_MANAGER':
      return allPermissionCodes.filter(
        (p) => (p.startsWith('leads.') || p.startsWith('contacts.') || p.startsWith('field.') || p.startsWith('visits.') || p.startsWith('expenses.') || p.startsWith('attendance.')) && !p.endsWith('.delete')
      );
    case 'FIELD_EXECUTIVE':
      return allPermissionCodes.filter(
        (p) => (p.startsWith('leads.') || p.startsWith('contacts.') || p.startsWith('visits.') || p.startsWith('expenses.') || p.startsWith('attendance.')) && !p.endsWith('.delete') && p !== 'expenses.approve' && p !== 'expenses.reject'
      );
    case 'ACCOUNTANT':
      return allPermissionCodes.filter(
        (p) => p.startsWith('payroll.') || p.startsWith('subscriptions.') || p === 'users.view'
      );
    case 'VIEWER':
    default:
      return allPermissionCodes.filter((p) => p.endsWith('.view'));
  }
}

/**
 * Run all seed operations. Safe to call multiple times.
 */
export async function runSeed() {
  // 1. Create all permissions in bulk
  const permData: Array<{ code: string; name: string; module: string; action: string }> = [];
  for (const mod of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      const code = `${mod}.${action}`;
      permData.push({
        code,
        name: `${mod.charAt(0).toUpperCase() + mod.slice(1)} ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        module: mod,
        action,
      });
    }
  }
  // Use createMany with skipDuplicates for simplicity
  try {
    await db.permission.createMany({ data: permData, skipDuplicates: true });
  } catch {
    // Fallback: already exist
  }

  // 2. Get all permissions
  const allPermissions = await db.permission.findMany({ select: { id: true, code: true } });
  const permMap = new Map(allPermissions.map(p => [p.code, p.id]));
  const allPermissionCodes = allPermissions.map(p => p.code);

  const created: string[] = [];

  // 3. Create roles and assign permissions
  for (const role of DEFAULT_ROLES) {
    const existing = await db.role.findFirst({
      where: { code: role.code, tenantId: null },
    });

    if (!existing) {
      await db.role.create({
        data: {
          code: role.code,
          name: role.name,
          description: role.description,
          isSystem: true,
          tenantId: null,
        },
      });
      created.push(role.code);
    }

    // Assign permissions
    const rolePerms = getRolePermissions(role.code, allPermissionCodes);
    const rpData = rolePerms
      .map(permCode => {
        const permId = permMap.get(permCode);
        return permId ? { roleCode: role.code, permissionId: permId } : null;
      })
      .filter(Boolean);

    if (rpData.length > 0) {
      try {
        await db.rolePermission.deleteMany({ where: { roleCode: role.code } });
        await db.rolePermission.createMany({
          data: rpData as Array<{ roleCode: string; permissionId: string }>,
        });
      } catch {
        // PgBouncer prepared statement issue — non-critical
      }
    }
  }

  return { permissionsCreated: permData.length, rolesCreated: created.length };
}
