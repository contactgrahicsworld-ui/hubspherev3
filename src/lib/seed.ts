/**
 * Database seeding: permissions and system roles.
 * Idempotent - safe to run multiple times.
 * Optimized for Supabase pooler — uses raw SQL for bulk ops.
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
 * SQL-escape a string literal for safe interpolation.
 */
function esc(val: string): string {
  return val.replace(/'/g, "''");
}

/**
 * Run all seed operations using raw SQL for speed.
 * Reduces ~50 sequential Prisma calls to ~5 raw SQL calls.
 */
export async function runSeed() {
  // 1. Build and insert all permissions in ONE query
  const permRows: string[] = [];
  const allPermCodes: string[] = [];

  for (const mod of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      const code = `${mod}.${action}`;
      allPermCodes.push(code);
      const name = `${mod.charAt(0).toUpperCase() + mod.slice(1)} ${action.charAt(0).toUpperCase() + action.slice(1)}`;
      permRows.push(`('${esc(code)}', '${esc(name)}', '${esc(mod)}', '${esc(action)}')`);
    }
  }

  await db.$executeRawUnsafe(`
    INSERT INTO permissions (code, name, module, action)
    VALUES ${permRows.join(', ')}
    ON CONFLICT (code) DO NOTHING
  `);

  // 2. Get permission IDs in one query
  const perms: Array<{ id: string; code: string }> =
    await db.$queryRawUnsafe(`SELECT id, code FROM permissions ORDER BY code`);
  const permMap = new Map(perms.map(p => [p.code, p.id]));

  // 3. Insert all roles in ONE query
  const roleRows: string[] = [];
  for (const role of DEFAULT_ROLES) {
    roleRows.push(`('${esc(role.code)}', '${esc(role.name)}', '${esc(role.description || '')}', true, NULL)`);
  }

  await db.$executeRawUnsafe(`
    INSERT INTO roles (code, name, description, "isSystem", "tenantId")
    VALUES ${roleRows.join(', ')}
    ON CONFLICT ("tenantId", code) DO NOTHING
  `);

  // 4. Build all role_permission rows
  const rpRows: string[] = [];
  for (const role of DEFAULT_ROLES) {
    const permCodes = getRolePermissions(role.code, allPermCodes);
    for (const pc of permCodes) {
      const pid = permMap.get(pc);
      if (pid) {
        rpRows.push(`('${esc(role.code)}', '${esc(pid)}')`);
      }
    }
  }

  // 5. Delete old and insert all role_permissions in 2 queries
  await db.$executeRawUnsafe(`DELETE FROM role_permissions`);

  // Insert in batches of 500 to avoid query size limits
  const BATCH = 500;
  for (let i = 0; i < rpRows.length; i += BATCH) {
    const batch = rpRows.slice(i, i + BATCH);
    await db.$executeRawUnsafe(
      `INSERT INTO role_permissions ("roleCode", "permissionId") VALUES ${batch.join(', ')}`
    );
  }

  return { permissionsCreated: allPermCodes.length, rolesCreated: DEFAULT_ROLES.length };
}
