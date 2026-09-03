const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true' } }
});

const MODULES = [
  'users','roles','tenants','audit','leads','contacts','companies','deals','calls','recordings',
  'tasks','followups','employees','departments','designations','attendance','leave','field','visits',
  'expenses','payroll','conversations','messages','templates','communication_settings','notifications',
  'automation','webhooks','ai','subscriptions','features','settings','activities','dashboard','notes','tags'
];
const ACTIONS = ['view','create','edit','delete','manage','export','import','execute','approve','reject','update'];

const ROLES = [
  {code:'SUPER_ADMIN',name:'Super Admin',desc:'Platform administrator with full access'},
  {code:'TENANT_OWNER',name:'Tenant Owner',desc:'Tenant owner with full access within org'},
  {code:'ADMIN',name:'Admin',desc:'Organization administrator with broad access'},
  {code:'MANAGER',name:'Manager',desc:'Team manager with reporting access'},
  {code:'SALES_MANAGER',name:'Sales Manager',desc:'Manages sales team and deals pipeline'},
  {code:'SALES_EXECUTIVE',name:'Sales Executive',desc:'Handles leads, contacts, and deals'},
  {code:'TELECALLER',name:'Telecaller',desc:'Makes and manages calls'},
  {code:'HR_MANAGER',name:'HR Manager',desc:'Manages employees, attendance, payroll'},
  {code:'HR_EXECUTIVE',name:'HR Executive',desc:'Day-to-day HR operations'},
  {code:'FIELD_MANAGER',name:'Field Manager',desc:'Manages field operations'},
  {code:'FIELD_EXECUTIVE',name:'Field Executive',desc:'Performs field activities'},
  {code:'ACCOUNTANT',name:'Accountant',desc:'Manages financial records and payroll'},
  {code:'VIEWER',name:'Viewer',desc:'Read-only access across modules'},
];

function getRolePerms(code, allCodes) {
  switch(code) {
    case 'SUPER_ADMIN': return [...allCodes];
    case 'TENANT_OWNER': return allCodes.filter(c=>!['tenants.create','tenants.suspend','tenants.delete'].includes(c));
    case 'ADMIN': return allCodes.filter(c=>!['tenants.create','tenants.edit','tenants.delete','tenants.suspend','audit.delete','features.manage'].includes(c));
    case 'MANAGER': { const inc=['users','roles','leads','contacts','companies','deals','calls','recordings','audit']; return allCodes.filter(c=>{const m=c.split('.')[0];return inc.includes(m)&&!c.endsWith('.delete')});}
    case 'SALES_MANAGER': return allCodes.filter(c=>c.startsWith('leads.')||c.startsWith('contacts.')||c.startsWith('companies.')||c.startsWith('deals.')||c.startsWith('calls.'));
    case 'SALES_EXECUTIVE': return allCodes.filter(c=>(c.startsWith('leads.')||c.startsWith('contacts.')||c.startsWith('deals.')||c.startsWith('calls.'))&&!c.endsWith('.delete'));
    case 'TELECALLER': return allCodes.filter(c=>(c.startsWith('calls.')||c.startsWith('contacts.'))&&!c.endsWith('.delete'));
    case 'HR_MANAGER': return allCodes.filter(c=>c.startsWith('employees.')||c.startsWith('departments.')||c.startsWith('designations.')||c.startsWith('attendance.')||c.startsWith('leave.')||c.startsWith('payroll.')||c.startsWith('expenses.')||c==='users.view');
    case 'HR_EXECUTIVE': return allCodes.filter(c=>(c.startsWith('employees.')||c.startsWith('departments.')||c.startsWith('designations.')||c.startsWith('attendance.')||c.startsWith('leave.'))&&!c.endsWith('.delete'));
    case 'FIELD_MANAGER': return allCodes.filter(c=>(c.startsWith('leads.')||c.startsWith('contacts.')||c.startsWith('field.')||c.startsWith('visits.')||c.startsWith('expenses.')||c.startsWith('attendance.'))&&!c.endsWith('.delete'));
    case 'FIELD_EXECUTIVE': return allCodes.filter(c=>(c.startsWith('leads.')||c.startsWith('contacts.')||c.startsWith('visits.')||c.startsWith('expenses.')||c.startsWith('attendance.'))&&!c.endsWith('.delete')&&c!=='expenses.approve'&&c!=='expenses.reject');
    case 'ACCOUNTANT': return allCodes.filter(c=>c.startsWith('payroll.')||c.startsWith('subscriptions.')||c==='users.view');
    default: return allCodes.filter(c=>c.endsWith('.view'));
  }
}

(async () => {
  try {
    // 1. Bulk insert permissions (one big multi-row INSERT)
    const permValues = [];
    for (const mod of MODULES) {
      for (const action of ACTIONS) {
        const code = mod + '.' + action;
        const name = mod.charAt(0).toUpperCase() + mod.slice(1) + ' ' + action.charAt(0).toUpperCase() + action.slice(1);
        permValues.push("(gen_random_uuid(), '" + code.replace(/'/g, "''") + "', '" + name.replace(/'/g, "''") + "', '" + mod + "', '" + action + "')");
      }
    }
    // Split into chunks of 100
    for (let i = 0; i < permValues.length; i += 100) {
      const chunk = permValues.slice(i, i + 100);
      const sql = 'INSERT INTO permissions (id, code, name, module, action) VALUES ' + chunk.join(', ') + ' ON CONFLICT (code) DO NOTHING';
      await p.$executeRawUnsafe(sql);
    }
    console.log('Permissions seeded: ' + permValues.length);

    // 2. Get all permission IDs
    const perms = await p.$queryRawUnsafe('SELECT id, code FROM permissions');
    const permMap = new Map(perms.map(x => [x.code, x.id]));
    const allCodes = perms.map(x => x.code);
    console.log('Total permissions in DB:', allCodes.length);

    // 3. Bulk insert roles
    const roleValues = ROLES.map(r =>
      "(gen_random_uuid(), '" + r.code + "', '" + r.name.replace(/'/g, "''") + "', '" + r.desc.replace(/'/g, "''") + "', true, NULL, NOW())"
    ).join(', ');
    await p.$executeRawUnsafe(
      'INSERT INTO roles (id, code, name, description, is_system, tenant_id, updated_at) VALUES ' + roleValues + ' ON CONFLICT (code) WHERE tenant_id IS NULL DO NOTHING'
    );
    console.log('Roles seeded: ' + ROLES.length);

    // 4. Bulk insert role_permissions per role
    for (const role of ROLES) {
      const rolePerms = getRolePerms(role.code, allCodes);
      // Delete existing
      await p.$executeRawUnsafe("DELETE FROM role_permissions WHERE role_code = '" + role.code + "'");
      // Bulk insert in chunks of 200
      for (let i = 0; i < rolePerms.length; i += 200) {
        const chunk = rolePerms.slice(i, i + 200);
        const values = chunk.map(pc => {
          const pid = permMap.get(pc);
          return pid ? "(gen_random_uuid(), '" + role.code + "', '" + pid + "'::uuid)" : null;
        }).filter(Boolean).join(', ');
        if (values) {
          await p.$executeRawUnsafe('INSERT INTO role_permissions (id, role_code, permission_id) VALUES ' + values + ' ON CONFLICT DO NOTHING');
        }
      }
      console.log(role.code + ': ' + rolePerms.length + ' permissions assigned');
    }

    console.log('SEED COMPLETE!');
  } catch(e) { console.error('Seed error:', e.message); }
  await p.$disconnect();
})();
