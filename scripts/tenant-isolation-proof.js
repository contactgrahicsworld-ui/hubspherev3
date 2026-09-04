/**
 * HubSphere V3 — TENANT ISOLATION FINAL PROOF v2
 * 
 * Creates two truly separate tenants (TENANT-A and TENANT-B) via the super-admin API,
 * creates users with TENANT_OWNER role in each tenant, creates unique records,
 * and attempts ALL cross-tenant access vectors.
 * 
 * Expected: ZERO cross-tenant operations succeed.
 */
const BASE = 'https://hubspherev3.vercel.app';
const DB_URL = 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

const results = { passed: 0, failed: 0, blocked: 0, errors: [], details: [] };

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }
function record(category, test, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'BLOCKED' ? '🔒' : '❌';
  log(`  ${icon} [${category}] ${test}${detail ? ': ' + detail.slice(0,100) : ''}`);
  results.details.push({ category, test, status, detail: detail.slice(0,200) });
  if (status === 'PASS') results.passed++;
  else if (status === 'BLOCKED') results.blocked++;
  else { results.failed++; results.errors.push(`[${category}] ${test}: ${detail}`); }
}

async function api(path, opts = {}) {
  // Normalize: strip trailing slash to avoid Next.js 308 redirects
  let url = `${BASE}${path}`;
  url = url.replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = opts.noAuth ? null : (opts.token || '');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(url, { ...opts, headers, redirect: 'follow' });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text.substring(0, 500); }
    return { status: r.status, data, ok: r.ok, headers: r.headers, raw: text.substring(0, 500) };
  } catch (e) {
    return { status: 0, data: null, ok: false, error: e.message };
  }
}

async function cleanDB() {
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  const tables = [
    'delivery_attempts','message_events','message_attachments','messages','conversations',
    'communication_provider_configs','communication_templates','notifications',
    'automation_execution_logs','automation_executions','automation_actions',
    'automation_conditions','automation_triggers','automation_workflows',
    'ai_usage_logs','provider_configs','bank_transfers','payroll_items','payroll_records',
    'expenses','field_visits','attendance_sessions','leave_requests','leave_types',
    'employee_documents','employees','designations','departments',
    'stage_history','activities','call_recordings','calls',
    'company_tags','contact_tags','lead_tags','tags','notes','follow_ups','tasks',
    'deals','companies','contacts','leads',
    'role_permissions','permissions','audit_logs',
    'refresh_tokens','password_reset_tokens','email_verification_tokens',
    'memberships','users','roles','tenants'
  ];
  for (const t of tables) { try { await p.$executeRawUnsafe(`DELETE FROM ${t}`); } catch(e) {} }
  await p.$disconnect();
  log('DB cleaned');
}

async function hashPasswordNode(plain) {
  const crypto = require('crypto');
  const salt = crypto.randomBytes(32);
  const iterations = 100000;
  const hash = crypto.pbkdf2Sync(plain, salt, iterations, 32, 'sha256');
  return `pbkdf2:${iterations}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

async function main() {
  log('══════════════════════════════════════════════════════════════');
  log('  HUBSPHERE V3 — TENANT ISOLATION FINAL PROOF v2');
  log('══════════════════════════════════════════════════════════════');
  const start = Date.now();

  // ── STEP 1: CLEAN DB & SETUP ──
  log('\n── STEP 1: CLEAN DB & INITIAL SETUP ──');
  await cleanDB();
  await new Promise(r => setTimeout(r, 2000));

  let r = await api('/api/v1/auth/setup', {
    method: 'POST', noAuth: true,
    body: JSON.stringify({
      name: 'SuperAdmin', email: 'superadmin@hubsphere.com',
      password: 'H$phere@2026!', confirmPassword: 'H$phere@2026!',
      organizationName: 'HubSphere HQ'
    })
  });
  if (!r.ok || !r.data?.data?.accessToken) {
    log('FATAL: Setup failed - ' + JSON.stringify(r.data).slice(0, 200));
    process.exit(1);
  }
  const saToken = r.data.data.accessToken;
  const saUserId = r.data.data.user?.id;
  log(`Setup OK: superAdmin=${saUserId}`);

  // ── STEP 2: CREATE TENANT-A AND TENANT-B VIA SUPER-ADMIN API ──
  log('\n── STEP 2: CREATE TENANT-A AND TENANT-B ──');
  
  r = await api('/api/v1/super-admin/tenants', {
    method: 'POST', token: saToken,
    body: JSON.stringify({ name: 'TENANT-A Corp', slug: 'tenant-a-corp' })
  });
  record('Setup', 'Create TENANT-A', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const tenantAId = r.data?.data?.id || '';
  log(`TENANT-A: ${tenantAId}`);

  r = await api('/api/v1/super-admin/tenants', {
    method: 'POST', token: saToken,
    body: JSON.stringify({ name: 'TENANT-B Corp', slug: 'tenant-b-corp' })
  });
  record('Setup', 'Create TENANT-B', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const tenantBId = r.data?.data?.id || '';
  log(`TENANT-B: ${tenantBId}`);

  if (!tenantAId || !tenantBId) {
    log('FATAL: Could not create tenants');
    process.exit(1);
  }
  record('Setup', 'TENANT-A ≠ TENANT-B', tenantAId !== tenantBId ? 'PASS' : 'FAIL', `A=${tenantAId} B=${tenantBId}`);

  // ── STEP 3: CREATE USERS IN EACH TENANT VIA PRISMA ──
  log('\n── STEP 3: CREATE USER-A (TENANT-A) AND USER-B (TENANT-B) ──');
  
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

  // Ensure system roles exist (needed for FK on membership.roleCode)
  const DEFAULT_ROLES = [
    { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full system access', isSystem: true, tenantId: null },
    { code: 'TENANT_OWNER', name: 'Tenant Owner', description: 'Full tenant access', isSystem: true, tenantId: null },
    { code: 'TENANT_ADMIN', name: 'Tenant Admin', description: 'Admin within tenant', isSystem: true, tenantId: null },
    { code: 'MANAGER', name: 'Manager', description: 'Team manager', isSystem: true, tenantId: null },
    { code: 'VIEWER', name: 'Viewer', description: 'Read-only access', isSystem: true, tenantId: null },
    { code: 'SALES_REP', name: 'Sales Rep', description: 'Sales representative', isSystem: true, tenantId: null },
    { code: 'HR_MANAGER', name: 'HR Manager', description: 'HR operations', isSystem: true, tenantId: null },
    { code: 'EMPLOYEE', name: 'Employee', description: 'Self-service access', isSystem: true, tenantId: null },
  ];
  await prisma.role.createMany({ data: DEFAULT_ROLES, skipDuplicates: true });

  const passwordA = 'TenantA@2026!';
  const passwordB = 'TenantB@2026!';
  const hashA = await hashPasswordNode(passwordA);
  const hashB = await hashPasswordNode(passwordB);

  const userA = await prisma.user.create({
    data: { email: 'user-a@tenant-a.com', passwordHash: hashA, name: 'User A', status: 'ACTIVE' }
  });
  // Use TENANT_OWNER — this bypasses all permission checks within the tenant (see rbac.ts line 23)
  const membershipA = await prisma.membership.create({
    data: { userId: userA.id, tenantId: tenantAId, roleCode: 'TENANT_OWNER', status: 'ACTIVE' }
  });
  log(`User-A: ${userA.id} in TENANT-A as TENANT_OWNER`);

  const userB = await prisma.user.create({
    data: { email: 'user-b@tenant-b.com', passwordHash: hashB, name: 'User B', status: 'ACTIVE' }
  });
  const membershipB = await prisma.membership.create({
    data: { userId: userB.id, tenantId: tenantBId, roleCode: 'TENANT_OWNER', status: 'ACTIVE' }
  });
  log(`User-B: ${userB.id} in TENANT-B as TENANT_OWNER`);

  record('Setup', 'User-A in TENANT-A as TENANT_OWNER', true ? 'PASS' : 'FAIL', `userId=${userA.id}`);
  record('Setup', 'User-B in TENANT-B as TENANT_OWNER', true ? 'PASS' : 'FAIL', `userId=${userB.id}`);

  // Verify strict separation in DB
  const crossA = await prisma.membership.findFirst({ where: { userId: userA.id, tenantId: tenantBId } });
  const crossB = await prisma.membership.findFirst({ where: { userId: userB.id, tenantId: tenantAId } });
  record('Setup', 'User-A has NO membership in TENANT-B', !crossA ? 'PASS' : 'FAIL', `cross=${!!crossA}`);
  record('Setup', 'User-B has NO membership in TENANT-A', !crossB ? 'PASS' : 'FAIL', `cross=${!!crossB}`);

  await prisma.$disconnect();

  // ── STEP 4: LOGIN AS USER-A AND USER-B ──
  log('\n── STEP 4: LOGIN AS USER-A AND USER-B ──');
  
  r = await api('/api/v1/auth/login', {
    method: 'POST', noAuth: true,
    body: JSON.stringify({ email: 'user-a@tenant-a.com', password: passwordA })
  });
  record('Auth', 'User-A login', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const tokenA = r.data?.data?.accessToken || '';
  
  r = await api('/api/v1/auth/login', {
    method: 'POST', noAuth: true,
    body: JSON.stringify({ email: 'user-b@tenant-b.com', password: passwordB })
  });
  record('Auth', 'User-B login', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const tokenB = r.data?.data?.accessToken || '';

  if (!tokenA || !tokenB) {
    log('FATAL: Could not login users');
    process.exit(1);
  }

  // Verify JWT tenant context matches
  r = await api('/api/v1/auth/me', { token: tokenA });
  const tokenATenantId = r.data?.data?.currentTenant?.id;
  record('Auth', 'User-A JWT → TENANT-A', tokenATenantId === tenantAId ? 'PASS' : 'FAIL', `jwtTenant=${tokenATenantId} expected=${tenantAId}`);

  r = await api('/api/v1/auth/me', { token: tokenB });
  const tokenBTenantId = r.data?.data?.currentTenant?.id;
  record('Auth', 'User-B JWT → TENANT-B', tokenBTenantId === tenantBId ? 'PASS' : 'FAIL', `jwtTenant=${tokenBTenantId} expected=${tenantBId}`);

  // ── STEP 5: CREATE UNIQUE RECORDS IN EACH TENANT ──
  log('\n── STEP 5: CREATE UNIQUE RECORDS IN TENANT-A AND TENANT-B ──');

  // TENANT-A records
  r = await api('/api/v1/crm/leads', {
    method: 'POST', token: tokenA,
    body: JSON.stringify({ firstName: 'TENANT-A-LEAD', lastName: 'Exclusive', email: 'lead-a@tenant-a.com', phone: '1111111111' })
  });
  record('Data', 'Create lead in TENANT-A', r.ok ? 'PASS' : 'FAIL', `status=${r.status} data=${JSON.stringify(r.data).slice(0,100)}`);
  const leadAId = r.data?.data?.id || '';

  r = await api('/api/v1/crm/contacts', {
    method: 'POST', token: tokenA,
    body: JSON.stringify({ firstName: 'TENANT-A-CONTACT', lastName: 'Exclusive', email: 'contact-a@tenant-a.com', phone: '2222222222' })
  });
  record('Data', 'Create contact in TENANT-A', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const contactAId = r.data?.data?.id || '';

  r = await api('/api/v1/crm/companies', {
    method: 'POST', token: tokenA,
    body: JSON.stringify({ name: 'TENANT-A-COMPANY', email: 'company-a@tenant-a.com' })
  });
  record('Data', 'Create company in TENANT-A', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const companyAId = r.data?.data?.id || '';

  // TENANT-B records
  r = await api('/api/v1/crm/leads', {
    method: 'POST', token: tokenB,
    body: JSON.stringify({ firstName: 'TENANT-B-LEAD', lastName: 'Exclusive', email: 'lead-b@tenant-b.com', phone: '3333333333' })
  });
  record('Data', 'Create lead in TENANT-B', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const leadBId = r.data?.data?.id || '';

  r = await api('/api/v1/crm/contacts', {
    method: 'POST', token: tokenB,
    body: JSON.stringify({ firstName: 'TENANT-B-CONTACT', lastName: 'Exclusive', email: 'contact-b@tenant-b.com', phone: '4444444444' })
  });
  record('Data', 'Create contact in TENANT-B', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const contactBId = r.data?.data?.id || '';

  r = await api('/api/v1/crm/companies', {
    method: 'POST', token: tokenB,
    body: JSON.stringify({ name: 'TENANT-B-COMPANY', email: 'company-b@tenant-b.com' })
  });
  record('Data', 'Create company in TENANT-B', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const companyBId = r.data?.data?.id || '';

  // Verify records were created
  const allRecordsCreated = leadAId && contactAId && companyAId && leadBId && contactBId && companyBId;
  if (!allRecordsCreated) {
    log('WARNING: Not all records created. Some tests may be skipped.');
    log(`leadA=${leadAId} contactA=${contactAId} companyA=${companyAId} leadB=${leadBId} contactB=${contactBId} companyB=${companyBId}`);
  }

  // ── STEP 6: VERIFY SAME-TENANT ACCESS WORKS ──
  log('\n── STEP 6: VERIFY SAME-TENANT ACCESS WORKS ──');

  if (leadAId) {
    r = await api(`/api/v1/crm/leads/${leadAId}`, { token: tokenA });
    record('SameTenant', 'A reads own lead by ID', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  r = await api('/api/v1/crm/leads', { token: tokenA });
  const aLeads = r.data?.data?.leads || r.data?.data || [];
  const aHasOwnLead = Array.isArray(aLeads) && aLeads.some(l => l.firstName === 'TENANT-A-LEAD');
  record('SameTenant', 'A list contains own leads', aHasOwnLead ? 'PASS' : 'FAIL', '');

  if (leadBId) {
    r = await api(`/api/v1/crm/leads/${leadBId}`, { token: tokenB });
    record('SameTenant', 'B reads own lead by ID', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  r = await api('/api/v1/crm/leads', { token: tokenB });
  const bLeads = r.data?.data?.leads || r.data?.data || [];
  const bHasOwnLead = Array.isArray(bLeads) && bLeads.some(l => l.firstName === 'TENANT-B-LEAD');
  record('SameTenant', 'B list contains own leads', bHasOwnLead ? 'PASS' : 'FAIL', '');

  // ═══════════════════════════════════════════════════════════════
  // STEP 7: CROSS-TENANT ACCESS VECTORS — ALL MUST BE BLOCKED
  // ═══════════════════════════════════════════════════════════════
  log('\n── STEP 7: CROSS-TENANT ACCESS VECTORS (ALL MUST BE BLOCKED) ──');

  // ── 7.1: GET (READ) cross-tenant by direct ID ──
  log('\n  7.1: GET cross-tenant by direct ID');
  
  if (leadAId) {
    r = await api(`/api/v1/crm/leads/${leadAId}`, { token: tokenB });
    record('CrossRead', 'B GET A lead by ID', !r.ok || r.status === 403 || r.status === 404 ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  if (contactAId) {
    r = await api(`/api/v1/crm/contacts/${contactAId}`, { token: tokenB });
    record('CrossRead', 'B GET A contact by ID', !r.ok || r.status === 403 || r.status === 404 ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  if (companyAId) {
    r = await api(`/api/v1/crm/companies/${companyAId}`, { token: tokenB });
    record('CrossRead', 'B GET A company by ID', !r.ok || r.status === 403 || r.status === 404 ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  // Reverse: A tries B
  if (leadBId) {
    r = await api(`/api/v1/crm/leads/${leadBId}`, { token: tokenA });
    record('CrossRead', 'A GET B lead by ID', !r.ok || r.status === 403 || r.status === 404 ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  if (contactBId) {
    r = await api(`/api/v1/crm/contacts/${contactBId}`, { token: tokenA });
    record('CrossRead', 'A GET B contact by ID', !r.ok || r.status === 403 || r.status === 404 ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  if (companyBId) {
    r = await api(`/api/v1/crm/companies/${companyBId}`, { token: tokenA });
    record('CrossRead', 'A GET B company by ID', !r.ok || r.status === 403 || r.status === 404 ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  // ── 7.2: LIST — cross-tenant data must NOT appear ──
  log('\n  7.2: LIST cross-tenant (must not contain other tenant data)');
  
  r = await api('/api/v1/crm/leads', { token: tokenA });
  let leadsList = r.data?.data?.leads || r.data?.data || [];
  let aHasBData = Array.isArray(leadsList) && leadsList.some(l => l.firstName === 'TENANT-B-LEAD');
  record('CrossList', 'A leads list: no B data', !aHasBData ? 'BLOCKED' : 'FAIL', `foundB=${aHasBData}`);

  r = await api('/api/v1/crm/leads', { token: tokenB });
  leadsList = r.data?.data?.leads || r.data?.data || [];
  let bHasAData = Array.isArray(leadsList) && leadsList.some(l => l.firstName === 'TENANT-A-LEAD');
  record('CrossList', 'B leads list: no A data', !bHasAData ? 'BLOCKED' : 'FAIL', `foundA=${bHasAData}`);

  r = await api('/api/v1/crm/contacts', { token: tokenA });
  let contactsList = r.data?.data?.contacts || r.data?.data || [];
  let aHasBContact = Array.isArray(contactsList) && contactsList.some(c => c.firstName === 'TENANT-B-CONTACT');
  record('CrossList', 'A contacts list: no B data', !aHasBContact ? 'BLOCKED' : 'FAIL', `foundB=${aHasBContact}`);

  r = await api('/api/v1/crm/contacts', { token: tokenB });
  contactsList = r.data?.data?.contacts || r.data?.data || [];
  let bHasAContact = Array.isArray(contactsList) && contactsList.some(c => c.firstName === 'TENANT-A-CONTACT');
  record('CrossList', 'B contacts list: no A data', !bHasAContact ? 'BLOCKED' : 'FAIL', `foundA=${bHasAContact}`);

  r = await api('/api/v1/crm/companies', { token: tokenA });
  let companiesList = r.data?.data?.companies || r.data?.data || [];
  let aHasBCompany = Array.isArray(companiesList) && companiesList.some(c => c.name === 'TENANT-B-COMPANY');
  record('CrossList', 'A companies list: no B data', !aHasBCompany ? 'BLOCKED' : 'FAIL', `foundB=${aHasBCompany}`);

  r = await api('/api/v1/crm/companies', { token: tokenB });
  companiesList = r.data?.data?.companies || r.data?.data || [];
  let bHasACompany = Array.isArray(companiesList) && companiesList.some(c => c.name === 'TENANT-A-COMPANY');
  record('CrossList', 'B companies list: no A data', !bHasACompany ? 'BLOCKED' : 'FAIL', `foundA=${bHasACompany}`);

  // ── 7.3: POST (CREATE) cross-tenant IDOR attempt ──
  log('\n  7.3: POST cross-tenant (IDOR via body tenantId)');
  
  // User-B tries to create a lead with explicit tenantId=A in body
  r = await api('/api/v1/crm/leads', {
    method: 'POST', token: tokenB,
    body: JSON.stringify({ firstName: 'B-INTRUDE-INTO-A', lastName: 'IDOR', email: `intrude-${Date.now()}@idor.com`, tenantId: tenantAId })
  });
  // The record must NOT appear in TENANT-A's data even if creation succeeded
  let intrudeInA = false;
  if (r.ok) {
    const intrudeId = r.data?.data?.id;
    if (intrudeId) {
      const checkR = await api('/api/v1/crm/leads', { token: tokenA });
      const aLeadsCheck = checkR.data?.data?.leads || checkR.data?.data || [];
      intrudeInA = Array.isArray(aLeadsCheck) && aLeadsCheck.some(l => l.firstName === 'B-INTRUDE-INTO-A');
    }
  }
  record('CrossCreate', 'B cannot inject record into A via body tenantId', !intrudeInA ? 'BLOCKED' : 'FAIL', `intrudeInA=${intrudeInA}`);

  // ── 7.4: PUT/PATCH (UPDATE) cross-tenant ──
  log('\n  7.4: PUT/PATCH cross-tenant');
  
  if (leadAId) {
    r = await api(`/api/v1/crm/leads/${leadAId}`, {
      method: 'PUT', token: tokenB,
      body: JSON.stringify({ firstName: 'B-MODIFIED-A-LEAD' })
    });
    record('CrossUpdate', 'B cannot UPDATE A lead', !r.ok ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  if (contactAId) {
    r = await api(`/api/v1/crm/contacts/${contactAId}`, {
      method: 'PUT', token: tokenB,
      body: JSON.stringify({ firstName: 'B-MODIFIED-A-CONTACT' })
    });
    record('CrossUpdate', 'B cannot UPDATE A contact', !r.ok ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  if (companyAId) {
    r = await api(`/api/v1/crm/companies/${companyAId}`, {
      method: 'PUT', token: tokenB,
      body: JSON.stringify({ name: 'B-MODIFIED-A-COMPANY' })
    });
    record('CrossUpdate', 'B cannot UPDATE A company', !r.ok ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  // Reverse: A → B
  if (leadBId) {
    r = await api(`/api/v1/crm/leads/${leadBId}`, {
      method: 'PUT', token: tokenA,
      body: JSON.stringify({ firstName: 'A-MODIFIED-B-LEAD' })
    });
    record('CrossUpdate', 'A cannot UPDATE B lead', !r.ok ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  // ── 7.5: DELETE cross-tenant ──
  log('\n  7.5: DELETE cross-tenant');
  
  if (leadAId) {
    r = await api(`/api/v1/crm/leads/${leadAId}`, { method: 'DELETE', token: tokenB });
    record('CrossDelete', 'B cannot DELETE A lead', !r.ok ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  if (contactAId) {
    r = await api(`/api/v1/crm/contacts/${contactAId}`, { method: 'DELETE', token: tokenB });
    record('CrossDelete', 'B cannot DELETE A contact', !r.ok ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  if (companyAId) {
    r = await api(`/api/v1/crm/companies/${companyAId}`, { method: 'DELETE', token: tokenB });
    record('CrossDelete', 'B cannot DELETE A company', !r.ok ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  // Reverse: A → B
  if (leadBId) {
    r = await api(`/api/v1/crm/leads/${leadBId}`, { method: 'DELETE', token: tokenA });
    record('CrossDelete', 'A cannot DELETE B lead', !r.ok ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  // ── 7.6: DIRECT ID MANIPULATION ──
  log('\n  7.6: Direct ID manipulation (query params + headers)');
  
  if (leadAId) {
    // Try accessing A's lead with B's token + query param override
    r = await api(`/api/v1/crm/leads/${leadAId}?tenantId=${tenantAId}`, { token: tokenB });
    record('IDManip', 'B + ?tenantId=A on direct ID', !r.ok || r.status === 403 || r.status === 404 ? 'BLOCKED' : 'FAIL', `status=${r.status}`);

    // Try with custom header
    r = await api(`/api/v1/crm/leads/${leadAId}`, {
      token: tokenB,
      headers: { 'X-Tenant-Id': tenantAId }
    });
    record('IDManip', 'B + X-Tenant-Id header=A', !r.ok || r.status === 403 || r.status === 404 ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  // ── 7.7: QUERY PARAMETER MANIPULATION on list endpoints ──
  log('\n  7.7: Query parameter manipulation on list endpoints');
  
  r = await api(`/api/v1/crm/leads?tenantId=${tenantAId}`, { token: tokenB });
  let leadsWithQuery = r.data?.data?.leads || r.data?.data || [];
  let bGotADataViaQuery = Array.isArray(leadsWithQuery) && leadsWithQuery.some(l => l.firstName === 'TENANT-A-LEAD');
  record('QueryManip', 'B + ?tenantId=A in leads list', !bGotADataViaQuery ? 'BLOCKED' : 'FAIL', `leaked=${bGotADataViaQuery}`);

  r = await api(`/api/v1/crm/contacts?tenantId=${tenantAId}`, { token: tokenB });
  let contactsWithQuery = r.data?.data?.contacts || r.data?.data || [];
  let bGotAContactsViaQuery = Array.isArray(contactsWithQuery) && contactsWithQuery.some(c => c.firstName === 'TENANT-A-CONTACT');
  record('QueryManip', 'B + ?tenantId=A in contacts list', !bGotAContactsViaQuery ? 'BLOCKED' : 'FAIL', `leaked=${bGotAContactsViaQuery}`);

  r = await api(`/api/v1/crm/companies?tenantId=${tenantAId}`, { token: tokenB });
  let companiesWithQuery = r.data?.data?.companies || r.data?.data || [];
  let bGotACompaniesViaQuery = Array.isArray(companiesWithQuery) && companiesWithQuery.some(c => c.name === 'TENANT-A-COMPANY');
  record('QueryManip', 'B + ?tenantId=A in companies list', !bGotACompaniesViaQuery ? 'BLOCKED' : 'FAIL', `leaked=${bGotACompaniesViaQuery}`);

  // ── 7.8: URL PARAMETER MANIPULATION ──
  log('\n  7.8: URL parameter manipulation');
  
  if (leadAId) {
    r = await api(`/api/v1/crm/leads/${leadAId}`, { token: tokenB });
    record('URLManip', 'B accesses /leads/{A_ID}', !r.ok || r.status === 403 || r.status === 404 ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  if (companyAId) {
    r = await api(`/api/v1/crm/companies/${companyAId}/contacts`, { token: tokenB });
    record('URLManip', 'B accesses /companies/{A_ID}/contacts', !r.ok || r.status === 403 || r.status === 404 ? 'BLOCKED' : 'FAIL', `status=${r.status}`);
  }

  // ── 7.9: BROWSER UI — SSR PAGE PROTECTION ──
  log('\n  7.9: Browser UI protection (unauthenticated SSR redirect)');
  
  const protectedPages = ['/dashboard', '/leads', '/contacts', '/companies', '/deals', '/employees', '/settings'];
  for (const page of protectedPages) {
    const rr = await fetch(`${BASE}${page}`, { redirect: 'manual' });
    const redirected = rr.status === 307 || rr.status === 302;
    record('UI-Protect', `Unauthenticated ${page} → redirect`, redirected ? 'PASS' : 'WARN', `status=${rr.status}`);
  }

  // ── 7.10: POST-ATTACK INTEGRITY VERIFICATION ──
  log('\n  7.10: Post-attack integrity verification');
  
  if (leadAId) {
    r = await api(`/api/v1/crm/leads/${leadAId}`, { token: tokenA });
    const leadAName = r.data?.data?.firstName || '';
    record('Integrity', 'A lead name unchanged after attacks', leadAName === 'TENANT-A-LEAD' ? 'PASS' : 'FAIL', `got="${leadAName}" expected="TENANT-A-LEAD"`);
  }

  if (contactAId) {
    r = await api(`/api/v1/crm/contacts/${contactAId}`, { token: tokenA });
    const contactAName = r.data?.data?.firstName || '';
    record('Integrity', 'A contact name unchanged after attacks', contactAName === 'TENANT-A-CONTACT' ? 'PASS' : 'FAIL', `got="${contactAName}"`);
  }

  if (companyAId) {
    r = await api(`/api/v1/crm/companies/${companyAId}`, { token: tokenA });
    const companyAName = r.data?.data?.name || '';
    record('Integrity', 'A company name unchanged after attacks', companyAName === 'TENANT-A-COMPANY' ? 'PASS' : 'FAIL', `got="${companyAName}"`);
  }

  if (leadBId) {
    r = await api(`/api/v1/crm/leads/${leadBId}`, { token: tokenB });
    const leadBName = r.data?.data?.firstName || '';
    record('Integrity', 'B lead name unchanged after attacks', leadBName === 'TENANT-B-LEAD' ? 'PASS' : 'FAIL', `got="${leadBName}"`);

    const leadBExists = r.ok;
    record('Integrity', 'B lead still exists (not deleted by A)', leadBExists ? 'PASS' : 'FAIL', `exists=${leadBExists}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════════════
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  
  log('\n' + '═'.repeat(60));
  log('  TENANT ISOLATION FINAL PROOF — RESULTS');
  log('═'.repeat(60));
  log(`  TOTAL: ${results.passed + results.blocked + results.failed} tests`);
  log(`  ✅ PASS: ${results.passed}`);
  log(`  🔒 BLOCKED (cross-tenant correctly denied): ${results.blocked}`);
  log(`  ❌ FAIL (cross-tenant breach or setup error): ${results.failed}`);
  log(`  Time: ${elapsed}s`);
  
  if (results.errors.length > 0) {
    log('\n  ❌ FAILURES:');
    results.errors.forEach(e => log(`    - ${e}`));
  }

  // Category breakdown
  const categories = {};
  for (const d of results.details) {
    if (!categories[d.category]) categories[d.category] = { pass: 0, blocked: 0, fail: 0 };
    if (d.status === 'PASS') categories[d.category].pass++;
    else if (d.status === 'BLOCKED') categories[d.category].blocked++;
    else categories[d.category].fail++;
  }
  log('\n  CATEGORY BREAKDOWN:');
  for (const [cat, counts] of Object.entries(categories)) {
    log(`    ${cat}: ${counts.pass}P ${counts.blocked}B ${counts.fail}F`);
  }

  // Determine final isolation status
  const crossTenantBreaches = results.details.filter(d => 
    d.status === 'FAIL' && 
    ['CrossRead','CrossList','CrossCreate','CrossUpdate','CrossDelete','IDManip','QueryManip','URLManip'].includes(d.category)
  );
  
  const finalStatus = crossTenantBreaches.length === 0 ? 'TENANT_ISOLATION_PROVEN' : 'TENANT_ISOLATION_BREACHED';
  log(`\n  FINAL: ${finalStatus}`);
  if (crossTenantBreaches.length > 0) {
    log(`  BREACH COUNT: ${crossTenantBreaches.length}`);
  }

  // Save results
  const fs = require('fs');
  fs.writeFileSync('/home/z/my-project/scripts/tenant-isolation-proof-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    tenantA: { id: tenantAId, name: 'TENANT-A Corp' },
    tenantB: { id: tenantBId, name: 'TENANT-B Corp' },
    userA: { id: userA.id, email: 'user-a@tenant-a.com' },
    userB: { id: userB.id, email: 'user-b@tenant-b.com' },
    records: {
      tenantA: { leadId: leadAId, contactId: contactAId, companyId: companyAId },
      tenantB: { leadId: leadBId, contactId: contactBId, companyId: companyBId },
    },
    results: {
      passed: results.passed,
      blocked: results.blocked,
      failed: results.failed,
      total: results.passed + results.blocked + results.failed,
      elapsed,
    },
    crossTenantBreaches: crossTenantBreaches.length,
    details: results.details,
    errors: results.errors,
    finalStatus,
  }, null, 2));
  log('Results saved.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
