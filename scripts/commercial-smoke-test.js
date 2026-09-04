/**
 * HubSphere V3 — COMMERCIAL RELEASE SMOKE TEST
 * Final live verification against production for commercial readiness.
 */
const BASE = 'https://hubspherev3.vercel.app';
const DB_URL = 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

const results = { passed: 0, failed: 0, errors: [], details: [] };
function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }
function record(cat, test, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  log(`  ${icon} [${cat}] ${test}${detail ? ': ' + detail.slice(0,80) : ''}`);
  results.details.push({ cat, test, status, detail: detail.slice(0,200) });
  if (status === 'PASS') results.passed++;
  else if (status === 'WARN') return;
  else { results.failed++; results.errors.push(`[${cat}] ${test}: ${detail}`); }
}

async function api(path, opts = {}) {
  let url = `${BASE}${path}`.replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = opts.noAuth ? null : (opts.token || '');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(url, { ...opts, headers, redirect: 'follow' });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text.substring(0, 500); }
    return { status: r.status, data, ok: r.ok, headers: r.headers, raw: text.substring(0, 500) };
  } catch (e) { return { status: 0, data: null, ok: false, error: e.message }; }
}

async function main() {
  log('══════════════════════════════════════════════════════════════');
  log('  HUBSPHERE V3 — COMMERCIAL RELEASE SMOKE TEST');
  log('══════════════════════════════════════════════════════════════');
  const start = Date.now();

  // ── 1. SYSTEM HEALTH ──
  log('\n── 1. SYSTEM HEALTH ──');
  let r = await api('/api/v1/system/health', { noAuth: true });
  record('Health', 'Health endpoint', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  record('Health', 'DB connected', r.data?.data?.database === 'connected' ? 'PASS' : 'FAIL', `db=${r.data?.data?.database}`);

  // ── 2. SECURITY HEADERS ──
  log('\n── 2. SECURITY HEADERS ──');
  r = await fetch(`${BASE}/login`);
  const h = Object.fromEntries(r.headers.entries());
  record('Security', 'HSTS', h['strict-transport-security'] ? 'PASS' : 'FAIL', h['strict-transport-security']?.slice(0,40) || 'MISSING');
  record('Security', 'X-Frame-Options: DENY', h['x-frame-options'] === 'DENY' ? 'PASS' : 'FAIL', h['x-frame-options'] || 'MISSING');
  record('Security', 'X-Content-Type-Options', h['x-content-type-options'] === 'nosniff' ? 'PASS' : 'FAIL', h['x-content-type-options'] || 'MISSING');
  record('Security', 'CSP present', !!h['content-security-policy'] ? 'PASS' : 'FAIL', h['content-security-policy']?.slice(0,30) || 'MISSING');
  record('Security', 'Referrer-Policy', !!h['referrer-policy'] ? 'PASS' : 'FAIL', h['referrer-policy'] || 'MISSING');
  record('Security', 'Permissions-Policy', !!h['permissions-policy'] ? 'PASS' : 'FAIL', h['permissions-policy'] || 'MISSING');

  // ── 3. AUTH WORKFLOW ──
  log('\n── 3. AUTH WORKFLOW ──');
  r = await api('/api/v1/auth/setup/status', { noAuth: true });
  record('Auth', 'Setup complete', r.data?.data?.setupComplete ? 'PASS' : 'FAIL', `complete=${r.data?.data?.setupComplete}`);

  r = await api('/api/v1/auth/login', { method: 'POST', noAuth: true, body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }) });
  record('Auth', 'Login', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const token = r.data?.data?.accessToken || '';
  const rt = r.data?.data?.refreshToken || '';

  if (!token) { log('FATAL: Cannot login'); process.exit(1); }

  r = await api('/api/v1/auth/me', { token });
  record('Auth', 'Auth/me', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const tenantId = r.data?.data?.currentTenant?.id;
  record('Auth', 'Tenant context', !!tenantId ? 'PASS' : 'FAIL', `tenantId=${tenantId}`);

  // Token rotation
  r = await api('/api/v1/auth/refresh', { method: 'POST', noAuth: true, body: JSON.stringify({ refreshToken: rt }) });
  record('Auth', 'Token refresh', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const newToken = r.data?.data?.accessToken || '';

  // Old RT revoked
  r = await api('/api/v1/auth/refresh', { method: 'POST', noAuth: true, body: JSON.stringify({ refreshToken: rt }) });
  record('Auth', 'Old RT revoked', !r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // Invalid token
  r = await api('/api/v1/auth/me', { token: 'invalid-jwt-token' });
  record('Auth', 'Invalid token → 401', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ── 4. RBAC & ROLES ──
  log('\n── 4. RBAC & ROLES ──');
  r = await api('/api/v1/admin/roles', { token: newToken || token });
  record('RBAC', 'Roles list', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ── 5. CRM WORKFLOW ──
  log('\n── 5. CRM WORKFLOW ──');
  const at = newToken || token;

  // Leads CRUD
  r = await api('/api/v1/crm/leads', { method: 'POST', token: at, body: JSON.stringify({ firstName: 'Smoke', lastName: 'Test', email: 'smoke@test.com', phone: '5555555555' }) });
  record('CRM', 'Create lead', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const leadId = r.data?.data?.id || '';

  if (leadId) {
    r = await api(`/api/v1/crm/leads/${leadId}`, { token: at });
    record('CRM', 'Read lead', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`/api/v1/crm/leads/${leadId}`, { method: 'PUT', token: at, body: JSON.stringify({ firstName: 'Updated' }) });
    record('CRM', 'Update lead', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`/api/v1/crm/leads/${leadId}`, { method: 'DELETE', token: at });
    record('CRM', 'Delete lead', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // Contacts CRUD
  r = await api('/api/v1/crm/contacts', { method: 'POST', token: at, body: JSON.stringify({ firstName: 'Contact', lastName: 'Test', email: 'contact@test.com' }) });
  record('CRM', 'Create contact', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const contactId = r.data?.data?.id || '';
  if (contactId) {
    r = await api(`/api/v1/crm/contacts/${contactId}`, { token: at });
    record('CRM', 'Read contact', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`/api/v1/crm/contacts/${contactId}`, { method: 'DELETE', token: at });
    record('CRM', 'Delete contact', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // Companies
  r = await api('/api/v1/crm/companies', { method: 'POST', token: at, body: JSON.stringify({ name: 'Test Company', email: 'co@test.com' }) });
  record('CRM', 'Create company', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const companyId = r.data?.data?.id || '';
  if (companyId) {
    r = await api(`/api/v1/crm/companies/${companyId}`, { method: 'DELETE', token: at });
    record('CRM', 'Delete company', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // Tasks
  r = await api('/api/v1/crm/tasks', { method: 'POST', token: at, body: JSON.stringify({ title: 'Smoke Task' }) });
  record('CRM', 'Create task', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const taskId = r.data?.data?.id || '';
  if (taskId) {
    r = await api(`/api/v1/crm/tasks/${taskId}`, { method: 'DELETE', token: at });
    record('CRM', 'Delete task', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // Deals
  r = await api('/api/v1/crm/deals', { method: 'POST', token: at, body: JSON.stringify({ title: 'Smoke Deal', value: 10000, stage: 'LEAD' }) });
  record('CRM', 'Create deal', r.ok ? 'PASS' : 'FAIL', `status=${r.status} data=${JSON.stringify(r.data).slice(0,80)}`);
  const dealId = r.data?.data?.id || '';
  if (dealId) {
    r = await api(`/api/v1/crm/deals/${dealId}`, { method: 'DELETE', token: at });
    record('CRM', 'Delete deal', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // Lists
  r = await api('/api/v1/crm/leads', { token: at });
  record('CRM', 'List leads', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/crm/contacts', { token: at });
  record('CRM', 'List contacts', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/crm/companies', { token: at });
  record('CRM', 'List companies', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ── 6. HRMS WORKFLOW ──
  log('\n── 6. HRMS WORKFLOW ──');
  r = await api('/api/v1/hrms/departments', { method: 'POST', token: at, body: JSON.stringify({ name: 'Engineering' }) });
  record('HRMS', 'Create department', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  const deptId = r.data?.data?.id || '';
  
  r = await api('/api/v1/hrms/departments', { token: at });
  record('HRMS', 'List departments', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  if (deptId) {
    r = await api(`/api/v1/hrms/departments/${deptId}`, { method: 'DELETE', token: at });
    record('HRMS', 'Delete department', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // ── 7. ADMIN ──
  log('\n── 7. ADMIN ──');
  r = await api('/api/v1/admin/users', { token: at });
  record('Admin', 'List users', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  r = await api('/api/v1/admin/settings', { token: at });
  record('Admin', 'Settings', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ── 8. SUPER ADMIN ──
  log('\n── 8. SUPER ADMIN ──');
  r = await api('/api/v1/super-admin/tenants', { token: at });
  record('SuperAdmin', 'List tenants', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  r = await api('/api/v1/super-admin/users', { token: at });
  record('SuperAdmin', 'List all users', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ── 9. UNAUTH PROTECTION ──
  log('\n── 9. UNAUTH PROTECTION ──');
  const protectedEndpoints = ['/api/v1/crm/leads', '/api/v1/crm/contacts', '/api/v1/crm/companies', '/api/v1/hrms/departments', '/api/v1/admin/users'];
  for (const ep of protectedEndpoints) {
    r = await api(ep, { noAuth: true });
    record('Unauth', `${ep} → 401`, r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // ── 10. PUBLIC PAGES ──
  log('\n── 10. PUBLIC PAGES ──');
  const publicPages = ['/login', '/signup', '/forgot-password', '/setup'];
  for (const page of publicPages) {
    r = await fetch(`${BASE}${page}`);
    record('Pages', `${page} loads`, r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // ── 11. PROTECTED PAGES REDIRECT ──
  log('\n── 11. PROTECTED PAGES REDIRECT ──');
  const protectedPages = ['/dashboard', '/leads', '/contacts', '/companies', '/deals', '/employees', '/settings'];
  for (const page of protectedPages) {
    r = await fetch(`${BASE}${page}`, { redirect: 'manual' });
    const redirected = r.status === 307 || r.status === 302;
    record('Redirect', `${page} → login`, redirected ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // ── 12. NO DATA LEAKS ──
  log('\n── 12. NO DATA LEAKS ──');
  r = await api('/api/v1/crm/leads/not-a-uuid', { token: at });
  const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
  const leakPatterns = [/DATABASE_URL/i, /JWT_SECRET/i, /stack\s+trace/i, /prisma.*error/i, /ENOENT/i];
  const leaked = leakPatterns.some(p => p.test(body));
  record('Leaks', 'No sensitive data in errors', !leaked ? 'PASS' : 'FAIL', leaked ? 'LEAKED!' : 'clean');

  // ── 13. MOBILE RESPONSIVE ──
  log('\n── 13. MOBILE RESPONSIVE ──');
  r = await fetch(`${BASE}/login`, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' } });
  record('Mobile', 'Login page on iPhone', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await fetch(`${BASE}/signup`, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36' } });
  record('Mobile', 'Signup page on Android', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ── 14. LOGOUT ──
  log('\n── 14. LOGOUT ──');
  // Login fresh for logout test
  r = await api('/api/v1/auth/login', { method: 'POST', noAuth: true, body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }) });
  const logoutToken = r.data?.data?.accessToken || '';
  const logoutRT = r.data?.data?.refreshToken || '';
  
  r = await api('/api/v1/auth/logout', { method: 'POST', token: logoutToken, body: JSON.stringify({ refreshToken: logoutRT }) });
  record('Auth', 'Logout', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  
  // Verify session invalidated
  r = await api('/api/v1/auth/refresh', { method: 'POST', noAuth: true, body: JSON.stringify({ refreshToken: logoutRT }) });
  record('Auth', 'RT revoked after logout', !r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ═══════════════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════════════
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  
  log('\n' + '═'.repeat(60));
  log('  COMMERCIAL SMOKE TEST — RESULTS');
  log('═'.repeat(60));
  log(`  TOTAL: ${results.passed + results.failed} tests`);
  log(`  ✅ PASS: ${results.passed}`);
  log(`  ❌ FAIL: ${results.failed}`);
  log(`  Time: ${elapsed}s`);
  
  if (results.errors.length > 0) {
    log('\n  ❌ FAILURES:');
    results.errors.forEach(e => log(`    - ${e}`));
  }

  const categories = {};
  for (const d of results.details) {
    if (!categories[d.cat]) categories[d.cat] = { pass: 0, fail: 0 };
    if (d.status === 'PASS') categories[d.cat].pass++;
    else if (d.status === 'FAIL') categories[d.cat].fail++;
  }
  log('\n  CATEGORY BREAKDOWN:');
  for (const [cat, counts] of Object.entries(categories)) {
    log(`    ${cat}: ${counts.pass}P ${counts.fail}F`);
  }

  const fs = require('fs');
  fs.writeFileSync('/home/z/my-project/scripts/commercial-smoke-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    results: { passed: results.passed, failed: results.failed, total: results.passed + results.failed, elapsed },
    details: results.details,
    errors: results.errors,
    status: results.failed === 0 ? 'ALL_PASS' : 'FAILURES_FOUND'
  }, null, 2));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
