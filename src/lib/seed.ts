/**
 * Database seeding: permissions and system roles.
 * Idempotent - safe to run multiple times.
 * Optimized with bulk operations.
 */

import { db } from '@/lib/db';
import { DEFAULT_ROLES, PERMISSION_MODULES, PERMISSION_ACTIONS } from '@/lib/constants';

/**
 * Seed all permissions for all modules and actions using bulk create.
 */
async function seedPermissions() {
  const existingCodes = new Set(
    (await db.permission.findMany({ select: { code: true } })).map(p => p.code)
  );

  const toCreate: Array<{ code: string; name: string; module: string; action: string }> = [];
  for (const mod of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      const code = `${mod}.${action}`;
      if (!existingCodes.has(code)) {
        toCreate.push({
          code,
          name: `${mod.charAt(0).toUpperCase() + mod.slice(1)} ${action.charAt(0).toUpperCase() + action.slice(1)}`,
          module: mod,
          action,
        });
      }
    }
  }

  if (toCreate.length > 0) {
    await db.permission.createMany({ data: toCreate });
  }

  return toCreate.map(p => p.code);
}

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
 * Seed all system roles and assign permissions using bulk operations.
 */
async function seedSystemRoles() {
  const allPermissions = await db.permission.findMany({ select: { id: true, code: true } });
  const permMap = new Map(allPermissions.map(p => [p.code, p.id]));
  const allPermissionCodes = allPermissions.map(p => p.code);

  const created: string[] = [];

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

    // Bulk assign permissions for this role
    const rolePerms = getRolePermissions(role.code, allPermissionCodes);
    const rpData = rolePerms
      .map(permCode => {
        const permId = permMap.get(permCode);
        return permId ? { roleCode: role.code, permissionId: permId } : null;
      })
      .filter(Boolean);

    if (rpData.length > 0) {
      await db.rolePermission.createMany({
        data: rpData as Array<{ roleCode: string; permissionId: string }>,
        skipDuplicates: true,
      });
    }
  }

  return created;
}

/**
 * Run all seed operations. Safe to call multiple times.
 */
export async function runSeed() {
  const perms = await seedPermissions();
  const roles = await seedSystemRoles();
  return { permissionsCreated: perms.length, rolesCreated: roles.length };
}