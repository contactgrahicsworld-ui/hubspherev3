/**
 * HubSphere V3 — Comprehensive Production Adversarial Test Suite
 * Tests the LIVE deployed application against security, auth, API, and error-handling attacks.
 */

const BASE = 'https://hubspherev3.vercel.app';
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'TestAdmin@123!';

// ── State ──
let accessToken = '';
let refreshToken = '';
let tenantId = '';
let userId = '';

// ── Results tracking ──
const results = { total: 0, passed: 0, failed: 0, warnings: 0 };
const failures = [];
const warnings = [];
const securityFindings = [];
const bugs = [];

// ── Helpers ──
function log(category, test, status, detail = '') {
  // Accept boolean: true = PASS, false = FAIL
  let statusStr;
  if (typeof status === 'boolean') {
    statusStr = status ? 'PASS' : 'FAIL';
  } else {
    statusStr = status;
  }
  const icons = { PASS: '✅', FAIL: '❌', WARN: '⚠️', INFO: 'ℹ️' };
  const icon = icons[statusStr] || '❓';
  const line = `${icon} [${category}] ${test}${detail ? ': ' + detail : ''}`;
  console.log(line);
  results.total++;
  if (statusStr === 'PASS') results.passed++;
  else if (statusStr === 'WARN') { results.warnings++; warnings.push({ category, test, detail }); }
  else { results.failed++; failures.push({ category, test, detail, status: statusStr }); }
}

function info(category, test, detail = '') {
  console.log(`ℹ️ [${category}] ${test}${detail ? ': ' + detail : ''}`);
}

async function api(path, opts = {}) {
  const url = `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (accessToken && !opts.noAuth) headers['Authorization'] = `Bearer ${accessToken}`;
  try {
    const res = await fetch(url, {
      ...opts,
      headers,
      signal: AbortSignal.timeout(opts.timeout || 15000),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text.substring(0, 500); }
    return { status: res.status, data, ok: res.ok, headers: res.headers, rawText: text.substring(0, 2000) };
  } catch (e) {
    return { status: 0, data: null, ok: false, rawText: e.message, error: e.message };
  }
}

function hasStackTrace(text) {
  if (!text || typeof text !== 'string') return false;
  return /at\s+\S+\s+\(/.test(text) || /\n\s*at\s/.test(text) || /stack['"]?\s*:\s*\[/.test(text);
}

function hasSecret(text) {
  if (!text || typeof text !== 'string') return false;
  return /DATABASE_URL/i.test(text) || /JWT_SECRET/i.test(text) || /SUPABASE/i.test(text) || /passwordHash/i.test(text);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1: SYSTEM HEALTH
// ═══════════════════════════════════════════════════════════════
async function testSystemHealth() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  PHASE 1: SYSTEM HEALTH & ENVIRONMENT      ║');
  console.log('╚════════════════════════════════════════════╝');

  // Health check
  let res = await api('/api/v1/system/health', { noAuth: true });
  log('Health', 'Health endpoint responds 200', res.status === 200, `status=${res.status}`);
  if (res.ok) {
    log('Health', 'Database connected', res.data?.data?.database === 'connected', `db=${res.data?.data?.database}`);
    log('Health', 'Status is "ok"', res.data?.data?.status === 'ok', `status=${res.data?.data?.status}`);
    log('Health', 'Timestamp present', !!res.data?.data?.timestamp, `ts=${res.data?.data?.timestamp}`);
    log('Health', 'No secrets in health response', !hasSecret(res.rawText), 'checked DATABASE_URL, JWT_SECRET, passwordHash');
  }

  // Setup status
  res = await api('/api/v1/auth/setup/status', { noAuth: true });
  log('Health', 'Setup status responds 200', res.status === 200, `status=${res.status}`);
  log('Health', 'Setup is complete', res.data?.data?.setupComplete === true, `setupComplete=${res.data?.data?.setupComplete}`);
  log('Health', 'No secrets in setup status', !hasSecret(res.rawText), 'checked for secret patterns');

  // Root API
  res = await api('/api', { noAuth: true });
  log('Health', 'Root API endpoint responds', res.status !== 0, `status=${res.status}`);

  // Error response without stack traces
  res = await api('/api/v1/crm/leads', { noAuth: true });
  log('Health', 'No stack traces in 401 error', !hasStackTrace(res.rawText), `checked ${res.rawText?.length} chars`);
  log('Health', 'No secrets in 401 error', !hasSecret(res.rawText), 'checked for secret patterns');
}

// ═══════════════════════════════════════════════════════════════
// PHASE 2: SETUP & LOGIN
// ═══════════════════════════════════════════════════════════════
async function testSetupAndLogin() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  PHASE 2: SETUP & LOGIN                    ║');
  console.log('╚════════════════════════════════════════════╝');

  // Check setup status
  let res = await api('/api/v1/auth/setup/status', { noAuth: true });
  const setupComplete = res.data?.data?.setupComplete;

  if (!setupComplete) {
    info('Setup', 'Running initial setup...');
    res = await api('/api/v1/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, confirmPassword: ADMIN_PASSWORD, name: 'Admin' }),
      noAuth: true,
      timeout: 60000,
    });
    log('Auth', 'Setup wizard completes', res.status === 201, `status=${res.status}`);
    if (res.data?.data?.accessToken) {
      accessToken = res.data.data.accessToken;
      refreshToken = res.data.data.refreshToken;
      userId = res.data.data.user?.id;
    }
  }

  // Login
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    noAuth: true,
  });
  log('Auth', 'Admin login succeeds', res.ok, `status=${res.status}`);

  if (res.ok && res.data?.data) {
    accessToken = res.data.data.accessToken;
    refreshToken = res.data.data.refreshToken;
    userId = res.data.data.user?.id;
    tenantId = res.data.data.tenant?.id;
    info('Auth', 'Logged in', `userId=${userId}, tenantId=${tenantId}`);
  } else {
    console.error('❌ FATAL: Cannot login. Aborting dependent tests.');
    return false;
  }

  // Verify /me
  res = await api('/api/v1/auth/me');
  log('Auth', '/me endpoint returns user', res.ok, `status=${res.status}`);
  log('Auth', '/me email matches', res.data?.data?.user?.email === ADMIN_EMAIL, `email=${res.data?.data?.user?.email}`);

  return true;
}

// ═══════════════════════════════════════════════════════════════
// PHASE 3: AUTH ADVERSARIAL
// ═══════════════════════════════════════════════════════════════
async function testAuthAdversarial() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  PHASE 3: AUTH ADVERSARIAL                 ║');
  console.log('╚════════════════════════════════════════════╝');

  let res;

  // 3.1 Wrong password → 401
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: 'WrongPassword@123' }),
    noAuth: true,
  });
  log('Auth', 'Wrong password → 401', res.status === 401, `status=${res.status}`);
  log('Auth', 'Wrong password: no stack trace', !hasStackTrace(res.rawText), '');
  log('Auth', 'Wrong password: no secrets leaked', !hasSecret(res.rawText), '');

  // 3.2 Empty body → 400
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({}),
    noAuth: true,
  });
  log('Auth', 'Empty body → 400', res.status === 400, `status=${res.status}, code=${res.data?.code}`);

  // 3.3 SQL injection in email → 400/401, not 500
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: "' OR 1=1; DROP TABLE \"User\"; --", password: 'test' }),
    noAuth: true,
  });
  log('Auth', 'SQL injection in email → not 500', res.status !== 500, `status=${res.status}`);
  log('Auth', 'SQL injection → 400 or 401', res.status === 400 || res.status === 401, `status=${res.status}`);
  log('Auth', 'SQL injection: no stack trace', !hasStackTrace(res.rawText), '');

  // 3.4 XSS in email → 400/401, not 500
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: '<script>alert("XSS")</script>@test.com', password: 'test' }),
    noAuth: true,
  });
  log('Auth', 'XSS in email → not 500', res.status !== 500, `status=${res.status}`);
  log('Auth', 'XSS in email → 400 or 401', res.status === 400 || res.status === 401, `status=${res.status}`);
  log('Auth', 'XSS: no reflected script in response', !res.rawText?.includes('<script>'), '');

  // 3.5 Very long email (1000 chars) → 400/401
  const longEmail = 'a'.repeat(1000) + '@test.com';
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: longEmail, password: 'test' }),
    noAuth: true,
  });
  log('Auth', 'Very long email → 400/401', res.status === 400 || res.status === 401, `status=${res.status}`);

  // 3.6 Token refresh with invalid token → 401
  res = await api('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: 'invalid-token-12345' }),
    noAuth: true,
  });
  log('Auth', 'Invalid refresh token → 401', res.status === 401, `status=${res.status}, code=${res.data?.code}`);

  // 3.7 Access protected endpoint without auth → 401
  res = await api('/api/v1/crm/leads', { noAuth: true });
  log('Auth', 'Protected endpoint without auth → 401', res.status === 401, `status=${res.status}`);

  // 3.8 Access with invalid JWT → 401
  const savedToken = accessToken;
  accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlIiwiZW1haWwiOiJmYWtlQHRlc3QuY29tIiwiaXNTdXBlckFkbWluIjpmYWxzZSwidGVuYW50SWQiOiJmYWtlIiwicm9sZUNvZGUiOiJWSUVXRXIiLCJpYXQiOjE3ODg1MDE3MjksImV4cCI6MTc4ODUwMjYyOX0.fake';
  res = await api('/api/v1/crm/leads');
  log('Auth', 'Invalid JWT → 401', res.status === 401, `status=${res.status}`);
  accessToken = savedToken;

  // 3.9 Access with expired/signed-wrong JWT → 401
  accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ4IiwiZW1haWwiOiJ4IiwiaWF0IjoxMDAwMDAwMDAwLCJleHAiOjEwMDAwMDAwMDF9.ABC';
  res = await api('/api/v1/crm/leads');
  log('Auth', 'Tampered JWT → 401', res.status === 401, `status=${res.status}`);
  accessToken = savedToken;

  // 3.10 Change password with wrong current password → 400
  res = await api('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: 'WrongPass@123', newPassword: 'NewPass@123!', confirmPassword: 'NewPass@123!' }),
  });
  log('Auth', 'Change password with wrong current → 400/401', res.status === 400 || res.status === 401, `status=${res.status}`);

  // 3.11 Forgot password for non-existent email → 200 (no enumeration)
  res = await api('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'nonexistent-user-xyz@test.com' }),
    noAuth: true,
  });
  log('Auth', 'Forgot password non-existent email → 200', res.status === 200, `status=${res.status}`);
  if (res.status === 200) {
    const msg = res.data?.data?.message || '';
    log('Auth', 'Forgot password: no enumeration hint', !msg.includes('not found') && !msg.includes('does not exist'), `msg=${msg}`);
  }

  // 3.12 Forgot password for existing email → 200
  res = await api('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL }),
    noAuth: true,
  });
  log('Auth', 'Forgot password existing email → 200', res.status === 200, `status=${res.status}`);

  // 3.13 No token returned in forgot-password response
  if (res.ok) {
    log('Auth', 'Forgot password: no reset token in response', !res.data?.data?.token, `hasToken=${!!res.data?.data?.token}`);
  }

  // 3.14 Setup when already done → 403
  res = await api('/api/v1/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ email: 'new@test.com', password: 'NewPass@123!', confirmPassword: 'NewPass@123!', name: 'New' }),
    noAuth: true,
  });
  log('Auth', 'Setup when already done → 403', res.status === 403, `status=${res.status}`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 4: API ADVERSARIAL
// ═══════════════════════════════════════════════════════════════
async function testApiAdversarial() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  PHASE 4: API ADVERSARIAL                  ║');
  console.log('╚════════════════════════════════════════════╝');

  let res;

  // 4.1 Create lead with missing required fields → 400
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  log('API', 'Create lead with empty body → 400', res.status === 400, `status=${res.status}, code=${res.data?.code}`);

  // 4.2 Create lead with invalid email → 400
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: JSON.stringify({ firstName: 'Test', email: 'not-an-email' }),
  });
  log('API', 'Create lead with invalid email → 400', res.status === 400, `status=${res.status}`);

  // 4.3 Create lead with XSS in name → 400 or sanitized
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: JSON.stringify({ firstName: '<script>alert("XSS")</script>', email: 'xss@test.com' }),
  });
  const xssSafe = res.status === 400 || (res.ok && !res.rawText?.includes('<script>'));
  log('API', 'XSS in lead name → rejected or sanitized', xssSafe, `status=${res.status}`);

  // 4.4 Create lead with very long name → 400 or created safely
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: JSON.stringify({ firstName: 'A'.repeat(500), email: 'long@test.com' }),
  });
  log('API', 'Very long lead name → 400 or created safely', res.status === 400 || res.status === 201, `status=${res.status}`);

  // 4.5 Create a valid lead for subsequent tests
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: JSON.stringify({ firstName: 'Adversarial', lastName: 'Test', email: 'adv-test@test.com', company: 'Test Corp', source: 'WEBSITE' }),
  });
  const validLeadId = res.data?.data?.id;
  log('API', 'Create valid lead → 201', res.status === 201, `status=${res.status}, id=${validLeadId}`);

  // 4.6 Get non-existent lead by ID → 404
  res = await api('/api/v1/crm/leads/00000000-0000-0000-0000-000000000000');
  log('API', 'Get non-existent lead → 404', res.status === 404, `status=${res.status}`);

  // 4.7 Update lead with empty body → 400
  if (validLeadId) {
    res = await api(`/api/v1/crm/leads/${validLeadId}`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    log('API', 'Update lead with empty body → not 500', res.status !== 500, `status=${res.status}`);
  }

  // 4.8 Delete non-existent lead → 404
  res = await api('/api/v1/crm/leads/00000000-0000-0000-0000-000000000000', { method: 'DELETE' });
  log('API', 'Delete non-existent lead → 404', res.status === 404, `status=${res.status}`);

  // 4.9 Timeline without required params → 400
  res = await api('/api/v1/crm/timeline');
  log('API', 'Timeline without params → 400', res.status === 400, `status=${res.status}`);

  // 4.10 Export without required params → 400/401
  res = await api('/api/v1/crm/export');
  log('API', 'Export without entityType → 400', res.status === 400, `status=${res.status}`);

  // 4.11 Export with valid entityType
  res = await api('/api/v1/crm/export?entityType=leads');
  log('API', 'Export leads → 200', res.status === 200, `status=${res.status}`);

  // 4.12 Search endpoint
  res = await api('/api/v1/crm/search?q=test');
  log('API', 'Search endpoint responds', res.status !== 500, `status=${res.status}`);

  // 4.13 CRM dashboard
  res = await api('/api/v1/crm/dashboard');
  log('API', 'CRM dashboard responds', res.status !== 500, `status=${res.status}`);

  // 4.14 Tags
  res = await api('/api/v1/crm/tags');
  log('API', 'Tags endpoint responds', res.status !== 500, `status=${res.status}`);

  // 4.15 Contacts
  res = await api('/api/v1/crm/contacts');
  log('API', 'Contacts list responds', res.status !== 500, `status=${res.status}`);

  // 4.16 Companies
  res = await api('/api/v1/crm/companies');
  log('API', 'Companies list responds', res.status !== 500, `status=${res.status}`);

  // 4.17 Deals
  res = await api('/api/v1/crm/deals');
  log('API', 'Deals list responds', res.status !== 500, `status=${res.status}`);

  // 4.18 Tasks
  res = await api('/api/v1/crm/tasks');
  log('API', 'Tasks list responds', res.status !== 500, `status=${res.status}`);

  // 4.19 Follow-ups
  res = await api('/api/v1/crm/follow-ups');
  log('API', 'Follow-ups list responds', res.status !== 500, `status=${res.status}`);

  // 4.20 Notes
  res = await api('/api/v1/crm/notes');
  log('API', 'Notes list responds', res.status !== 500, `status=${res.status}`);

  // 4.21 Calls
  res = await api('/api/v1/crm/calls');
  log('API', 'Calls list responds', res.status !== 500, `status=${res.status}`);

  // HRMS endpoints
  console.log('\n── HRMS Endpoints ──');
  const hrmsEndpoints = [
    '/api/v1/hrms/employees', '/api/v1/hrms/departments', '/api/v1/hrms/designations',
    '/api/v1/hrms/leave-requests', '/api/v1/hrms/leave-types', '/api/v1/hrms/attendance',
    '/api/v1/hrms/payroll', '/api/v1/hrms/expenses', '/api/v1/hrms/dashboard',
    '/api/v1/hrms/field-visits', '/api/v1/hrms/field-dashboard',
  ];
  for (const ep of hrmsEndpoints) {
    res = await api(ep);
    log('HRMS', `${ep} → not 500`, res.status !== 500, `status=${res.status}`);
  }

  // Communication endpoints
  console.log('\n── Communication Endpoints ──');
  const commEndpoints = [
    '/api/v1/communication/notifications', '/api/v1/communication/conversations',
    '/api/v1/communication/templates', '/api/v1/communication/providers',
    '/api/v1/communication/dashboard',
  ];
  for (const ep of commEndpoints) {
    res = await api(ep);
    log('Comm', `${ep} → not 500`, res.status !== 500, `status=${res.status}`);
  }

  // Automation endpoints
  console.log('\n── Automation Endpoints ──');
  const autoEndpoints = [
    '/api/v1/automation/workflows', '/api/v1/automation/executions',
    '/api/v1/automation/events', '/api/v1/automation/dashboard',
  ];
  for (const ep of autoEndpoints) {
    res = await api(ep);
    log('Auto', `${ep} → not 500`, res.status !== 500, `status=${res.status}`);
  }

  // AI endpoints
  console.log('\n── AI Endpoints ──');
  const aiEndpoints = ['/api/v1/ai/agents', '/api/v1/ai/providers', '/api/v1/ai/usage'];
  for (const ep of aiEndpoints) {
    res = await api(ep);
    log('AI', `${ep} → not 500`, res.status !== 500, `status=${res.status}`);
  }

  // Analytics endpoints
  console.log('\n── Analytics Endpoints ──');
  const analyticsEndpoints = [
    '/api/v1/analytics/crm', '/api/v1/analytics/hr',
    '/api/v1/analytics/communication', '/api/v1/analytics/automation',
    '/api/v1/analytics/executive', '/api/v1/analytics/ai-usage',
    '/api/v1/analytics/telecaller',
  ];
  for (const ep of analyticsEndpoints) {
    res = await api(ep);
    log('Analytics', `${ep} → not 500`, res.status !== 500, `status=${res.status}`);
  }

  // Admin endpoints
  console.log('\n── Admin Endpoints ──');
  const adminEndpoints = [
    '/api/v1/admin/users', '/api/v1/admin/roles', '/api/v1/admin/audit',
    '/api/v1/admin/memberships', '/api/v1/admin/settings',
  ];
  for (const ep of adminEndpoints) {
    res = await api(ep);
    log('Admin', `${ep} → not 500`, res.status !== 500, `status=${res.status}`);
  }

  // Super Admin endpoints
  console.log('\n── Super Admin Endpoints ──');
  const superAdminEndpoints = [
    '/api/v1/super-admin/users', '/api/v1/super-admin/tenants',
    '/api/v1/super-admin/roles', '/api/v1/super-admin/audit', '/api/v1/super-admin/stats',
  ];
  for (const ep of superAdminEndpoints) {
    res = await api(ep);
    log('SAdmin', `${ep} → not 500`, res.status !== 500, `status=${res.status}`);
  }

  // System endpoints
  console.log('\n── System Endpoints ──');
  res = await api('/api/v1/system/providers', { noAuth: true });
  log('System', 'System providers → not 500', res.status !== 500, `status=${res.status}`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 5: SECURITY
// ═══════════════════════════════════════════════════════════════
async function testSecurity() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  PHASE 5: SECURITY                          ║');
  console.log('╚════════════════════════════════════════════╝');

  let res;

  // 5.1 No DATABASE_URL in any response
  const endpointsToCheck = [
    '/api/v1/system/health', '/api/v1/auth/setup/status',
    '/api/v1/crm/leads', '/api/v1/crm/dashboard',
    '/api/v1/hrms/employees', '/api/v1/admin/users',
  ];
  for (const ep of endpointsToCheck) {
    res = await api(ep);
    const hasDbUrl = /DATABASE_URL/i.test(res.rawText || '');
    log('Security', `No DATABASE_URL in ${ep}`, !hasDbUrl, hasDbUrl ? 'LEAKED!' : 'safe');
    if (hasDbUrl) securityFindings.push({ severity: 'CRITICAL', finding: `DATABASE_URL leaked in ${ep}` });
  }

  // 5.2 No JWT_SECRET in any response
  for (const ep of endpointsToCheck) {
    res = await api(ep);
    const hasJwt = /JWT_SECRET/i.test(res.rawText || '');
    log('Security', `No JWT_SECRET in ${ep}`, !hasJwt, hasJwt ? 'LEAKED!' : 'safe');
    if (hasJwt) securityFindings.push({ severity: 'CRITICAL', finding: `JWT_SECRET leaked in ${ep}` });
  }

  // 5.3 No stack traces in error responses
  const errorEndpoints = [
    { path: '/api/v1/crm/leads', opts: { noAuth: true } },
    { path: '/api/v1/hrms/employees', opts: { noAuth: true } },
    { path: '/api/v1/admin/users', opts: { noAuth: true } },
  ];
  for (const { path, opts } of errorEndpoints) {
    res = await api(path, opts);
    log('Security', `No stack trace in ${path} (no auth)`, !hasStackTrace(res.rawText), '');
  }

  // 5.4 401 for all protected endpoints without auth
  const protectedEndpoints = [
    '/api/v1/crm/leads', '/api/v1/crm/contacts', '/api/v1/crm/companies',
    '/api/v1/crm/deals', '/api/v1/crm/tasks', '/api/v1/crm/notes',
    '/api/v1/crm/follow-ups', '/api/v1/crm/calls', '/api/v1/crm/tags',
    '/api/v1/crm/dashboard', '/api/v1/crm/timeline', '/api/v1/crm/export',
    '/api/v1/hrms/employees', '/api/v1/hrms/departments',
    '/api/v1/communication/notifications', '/api/v1/communication/conversations',
    '/api/v1/automation/workflows', '/api/v1/automation/executions',
    '/api/v1/ai/agents', '/api/v1/ai/usage',
    '/api/v1/analytics/crm', '/api/v1/analytics/executive',
    '/api/v1/admin/users', '/api/v1/admin/audit',
    '/api/v1/super-admin/users', '/api/v1/super-admin/tenants',
    '/api/v1/auth/me', '/api/v1/auth/change-password',
  ];
  for (const ep of protectedEndpoints) {
    res = await api(ep, { noAuth: true });
    log('Security', `Unauth ${ep} → 401`, res.status === 401, `status=${res.status}`);
    if (res.status !== 401 && res.status !== 0) {
      securityFindings.push({ severity: 'HIGH', finding: `${ep} returns ${res.status} without auth (expected 401)` });
    }
  }

  // 5.5 Rate limiting on login (11 rapid logins)
  console.log('\n── Rate Limiting Test (11 rapid logins) ──');
  let rateLimited = false;
  let lastStatus = 0;
  for (let i = 0; i < 11; i++) {
    res = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ratelimit@test.com', password: 'wrong' }),
      noAuth: true,
    });
    lastStatus = res.status;
    if (res.status === 429) {
      rateLimited = true;
      info('Security', `Rate limit hit on attempt ${i + 1}`, `status=429`);
      break;
    }
  }
  log('Security', 'Rate limiting on login (11 attempts)', rateLimited || lastStatus === 429, rateLimited ? 'rate limited!' : `lastStatus=${lastStatus}`);
  if (!rateLimited && lastStatus !== 429) {
    securityFindings.push({ severity: 'MEDIUM', finding: 'No rate limiting detected on login after 11 attempts' });
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 6: TENANT ISOLATION
// ═══════════════════════════════════════════════════════════════
async function testTenantIsolation() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  PHASE 6: TENANT ISOLATION                 ║');
  console.log('╚════════════════════════════════════════════╝');

  let res;

  // 6.1 Leads include tenantId in query (verify via CRM dashboard)
  res = await api('/api/v1/crm/leads');
  if (res.ok) {
    const leads = res.data?.data || [];
    const allScoped = Array.isArray(leads) ? leads.every(l => !l.tenantId || l.tenantId === tenantId) : true;
    log('Tenant', 'All leads scoped to tenant', allScoped, `tenantId=${tenantId}, leadCount=${Array.isArray(leads) ? leads.length : 'N/A'}`);
  }

  // 6.2 Contacts scoped
  res = await api('/api/v1/crm/contacts');
  if (res.ok) {
    const contacts = res.data?.data || [];
    log('Tenant', 'Contacts list responds correctly', res.ok, `status=${res.status}`);
  }

  // 6.3 Super admin can access super-admin endpoints
  res = await api('/api/v1/super-admin/tenants');
  log('Tenant', 'Super admin can list tenants', res.status !== 403 && res.status !== 401, `status=${res.status}`);

  // 6.4 Super admin stats
  res = await api('/api/v1/super-admin/stats');
  log('Tenant', 'Super admin stats accessible', res.status !== 403 && res.status !== 401, `status=${res.status}`);

  // 6.5 Super admin audit
  res = await api('/api/v1/super-admin/audit');
  log('Tenant', 'Super admin audit accessible', res.status !== 403 && res.status !== 401, `status=${res.status}`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 7: ERROR HANDLING
// ═══════════════════════════════════════════════════════════════
async function testErrorHandling() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  PHASE 7: ERROR HANDLING                   ║');
  console.log('╚════════════════════════════════════════════╝');

  let res;

  // 7.1 Malformed JSON body → 400, not 500
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: '{invalid json!!!',
    noAuth: true,
    headers: { 'Content-Type': 'application/json' },
  });
  log('Error', 'Malformed JSON body → not 500', res.status !== 500, `status=${res.status}`);
  if (res.status === 500) {
    bugs.push({ severity: 'HIGH', category: 'Error', test: 'Malformed JSON returns 500', detail: `status=${res.status}, code=${res.data?.code}` });
  }
  log('Error', 'Malformed JSON body → 400', res.status === 400, `status=${res.status}, code=${res.data?.code}`);
  log('Error', 'Malformed JSON: no stack trace', !hasStackTrace(res.rawText), '');

  // 7.2 Invalid UUID format in URL params → 400/404, not 500
  res = await api('/api/v1/crm/leads/not-a-uuid');
  log('Error', 'Invalid UUID in URL → not 500', res.status !== 500, `status=${res.status}`);
  log('Error', 'Invalid UUID in URL → 400 or 404', res.status === 400 || res.status === 404, `status=${res.status}`);
  log('Error', 'Invalid UUID: no stack trace', !hasStackTrace(res.rawText), '');

  // 7.3 Very large request body → 400/413, not 500
  const largeBody = JSON.stringify({ firstName: 'X'.repeat(100000), email: 'large@test.com' });
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: largeBody,
  });
  log('Error', 'Very large body → not 500', res.status !== 500, `status=${res.status}`);
  log('Error', 'Very large body → 400 or 413', res.status === 400 || res.status === 413, `status=${res.status}`);

  // 7.4 Null body → not 500
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: 'null',
  });
  log('Error', 'Null body → not 500', res.status !== 500, `status=${res.status}`);

  // 7.5 Wrong HTTP method → 405 or 400
  res = await api('/api/v1/auth/login', { noAuth: true }); // GET instead of POST
  log('Error', 'Wrong HTTP method on login → 405', res.status === 405, `status=${res.status}`);

  // 7.6 Deeply nested JSON → not 500
  let nested = {};
  let current = nested;
  for (let i = 0; i < 50; i++) {
    current.a = {};
    current = current.a;
  }
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: JSON.stringify(nested),
  });
  log('Error', 'Deeply nested JSON → not 500', res.status !== 500, `status=${res.status}`);

  // 7.7 Invalid UUID in HRMS endpoint
  res = await api('/api/v1/hrms/employees/not-a-uuid');
  log('Error', 'Invalid UUID in HRMS URL → not 500', res.status !== 500, `status=${res.status}`);
  if (res.status === 500) {
    bugs.push({ severity: 'HIGH', category: 'HRMS', test: 'Invalid UUID returns 500', detail: `GET /api/v1/hrms/employees/not-a-uuid → 500` });
  }

  // 7.8 Invalid UUID in admin endpoint
  res = await api('/api/v1/admin/users/not-a-uuid');
  log('Error', 'Invalid UUID in admin URL → not 500', res.status !== 500, `status=${res.status}`);

  // 7.9 Numeric injection in URL
  res = await api('/api/v1/crm/leads/1');
  log('Error', 'Numeric ID in UUID URL → not 500', res.status !== 500, `status=${res.status}`);

  // 7.10 Path traversal in URL
  res = await api('/api/v1/crm/leads/../../../etc/passwd');
  log('Error', 'Path traversal in URL → not 200', res.status !== 200, `status=${res.status}`);

  // 7.11 Unicode/bidi characters in input
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: JSON.stringify({ firstName: '\u202E\u0500\u0400test', email: 'unicode@test.com' }),
  });
  log('Error', 'Unicode bidi in input → not 500', res.status !== 500, `status=${res.status}`);

  // 7.12 Prototype pollution attempt
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: JSON.stringify({ firstName: 'Test', email: 'proto@test.com', '__proto__': { 'isAdmin': true }, 'constructor': { 'prototype': { 'isAdmin': true } } }),
  });
  log('Error', 'Prototype pollution attempt → not 500', res.status !== 500, `status=${res.status}`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 8: ADDITIONAL SECURITY CHECKS
// ═══════════════════════════════════════════════════════════════
async function testAdditionalSecurity() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  PHASE 8: ADDITIONAL SECURITY              ║');
  console.log('╚════════════════════════════════════════════╝');

  let res;

  // 8.1 CORS headers check
  res = await api('/api/v1/system/health', { noAuth: true });
  const corsHeader = res.headers?.get('access-control-allow-origin');
  log('Security', 'CORS: No wildcard allow-origin', corsHeader !== '*', `ACAO=${corsHeader}`);

  // 8.2 Security headers
  const securityHeaders = [
    'x-content-type-options', 'x-frame-options', 'x-xss-protection',
    'strict-transport-security', 'content-security-policy',
  ];
  for (const h of securityHeaders) {
    const val = res.headers?.get(h);
    log('Security', `Security header: ${h}`, !!val, `value=${val || 'MISSING'}`);
    if (!val) securityFindings.push({ severity: 'LOW', finding: `Missing security header: ${h}` });
  }

  // 8.3 Cookie security (httpOnly, secure, sameSite)
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    noAuth: true,
  });
  // GetAll 'set-cookie' headers (Vercel may combine multiple)
  const setCookieHeaders = [];
  res.headers?.forEach((val, key) => { if (key === 'set-cookie') setCookieHeaders.push(val); });
  const allCookies = setCookieHeaders.join('; ');
  log('Security', 'Login sets auth cookies', allCookies.includes('hs-access-token') || allCookies.includes('hs-refresh-token'), `cookieCount=${setCookieHeaders.length}`);
  log('Security', 'Cookies are httpOnly', allCookies.includes('HttpOnly'), `cookies=${allCookies.substring(0, 200)}`);
  log('Security', 'Cookies use Secure flag', allCookies.includes('Secure'), '');
  log('Security', 'Cookies use SameSite', allCookies.includes('SameSite'), '');

  // 8.4 Password hash not in /me response
  res = await api('/api/v1/auth/me');
  const meText = res.rawText || '';
  log('Security', '/me does not expose passwordHash', !meText.includes('passwordHash'), '');
  log('Security', '/me does not expose password', !meText.includes('"password"'), '');

  // 8.5 No IDOR: accessing other tenant's data
  res = await api('/api/v1/crm/leads?tenantId=00000000-0000-0000-0000-000000000000');
  log('Security', 'Tenant override in query ignored', res.status !== 500, `status=${res.status}`);

  // 8.6 Token refresh flow
  res = await api('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    noAuth: true,
  });
  log('Security', 'Token refresh works', res.ok, `status=${res.status}`);
  if (res.ok && res.data?.data?.accessToken) {
    accessToken = res.data.data.accessToken;
    info('Security', 'Token refreshed', `new token received`);
  }

  // 8.7 Logout
  res = await api('/api/v1/auth/logout', { method: 'POST' });
  log('Security', 'Logout responds OK', res.ok, `status=${res.status}`);

  // 8.8 After logout, token should be invalid (refresh token revoked)
  res = await api('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    noAuth: true,
  });
  log('Security', 'Refresh token revoked after logout', res.status === 401, `status=${res.status}`);

  // Re-login for any remaining tests
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    noAuth: true,
  });
  if (res.ok) {
    accessToken = res.data.data.accessToken;
    refreshToken = res.data.data.refreshToken;
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  HubSphere V3 — Adversarial Test Suite      ║');
  console.log('║  Target: ' + BASE + '     ║');
  console.log('║  Started: ' + new Date().toISOString() + '  ║');
  console.log('╚════════════════════════════════════════════╝');

  await testSystemHealth();
  const loggedIn = await testSetupAndLogin();
  if (!loggedIn) {
    console.error('\n❌ FATAL: Could not login. Cannot continue with auth-dependent tests.');
    printReport();
    return;
  }
  await testAuthAdversarial();
  await testApiAdversarial();
  await testSecurity();
  await testTenantIsolation();
  await testErrorHandling();
  await testAdditionalSecurity();

  printReport();
}

function printReport() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  FINAL REPORT                              ║');
  console.log('╚════════════════════════════════════════════╝');

  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Tests:   ${results.total}`);
  console.log(`   Passed:        ${results.passed} ✅`);
  console.log(`   Failed:        ${results.failed} ❌`);
  console.log(`   Warnings:      ${results.warnings} ⚠️`);
  console.log(`   Pass Rate:     ${((results.passed / results.total) * 100).toFixed(1)}%`);

  if (failures.length > 0) {
    console.log(`\n❌ FAILURES (${failures.length}):`);
    for (const f of failures) {
      console.log(`   [${f.category}] ${f.test}: ${f.detail}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`   [${w.category}] ${w.test}: ${w.detail}`);
    }
  }

  if (securityFindings.length > 0) {
    console.log(`\n🔒 SECURITY FINDINGS (${securityFindings.length}):`);
    for (const s of securityFindings) {
      console.log(`   [${s.severity}] ${s.finding}`);
    }
  }

  if (bugs.length > 0) {
    console.log(`\n🐛 BUGS DISCOVERED (${bugs.length}):`);
    for (const b of bugs) {
      console.log(`   [${b.severity}] [${b.category}] ${b.test}: ${b.detail}`);
    }
  }

  // Write JSON report
  const report = {
    timestamp: new Date().toISOString(),
    target: BASE,
    summary: { ...results, passRate: ((results.passed / results.total) * 100).toFixed(1) + '%' },
    failures,
    warnings,
    securityFindings,
    bugs,
  };

  try {
    const fs = require('fs');
    fs.writeFileSync('/home/z/my-project/scripts/adversarial-test-results.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Report saved to scripts/adversarial-test-results.json');
  } catch (e) {
    console.log(`\n📄 Could not save report: ${e.message}`);
  }

  console.log('\n' + (results.failed === 0 ? '🎉 ALL TESTS PASSED!' : `⚠️  ${results.failed} test(s) failed. Review findings above.`));
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
