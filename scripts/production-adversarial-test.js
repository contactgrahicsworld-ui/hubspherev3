/**
 * HubSphere V3 — Production Adversarial Test Suite
 * Tests the LIVE deployed application for real bugs, not mocked claims.
 */
const BASE = 'https://hubspherev3.ver<cel.app';
let accessToken = '';
let refreshToken = '';
let userId = '';
let tenantId = '';

const bugs = [];
const results = { passed: 0, failed: 0, total: 0 };

function log(cat, test, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} [${cat}] ${test}${detail ? ': ' + detail : ''}`);
  results.total++;
  if (status === 'PASS') results.passed++;
  else { results.failed++; bugs.push({ cat, test, detail, status }); }
}

async function api(path, opts = {}) {
  const url = `https://hubspherev3.vercel.app${path}`;
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (accessToken && !opts.noAuth) headers['Authorization'] = `Bearer ${accessToken}`;
  try {
    const res = await fetch(url, { ...opts, headers, signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text.substring(0, 200); }
    return { status: res.status, data, ok: res.ok, headers: res.headers, rawText: text.substring(0, 500) };
  } catch (e) {
    return { status: 0, data: null, ok: false, error: e.message };
  }
}

// ===== PHASE 1: SYSTEM HEALTH & ENVIRONMENT =====
async function testSystemHealth() {
  console.log('\n=== PHASE 1: SYSTEM HEALTH & ENVIRONMENT ===');
  
  // Health check
  let res = await api('/api/v1/system/health');
  log('System', 'Health endpoint responds', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  if (res.ok) {
    log('System', 'DB connected in health', res.data?.data?.database === 'connected' ? 'PASS' : 'FAIL', `db=${res.data?.data?.database}`);
  }

  // Setup status
  res = await api('/api/v1/auth/setup/status', { noAuth: true });
  log('System', 'Setup status accessible', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Verify no stack traces in error responses
  res = await api('/api/v1/crm/leads', { noAuth: true });
  const hasStackTrace = res.rawText && (res.rawText.includes('at ') || res.rawText.includes('Error:') || res.rawText.includes('stack'));
  log('Security', 'No stack trace in 401 response', !hasStackTrace ? 'PASS' : 'FAIL', `hasStackTrace=${hasStackTrace}`);

  // Verify no secrets in error response
  const hasSecrets = res.rawText && (res.rawText.includes('DATABASE_URL') || res.rawText.includes('JWT_SECRET') || res.rawText.includes('password'));
  log('Security', 'No secrets in 401 response', !,hasSecrets ? 'PASS' : 'FAIL', `hasSecrets=${hasSecrets}`);
}

// ===== PHASE 2: AUTH - ADVERSARIAL =====
async function testAuthAdversarial() {
  console.log('\n=== PHASE 2: AUTH ADVERSARIAL ===');
  
  // Check if setup needed
  let res = await api('/api/v1/auth/setup/status', { noAuth: true });
  const setupComplete = res.data?.data?.setupComplete;

  if (!setupComplete) {
    // Run setup
    res = await api('/api/v1/auth/setup', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Admin', email: 'admin@test.com', password: 'TestAdmin@123!',
        confirmPassword: 'TestAdmin@123!', organizationName: 'Test Org'
      }),
      noAuth: true
    });
    log('Auth', 'Setup wizard', res.ok || res.status === 201 ? 'PASS' : 'FAIL', `status=${res.status}`);
    if (res.data?.data) {
      accessToken = res.data.data.accessToken || '';
      refreshToken = res.data.data.refreshToken || '';
    }
  }

  // Login
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@test.com', password: 'TestAdmin@123!' }),
    noAuth: true
  });
  log('Auth',-Login', res.ok ? 'PASS' : 'FAIL8', `status=${res.status+status}`);
  if (res.data?.data) {
    accessToken = res.data.data.accessToken;
    refreshToken = res.data.data.refreshToken;
  }
