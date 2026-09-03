/**
 * Database seeding: permissions and system roles.
 * Idempotent — safe to run multiple times.
 * Uses raw SQL with multi-row INSERTs for PgBouncer compatibility.
 * Optimized to run in < 5 seconds through PgBouncer.
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
 * Run all seed operations using raw SQL for PgBouncer compatibility.
 * Uses minimal queries: ~8 total for the entire seed.
 */
export async function runSeed() {
  // 1. Bulk insert all permissions (4 queries for 396 permissions)
  const permValues: string[] = [];
  for (const mod of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      const code = `${mod}.${action}`;
      const name = `${mod.charAt(0).toUpperCase() + mod.slice(1)} ${action.charAt(0).toUpperCase() + action.slice(1)}`;
      permValues.push(`(gen_random_uuid(), '${code.replace(/'/g, "''")}', '${name.replace(/'/g, "''")}', '${mod}', '${action}')`);
    }
  }
  for (let i = 0; i < permValues.length; i += 100) {
    const chunk = permValues.slice(i, i + 100);
    await db.$executeRawUnsafe(
      `INSERT INTO permissions (id, code, name, module, action) VALUES ${chunk.join(', ')} ON CONFLICT (code) DO NOTHING`
    );
  }

  // 2. Get all permission IDs (1 query)
  const allPermissions = await db.$queryRawUnsafe<Array<{ id: string; code: string }>>(
    `SELECT id, code FROM permissions`
  );
  const permMap = new Map(allPermissions.map((p) => [p.code, p.id]));
  const allPermissionCodes = allPermissions.map((p) => p.code);

  // 3. Bulk insert all roles (1 query)
  const roleValues = DEFAULT_ROLES.map((r) =>
    `(gen_random_uuid(), '${r.code}', '${r.name.replace(/'/g, "''")}', '${r.description.replace(/'/g, "''")}', true, NULL, NOW())`
  ).join(', ');
  await db.$executeRawUnsafe(
    `INSERT INTO roles (id, code, name, description, is_system, tenant_id, updated_at) VALUES ${roleValues} ON CONFLICT (code) WHERE tenant_id IS NULL DO NOTHING`
  );

  // 4. Build ALL role-permission pairs at once
  const allRpValues: string[] = [];
  for (const role of DEFAULT_ROLES) {
    const rolePerms = getRolePermissions(role.code, allPermissionCodes);
    for (const pc of rolePerms) {
      const pid = permMap.get(pc);
      if (pid) {
        allRpValues.push(`(gen_random_uuid(), '${role.code}', '${pid}'::uuid)`);
      }
    }
  }

  // 5. Delete all existing role-permission assignments (1 query)
  await db.$executeRawUnsafe(`DELETE FROM role_permissions`);

  // 6. Insert all role-permission pairs in bulk (3 queries for ~3000 pairs)
  for (let i = 0; i < allRpValues.length; i += 1000) {
    const chunk = allRpValues.slice(i, i + 1000);
    await db.$executeRawUnsafe(
      `INSERT INTO role_permissions (id, role_code, permission_id) VALUES ${chunk.join(', ')}`
    );
  }

  return {
    permissionsCreated: permValues.length,
    rolesCreated: DEFAULT_ROLES.length,
  };
}
