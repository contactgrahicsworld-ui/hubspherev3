const { Client } = require('pg');
const { randomUUID } = require('crypto');

const CONN = 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const c = new Client({ connectionString: CONN });
  await c.connect();

  const newPerms = [
    'activities.view', 'automation.execute', 'dashboard.view',
    'expenses.approve', 'expenses.reject', 'leave.approve', 'leave.reject',
    'messages.update', 'notes.create', 'notes.delete', 'notes.edit', 'notes.view',
    'tags.create', 'tags.delete', 'tags.view'
  ];

  const permRes = await c.query('SELECT id, code FROM permissions WHERE code = ANY($1)', [newPerms]);
  const permMap = new Map(permRes.rows.map(r => [r.code, r.id]));

  const rolesRes = await c.query('SELECT code FROM roles');
  const roles = rolesRes.rows.map(r => r.code);

  const viewOnlyPerms = new Set(['notes.view', 'tags.view', 'activities.view', 'dashboard.view']);
  let count = 0;

  for (const role of roles) {
    const isViewer = role === 'VIEWER';
    for (const [code, id] of permMap) {
      if (isViewer && !viewOnlyPerms.has(code)) continue;
      await c.query(
        'INSERT INTO role_permissions(id, role_code, permission_id, created_at) VALUES($1, $2, $3, NOW()) ON CONFLICT DO NOTHING',
        [randomUUID(), role, id]
      );
      count++;
    }
  }

  console.log('Assigned ' + count + ' role-permission combos');

  // Verify
  const v = await c.query("SELECT rp.role_code, p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'dashboard.view' ORDER BY rp.role_code");
  console.log('dashboard.view assigned to:', v.rows.map(r => r.role_code).join(', '));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
