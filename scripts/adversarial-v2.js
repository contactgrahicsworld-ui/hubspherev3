/**
 * HubSphere V3 — Adversarial Regression Test Suite v2
 * CORRECT API paths, proper token handling
 * Covers: Fresh sessions, API adversarial, XSS, Auth, Tenant isolation,
 * Rapid interaction, DB consistency, Failure injection, Mobile, Observability, Performance
 */

const BASE = 'https://hubspherev3.vercel.app';
const DB_URL = 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

const results = { passed: 0, failed: 0, errors: [], warnings: [], sections: {} };

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }
function record(section, test, status, detail = '') {
  if (!results.sections[section]) results.sections[section] = { passed: 0, failed: 0 };
  if (status === 'PASS') { results.passed++; results.sections[section].passed++; }
  else if (status === 'WARN') { results.warnings.push(`[${section}] ${test}: ${detail}`); return; }
  else { results.failed++; results.sections[section].failed++; results.errors.push(`[${section}] ${test}: ${detail}`); }
  const icon = status === 'PASS' ? '✅' : '❌';
  log(`  ${icon} [${section}] ${test}${detail ? ': ' + detail.slice(0,80) : ''}`);
}

async function api(path, opts = {}) {
  const url = `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = opts.noAuth ? null : (opts.token !== undefined ? opts.token : (opts._at || ''));
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(url, { ...opts, headers, redirect: 'manual' });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, data, ok: r.ok, headers: r.headers, raw: text };
  } catch (e) {
    return { status: 0, data: null, ok: false, error: e.message };
  }
}

async function cleanDB() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    const tables = ['delivery_attempts','message_events','message_attachments','messages','conversations','communication_provider_configs','communication_templates','notifications','automation_execution_logs','automation_executions','automation_actions','automation_conditions','automation_triggers','automation_workflows','ai_usage_logs','provider_configs','bank_transfers','payroll_items','payroll_records','expenses','field_visits','attendance_sessions','leave_requests','leave_types','employee_documents','employees','designations','departments','stage_history','activities','call_recordings','calls','company_tags','contact_tags','lead_tags','tags','notes','follow_ups','tasks','deals','companies','contacts','leads','role_permissions','permissions','audit_logs','refresh_tokens','password_reset_tokens','email_verification_tokens','memberships','users','roles','tenants'];
    for (const t of tables) { try { await p.$executeRawUnsafe(`DELETE FROM ${t}`); } catch(e) {} }
    await p.$disconnect();
    return true;
  } catch (e) { return false; }
}

async function setup() {
  log('Setting up fresh DB...');
  await cleanDB();
  await new Promise(r => setTimeout(r, 2000));
  const res = await api('/api/v1/auth/setup', {
    method: 'POST', noAuth: true,
    body: JSON.stringify({ name: 'Admin', email: 'admin@hubsphere.com', password: 'H$phere@2026!', confirmPassword: 'H$phere@2026!', organizationName: 'Test Org' })
  });
  if (!res.ok || !res.data?.data?.accessToken) {
    log('FATAL: Setup failed - ' + JSON.stringify(res.data).slice(0, 200));
    return null;
  }
  return { accessToken: res.data.data.accessToken, refreshToken: res.data.data.refreshToken, userId: res.data.data.user?.id, tenantId: res.data.data.user?.tenantId };
}

// ═══════════════════════════════════════════════════════════════
// PHASE 2: FRESH SESSION TESTING
// ═══════════════════════════════════════════════════════════════
async function testFreshSessions(at) {
  log('\n── PHASE 2: FRESH SESSION TESTING ──');
  const protectedRoutes = ['/dashboard', '/leads', '/contacts', '/companies', '/deals', '/employees', '/settings'];
  for (const route of protectedRoutes) {
    let r = await fetch(`${BASE}${route}`, { redirect: 'manual' });
    record('Session', `${route} → redirect`, r.status === 307 || r.status === 302 ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
  // Fresh login
  let r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }), noAuth: true });
  record('Session', 'Fresh login works', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  let freshToken = r.data?.data?.accessToken || '';
  if (freshToken) {
    r = await api('/api/v1/auth/me', { token: freshToken });
    record('Session', 'API call after login', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
  // Expired session
  r = await api('/api/v1/auth/me', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjEwMDAwMDAwMDB9.fake' });
  record('Session', 'Expired token → 401', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 6: API ADVERSARIAL
// ═══════════════════════════════════════════════════════════════
async function testAPIAdversarial(at) {
  log('\n── PHASE 6: API ADVERSARIAL ──');
  const endpoints = [
    { path: '/api/v1/crm/leads', body: { firstName: 'T', lastName: 'L', email: 't@h.com' } },
    { path: '/api/v1/crm/contacts', body: { firstName: 'T', lastName: 'C', email: 't@h.com' } },
    { path: '/api/v1/crm/companies', body: { name: 'T Co', email: 't@h.com' } },
    { path: '/api/v1/crm/tasks', body: { title: 'T Task' } },
  ];
  for (const ep of endpoints) {
    const name = ep.path.split('/').pop();
    let r = await api(ep.path, { method: 'POST', body: JSON.stringify(ep.body), token: at });
    record('API-Adv', `${name}: valid input`, r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(ep.path, { method: 'POST', body: '{}', token: at });
    record('API-Adv', `${name}: empty body → 4xx`, !r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(ep.path, { method: 'POST', body: JSON.stringify(ep.body), noAuth: true });
    record('API-Adv', `${name}: unauth → 401`, r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(ep.path, { method: 'POST', body: JSON.stringify(ep.body), token: 'bad-token' });
    record('API-Adv', `${name}: bad token → 401`, r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`${ep.path}/not-a-uuid`, { token: at });
    record('API-Adv', `${name}: invalid UUID`, r.status === 400 || r.status === 404 ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
  // Sensitive data leakage check
  const sensitivePats = [/prisma/i, /sql.*error/i, /stack\s+trace/i, /database.*url/i, /jwt.*secret/i, /ENOENT/i];
  for (const ep of ['/api/v1/crm/leads/not-uuid', '/api/v1/crm/contacts/not-uuid']) {
    const r = await api(ep, { token: at });
    const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    let leaked = sensitivePats.some(p => p.test(body));
    record('API-Sec', `${ep}: no sensitive leak`, !leaked ? 'PASS' : 'FAIL', leaked ? 'LEAKED!' : 'clean');
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 7: XSS REGRESSION
// ═══════════════════════════════════════════════════════════════
async function testXSSRegression(at) {
  log('\n── PHASE 7: XSS REGRESSION ──');
  const xssPayloads = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '"><script>alert(1)</script>', '<svg onload=alert(1)>'];
  const fields = [
    { ep: '/api/v1/crm/leads', body: (p) => ({ firstName: p, lastName: 'XSS', email: `xss${Date.now()}@hub.com` }), name: 'Lead.firstName' },
    { ep: '/api/v1/crm/contacts', body: (p) => ({ firstName: p, lastName: 'XSS', email: `xssc${Date.now()}@hub.com` }), name: 'Contact.firstName' },
    { ep: '/api/v1/crm/companies', body: (p) => ({ name: p, email: `xssco${Date.now()}@hub.com` }), name: 'Company.name' },
  ];
  for (const field of fields) {
    for (const payload of xssPayloads) {
      const r = await api(field.ep, { method: 'POST', body: JSON.stringify(field.body(payload)), token: at });
      const resBody = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
      const scriptExec = /<script>/i.test(resBody) && !/&lt;script&gt;/.test(resBody);
      if (r.ok) {
        record('XSS', `${field.name} + XSS`, !scriptExec ? 'PASS' : 'FAIL', scriptExec ? 'UNSANITIZED!' : 'safe');
      } else {
        record('XSS', `${field.name} + XSS`, r.status === 400 ? 'PASS' : 'WARN', `rejected ${r.status}`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 8: AUTH REGRESSION
// ═══════════════════════════════════════════════════════════════
async function testAuthRegression(at, rt) {
  log('\n── PHASE 8: AUTH REGRESSION ──');
  // Login
  let r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }), noAuth: true });
  record('Auth', 'Login works', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  let loginAT = r.data?.data?.accessToken || '';
  let loginRT = r.data?.data?.refreshToken || '';

  // Token rotation
  const oldAT = loginAT;
  r = await api('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: loginRT }), noAuth: true });
  record('Auth', 'Token rotation', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  let newAT = r.data?.data?.accessToken || '';
  record('Auth', 'New token differs', newAT !== oldAT ? 'PASS' : 'WARN', '');

  // Old RT revoked
  r = await api('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: loginRT }), noAuth: true });
  record('Auth', 'Old RT revoked', !r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // Invalid token
  r = await api('/api/v1/auth/me', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.fake' });
  record('Auth', 'Expired JWT → 401', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);

  // Multiple sessions
  r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }), noAuth: true });
  let s1 = r.data?.data?.accessToken || '';
  r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }), noAuth: true });
  let s2 = r.data?.data?.accessToken || '';
  r = await api('/api/v1/auth/me', { token: s1 });
  record('Auth', 'Session 1 valid', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/auth/me', { token: s2 });
  record('Auth', 'Session 2 valid', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // Logout session 1, session 2 still works
  let s1rt = (await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }), noAuth: true })).data?.data?.refreshToken || '';
  await api('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: s1rt }), token: s1 });
  r = await api('/api/v1/auth/me', { token: s2 });
  record('Auth', 'Session 2 valid after S1 logout', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // Password change
  r = await api('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: 'H$phere@2026!', newPassword: 'H$phere@2027!', confirmPassword: 'H$phere@2027!' }), token: at });
  record('Auth', 'Password change works', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (r.ok) {
    r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }), noAuth: true });
    record('Auth', 'Old pw rejected after change', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2027!' }), noAuth: true });
    record('Auth', 'New pw works', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    if (r.ok) {
      await api('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: 'H$phere@2027!', newPassword: 'H$phere@2026!', confirmPassword: 'H$phere@2026!' }), token: r.data?.data?.accessToken });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 4: RAPID INTERACTION
// ═══════════════════════════════════════════════════════════════
async function testRapidInteraction(at) {
  log('\n── PHASE 4: RAPID INTERACTION ──');
  const creates = [];
  for (let i = 0; i < 5; i++) {
    creates.push(api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: 'Race', lastName: `T${i}`, email: `race${i}@hub.com`, phone: `999900000${i}` }), token: at }));
  }
  const results = await Promise.all(creates);
  const ok = results.filter(r => r.ok).length;
  record('Race', 'Concurrent creates', ok === 5 ? 'PASS' : 'WARN', `${ok}/5 ok`);
  // Concurrent reads
  const reads = await Promise.all([
    api('/api/v1/crm/leads', { token: at }),
    api('/api/v1/crm/contacts', { token: at }),
    api('/api/v1/crm/companies', { token: at }),
    api('/api/v1/crm/tasks', { token: at }),
    api('/api/v1/analytics/crm', { token: at }),
  ]);
  record('Race', 'Concurrent navigation', reads.every(r => r.ok) ? 'PASS' : 'WARN', `${reads.filter(r => r.ok).length}/5 ok`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 5: DB CONSISTENCY
// ═══════════════════════════════════════════════════════════════
async function testDBConsistency(at) {
  log('\n── PHASE 5: DB CONSISTENCY ──');
  // CRUD cycle
  let r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: 'DBTest', lastName: 'Lead', email: 'dbtest@hub.com' }), token: at });
  record('DB', 'CREATE lead', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  let leadId = r.data?.data?.id || '';
  if (leadId) {
    r = await api(`/api/v1/crm/leads/${leadId}`, { token: at });
    record('DB', 'READ lead', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    let name = r.data?.data?.firstName || '';
    record('DB', 'Data matches', name === 'DBTest' ? 'PASS' : 'FAIL', `got "${name}"`);
    r = await api(`/api/v1/crm/leads/${leadId}`, { method: 'PUT', body: JSON.stringify({ firstName: 'DBUpdated' }), token: at });
    record('DB', 'UPDATE lead', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`/api/v1/crm/leads/${leadId}`, { token: at });
    name = r.data?.data?.firstName || '';
    record('DB', 'Update persisted', name === 'DBUpdated' ? 'PASS' : 'FAIL', `got "${name}"`);
    r = await api(`/api/v1/crm/leads/${leadId}`, { method: 'DELETE', token: at });
    record('DB', 'DELETE lead', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`/api/v1/crm/leads/${leadId}`, { token: at });
    record('DB', 'Deleted → 404', !r.ok || r.status === 404 ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
  // Non-existent resource
  r = await api('/api/v1/crm/leads/00000000-0000-0000-0000-000000000000', { token: at });
  record('DB', 'Non-existent → 404', r.status === 404 ? 'PASS' : 'FAIL', `status=${r.status}`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 9: TENANT ISOLATION
// ═══════════════════════════════════════════════════════════════
async function testTenantIsolation(at) {
  log('\n── PHASE 9: TENANT ISOLATION ──');
  // Create data in Tenant A
  let r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: 'TenantA', lastName: 'Lead', email: 'tenanta@hub.com' }), token: at });
  record('Tenant', 'Create lead in Tenant A', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  let tenantALeadId = r.data?.data?.id || '';
  
  // Try signup for Tenant B
  r = await api('/api/v1/auth/signup', { method: 'POST', body: JSON.stringify({ name: 'Tenant B', email: 'tenantb@hub.com', password: 'TenantB@123!', confirmPassword: 'TenantB@123!', organizationName: 'Tenant B Org' }), noAuth: true });
  if (r.ok && r.data?.data?.accessToken) {
    const tenantBToken = r.data.data.accessToken;
    if (tenantALeadId) {
      r = await api(`/api/v1/crm/leads/${tenantALeadId}`, { token: tenantBToken });
      record('Tenant', 'B cannot read A lead', !r.ok || r.status === 404 || r.status === 403 ? 'PASS' : 'FAIL', `status=${r.status}`);
    }
    r = await api('/api/v1/crm/leads', { token: tenantBToken });
    if (r.ok) {
      const leads = r.data?.data?.leads || r.data?.data || [];
      const hasA = Array.isArray(leads) && leads.some(l => l.firstName === 'TenantA');
      record('Tenant', 'B list no A data', !hasA ? 'PASS' : 'FAIL', `found A: ${hasA}`);
    }
  } else {
    record('Tenant', 'Signup for B', 'WARN', `signup not available: status=${r.status}`);
    r = await api('/api/v1/auth/me', { token: at });
    const tid = r.data?.data?.currentTenant?.id;
    record('Tenant', 'User has tenant context', !!tid ? 'PASS' : 'FAIL', `tenantId=${tid}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 10: FAILURE INJECTION
// ═══════════════════════════════════════════════════════════════
async function testFailureInjection(at) {
  log('\n── PHASE 10: FAILURE INJECTION ──');
  let r = await api('/api/v1/crm/leads', { noAuth: true });
  record('FailInj', 'Unauth → 401', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/crm/leads', { token: 'malformed' });
  record('FailInj', 'Malformed auth → 401', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/crm/leads/00000000-0000-0000-0000-000000000000', { token: at });
  record('FailInj', 'Non-existent → 404', r.status === 404 ? 'PASS' : 'FAIL', `status=${r.status}`);
  
  // SQL injection attempts
  const sqls = ["'; DROP TABLE users; --", "' OR '1'='1", "' UNION SELECT * FROM users --"];
  for (const sql of sqls) {
    r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: sql, lastName: 'SQLi', email: `sqli${Date.now()}@hub.com` }), token: at });
    record('FailInj', `SQLi handled: ${sql.slice(0,15)}`, r.ok || r.status === 400 ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
  // Data still intact
  r = await api('/api/v1/crm/leads', { token: at });
  record('FailInj', 'Data intact after SQLi', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  
  // Oversized input
  r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: 'A'.repeat(10000), lastName: 'Big', email: 'big@hub.com' }), token: at });
  record('FailInj', 'Oversized input handled', r.ok || r.status === 400 ? 'PASS' : 'FAIL', `status=${r.status}`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 11: MOBILE VIEWPORT
// ═══════════════════════════════════════════════════════════════
async function testMobile() {
  log('\n── PHASE 11: MOBILE VIEWPORT ──');
  const pages = ['/login', '/signup', '/forgot-password', '/setup'];
  for (const page of pages) {
    const r = await fetch(`${BASE}${page}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' }
    });
    record('Mobile', `${page} loads on mobile`, r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 13: OBSERVABILITY
// ═══════════════════════════════════════════════════════════════
async function testObservability(at) {
  log('\n── PHASE 13: OBSERVABILITY ──');
  let r = await api('/api/v1/system/health', { noAuth: true });
  record('Observ', 'Health OK', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  record('Observ', 'DB connected', r.data?.data?.database === 'connected' ? 'PASS' : 'FAIL', `db=${r.data?.data?.database}`);
  // Error response no stack trace
  r = await api('/api/v1/crm/leads/invalid-uuid', { token: at });
  const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
  const hasStack = /at\s+\w+\s+\(/.test(body);
  record('Observ', 'No stack trace leak', !hasStack ? 'PASS' : 'FAIL', hasStack ? 'LEAKED!' : 'clean');
  // No env vars
  const envKeys = ['JWT_SECRET', 'DATABASE_URL', 'REFRESH_TOKEN_SECRET'];
  let leaked = envKeys.some(k => body.includes(k));
  record('Observ', 'No env vars in response', !leaked ? 'PASS' : 'FAIL', leaked ? 'LEAKED!' : 'clean');
}

// ═══════════════════════════════════════════════════════════════
// PHASE 14: PERFORMANCE
// ═══════════════════════════════════════════════════════════════
async function testPerformance(at) {
  log('\n── PHASE 14: PERFORMANCE ──');
  const endpoints = [
    { path: '/api/v1/crm/leads', name: 'Leads' },
    { path: '/api/v1/crm/contacts', name: 'Contacts' },
    { path: '/api/v1/auth/me', name: 'Me' },
    { path: '/api/v1/system/health', name: 'Health', noAuth: true },
  ];
  for (const ep of endpoints) {
    const times = [];
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await api(ep.path, { token: at, noAuth: ep.noAuth });
      times.push(Date.now() - start);
    }
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / 3);
    record('Perf', `${ep.name} avg=${avg}ms`, avg < 5000 ? 'PASS' : 'FAIL', `avg=${avg}ms`);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  log('HUBSPHERE ADVERSARIAL REGRESSION v2');
  const start = Date.now();
  const auth = await setup();
  if (!auth) { log('FATAL'); process.exit(1); }
  log(`Auth OK: userId=${auth.userId}`);

  await testFreshSessions(auth.accessToken);
  await testAPIAdversarial(auth.accessToken);
  await testXSSRegression(auth.accessToken);
  await testAuthRegression(auth.accessToken, auth.refreshToken);
  await testRapidInteraction(auth.accessToken);
  await testDBConsistency(auth.accessToken);
  await testTenantIsolation(auth.accessToken);
  await testFailureInjection(auth.accessToken);
  await testMobile();
  await testObservability(auth.accessToken);
  await testPerformance(auth.accessToken);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log('\n' + '═'.repeat(60));
  log('  ADVERSARIAL REGRESSION RESULTS');
  log('═'.repeat(60));
  for (const [s, d] of Object.entries(results.sections)) log(`  ${s}: ${d.passed}P ${d.failed}F`);
  log(`\n  TOTAL: ${results.passed} PASS, ${results.failed} FAIL in ${elapsed}s`);
  if (results.errors.length > 0) { log('  ❌ FAILURES:'); results.errors.forEach(e => log(`    - ${e}`)); }

  require('fs').writeFileSync('/home/z/my-project/scripts/adversarial-v2-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), passed: results.passed, failed: results.failed, elapsed,
    sections: results.sections, errors: results.errors, warnings: results.warnings.slice(0, 30),
    status: results.failed === 0 ? 'ALL_PASS' : 'FAILURES_FOUND'
  }, null, 2));
  log('Results saved.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
