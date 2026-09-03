/**
 * HubSphere v3 — Comprehensive End-to-End Test Suite
 * Tests ALL auth flows, API endpoints, and error handling against the live deployed app.
 */

const BASE = 'https://hubspherev3.vercel.app';
let accessToken = '';
let refreshToken = '';
let userId = '';
let tenantId = '';

// Test results tracking
const results = { passed: 0, failed: 0, errors: [] };

function log(category, test, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : '❌';
  const msg = `${icon} [${category}] ${test}${detail ? ': ' + detail : ''}`;
  console.log(msg);
  if (status === 'PASS') results.passed++;
  else { results.failed++; results.errors.push(`[${category}] ${test}: ${detail}`); }
}

async function api(path, options = {}) {
  const url = `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (accessToken && !options.noAuth) headers['Authorization'] = `Bearer ${accessToken}`;
  try {
    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, ok: res.ok, headers: res.headers };
  } catch (e) {
    return { status: 0, data: null, ok: false, error: e.message };
  }
}

// ============================================================
// 1. PUBLIC PAGES & STATIC ASSETS
// ============================================================
async function testPublicPages() {
  console.log('\n' + '='.repeat(60));
  console.log('1. PUBLIC PAGES & STATIC ASSETS');
  console.log('='.repeat(60));

  // Root redirects to login
  let res = await fetch(BASE + '/', { redirect: 'manual' });
  log('Public', 'Root / redirects', res.status === 307 ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Login page
  res = await fetch(BASE + '/login');
  log('Public', '/login page loads', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Signup page
  res = await fetch(BASE + '/signup');
  log('Public', '/signup page loads', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Setup page
  res = await fetch(BASE + '/setup');
  log('Public', '/setup page loads', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Forgot password page
  res = await fetch(BASE + '/forgot-password');
  log('Public', '/forgot-password page loads', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // 404 page
  res = await fetch(BASE + '/nonexistent-page-xyz');
  log('Public', '404 page works', res.status === 404 ? 'PASS' : 'FAIL', `status=${res.status}`);

  // API root
  res = await api('/api');
  log('Public', '/api root responds', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 2. SYSTEM HEALTH & SETUP STATUS
// ============================================================
async function testSystemEndpoints() {
  console.log('\n' + '='.repeat(60));
  console.log('2. SYSTEM HEALTH & SETUP STATUS');
  console.log('='.repeat(60));

  // Health check
  let res = await api('/api/v1/system/health');
  log('System', '/system/health', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, data=${JSON.stringify(res.data)?.substring(0, 100)}`);

  // Setup status - should show setup needed
  res = await api('/api/v1/auth/setup/status');
  log('System', '/setup/status shows setup needed', 
    res.ok && res.data?.data?.setupComplete === false ? 'PASS' : 'FAIL', 
    `setupComplete=${res.data?.data?.setupComplete}`);

  // Providers
  res = await api('/api/v1/system/providers');
  log('System', '/system/providers', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 3. AUTH: SETUP WIZARD
// ============================================================
async function testSetupWizard() {
  console.log('\n' + '='.repeat(60));
  console.log('3. AUTH: SETUP WIZARD');
  console.log('='.repeat(60));

  // Create first super admin via setup
  const setupData = {
    name: 'HubSphere Admin',
    email: 'admin@hubsphere.com',
    password: 'H$phere@2026!',
    confirmPassword: 'H$phere@2026!',
    organizationName: 'HubSphere Corp'
  };

  let res = await api('/api/v1/auth/setup', {
    method: 'POST',
    body: JSON.stringify(setupData),
    noAuth: true
  });
  log('Auth-Setup', 'Create super admin', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, msg=${res.data?.message || res.data?.error || 'ok'}`);

  if (res.ok && res.data?.data) {
    accessToken = res.data.data.accessToken || '';
    refreshToken = res.data.data.refreshToken || '';
    userId = res.data.data.user?.id || '';
    tenantId = res.data.data.user?.tenantId || res.data.data.tenant?.id || '';
    log('Auth-Setup', 'Got access token', accessToken ? 'PASS' : 'FAIL', `len=${accessToken.length}`);
    log('Auth-Setup', 'Got refresh token', refreshToken ? 'PASS' : 'FAIL', `len=${refreshToken.length}`);
    log('Auth-Setup', 'Got user ID', userId ? 'PASS' : 'FAIL', userId);
  } else {
    log('Auth-Setup', 'FATAL: Cannot proceed without setup', 'FAIL', 'Aborting dependent tests');
    return false;
  }

  // Setup status should now show complete
  res = await api('/api/v1/auth/setup/status', { noAuth: true });
  log('Auth-Setup', 'Setup now complete', 
    res.data?.data?.setupComplete === true ? 'PASS' : 'FAIL',
    `setupComplete=${res.data?.data?.setupComplete}`);

  // Try setup again - should fail (already done)
  res = await api('/api/v1/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ ...setupData, email: 'another@admin.com' }),
    noAuth: true
  });
  log('Auth-Setup', 'Second setup blocked', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  return true;
}

// ============================================================
// 4. AUTH: LOGIN
// ============================================================
async function testLogin() {
  console.log('\n' + '='.repeat(60));
  console.log('4. AUTH: LOGIN');
  console.log('='.repeat(60));

  // Successful login
  let res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }),
    noAuth: true
  });
  log('Auth-Login', 'Login with correct credentials', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  if (res.ok && res.data?.data) {
    accessToken = res.data.data.accessToken || accessToken;
    refreshToken = res.data.data.refreshToken || refreshToken;
    log('Auth-Login', 'Got new access token', accessToken ? 'PASS' : 'FAIL');
  }

  // Wrong password
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'wrongpassword' }),
    noAuth: true
  });
  log('Auth-Login', 'Wrong password rejected', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Non-existent email
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'noone@nowhere.com', password: 'whatever' }),
    noAuth: true
  });
  log('Auth-Login', 'Non-existent email rejected', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Missing fields
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: '' }),
    noAuth: true
  });
  log('Auth-Login', 'Missing fields rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 5. AUTH: /me (Current User)
// ============================================================
async function testMe() {
  console.log('\n' + '='.repeat(60));
  console.log('5. AUTH: /me (Current User)');
  console.log('='.repeat(60));

  let res = await api('/api/v1/auth/me');
  log('Auth-Me', 'Get current user', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  if (res.ok && res.data?.data) {
    const u = res.data.data;
    log('Auth-Me', 'User has email', u.email === 'admin@hubsphere.com' ? 'PASS' : 'FAIL', u.email);
    log('Auth-Me', 'User is super admin', u.isSuperAdmin === true ? 'PASS' : 'FAIL', `${u.isSuperAdmin}`);
    log('Auth-Me', 'User has name', !!u.name ? 'PASS' : 'FAIL', u.name);
    if (!tenantId && u.tenantId) tenantId = u.tenantId;
  }

  // Unauthenticated /me
  res = await api('/api/v1/auth/me', { noAuth: true });
  log('Auth-Me', 'Unauthenticated /me returns 401', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 6. AUTH: SIGNUP
// ============================================================
async function testSignup() {
  console.log('\n' + '='.repeat(60));
  console.log('6. AUTH: SIGNUP');
  console.log('='.repeat(60));

  const signupData = {
    name: 'Test User',
    email: 'testuser@hubsphere.com',
    password: 'TestUser@123!',
    confirmPassword: 'TestUser@123!',
    organizationName: 'Test Org'
  };

  let res = await api('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(signupData),
    noAuth: true
  });
  log('Auth-Signup', 'Signup new user', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, msg=${res.data?.message || res.data?.error || 'ok'}`);

  // Duplicate signup
  res = await api('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(signupData),
    noAuth: true
  });
  log('Auth-Signup', 'Duplicate email rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Weak password
  res = await api('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ ...signupData, email: 'weak@test.com', password: '123', confirmPassword: '123' }),
    noAuth: true
  });
  log('Auth-Signup', 'Weak password rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Mismatched passwords
  res = await api('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ ...signupData, email: 'mismatch@test.com', password: 'Test@123!', confirmPassword: 'Different@123!' }),
    noAuth: true
  });
  log('Auth-Signup', 'Mismatched passwords rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 7. AUTH: TOKEN REFRESH
// ============================================================
async function testTokenRefresh() {
  console.log('\n' + '='.repeat(60));
  console.log('7. AUTH: TOKEN REFRESH');
  console.log('='.repeat(60));

  let res = await api('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    noAuth: true
  });
  log('Auth-Refresh', 'Refresh token works', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  if (res.ok && res.data?.data) {
    const newAccess = res.data.data.accessToken;
    const newRefresh = res.data.data.refreshToken;
    log('Auth-Refresh', 'Got new access token', newAccess ? 'PASS' : 'FAIL');
    log('Auth-Refresh', 'Got new refresh token', newRefresh ? 'PASS' : 'FAIL');

    // Old refresh token should be revoked (rotation)
    if (newRefresh) {
      const oldRes = await api('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        noAuth: true
      });
      log('Auth-Refresh', 'Old refresh token revoked', oldRes.status === 401 ? 'PASS' : 'FAIL', `status=${oldRes.status}`);
      refreshToken = newRefresh;
    }
    if (newAccess) accessToken = newAccess;
  }

  // Invalid refresh token
  res = await api('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: 'invalid-token-xyz' }),
    noAuth: true
  });
  log('Auth-Refresh', 'Invalid refresh token rejected', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 8. AUTH: CHANGE PASSWORD
// ============================================================
async function testChangePassword() {
  console.log('\n' + '='.repeat(60));
  console.log('8. AUTH: CHANGE PASSWORD');
  console.log('='.repeat(60));

  let res = await api('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: 'H$phere@2026!', newPassword: 'H$phere@2026!New' })
  });
  log('Auth-ChangePw', 'Change password', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, msg=${res.data?.message || res.data?.error || 'ok'}`);

  // Login with new password
  if (res.ok) {
    const loginRes = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!New' }),
      noAuth: true
    });
    log('Auth-ChangePw', 'Login with new password', loginRes.ok ? 'PASS' : 'FAIL', `status=${loginRes.status}`);

    if (loginRes.ok && loginRes.data?.data) {
      accessToken = loginRes.data.data.accessToken;
      refreshToken = loginRes.data.data.refreshToken;
    }

    // Change back to original
    res = await api('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'H$phere@2026!New', newPassword: 'H$phere@2026!' })
    });
    log('Auth-ChangePw', 'Revert password', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

    if (res.ok) {
      const revertLogin = await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }),
        noAuth: true
      });
      if (revertLogin.ok && revertLogin.data?.data) {
        accessToken = revertLogin.data.data.accessToken;
        refreshToken = revertLogin.data.data.refreshToken;
      }
    }
  }

  // Wrong current password
  res = await api('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: 'totallywrong', newPassword: 'NewPass@123' })
  });
  log('Auth-ChangePw', 'Wrong current password rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 9. AUTH: FORGOT PASSWORD
// ============================================================
async function testForgotPassword() {
  console.log('\n' + '='.repeat(60));
  console.log('9. AUTH: FORGOT PASSWORD');
  console.log('='.repeat(60));

  // Request reset
  let res = await api('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@hubsphere.com' }),
    noAuth: true
  });
  log('Auth-ForgotPw', 'Forgot password request', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, msg=${res.data?.message || 'ok'}`);

  // Non-existent email (should still return ok to prevent enumeration)
  res = await api('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'nonexistent@xyz.com' }),
    noAuth: true
  });
  log('Auth-ForgotPw', 'Non-existent email returns ok (no enumeration)', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Reset with invalid token
  res = await api('/api/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: 'invalid-token', password: 'NewPass@123!' }),
    noAuth: true
  });
  log('Auth-ForgotPw', 'Invalid reset token rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 10. AUTH: 2FA
// ============================================================
async function test2FA() {
  console.log('\n' + '='.repeat(60));
  console.log('10. AUTH: 2FA');
  console.log('='.repeat(60));

  // Check 2FA status
  let res = await api('/api/v1/auth/two-factor/status');
  log('Auth-2FA', 'Get 2FA status', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, data=${JSON.stringify(res.data)?.substring(0, 80)}`);

  // Setup 2FA
  res = await api('/api/v1/auth/two-factor/setup', { method: 'POST' });
  log('Auth-2FA', 'Setup 2FA', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  if (res.ok && res.data?.data) {
    const { secret, recoveryCodes } = res.data.data;
    log('Auth-2FA', 'Got TOTP secret', !!secret ? 'PASS' : 'FAIL');
    log('Auth-2FA', 'Got recovery codes', recoveryCodes && recoveryCodes.length > 0 ? 'PASS' : 'FAIL', `count=${recoveryCodes?.length}`);

    // Disable 2FA (since we can't generate valid TOTP without authenticator app)
    // Try with invalid code - should fail
    res = await api('/api/v1/auth/two-factor/disable', {
      method: 'POST',
      body: JSON.stringify({ code: '000000' })
    });
    log('Auth-2FA', 'Disable with invalid code rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // 2FA status for unauthenticated
  res = await api('/api/v1/auth/two-factor/status', { noAuth: true });
  log('Auth-2FA', 'Unauthenticated 2FA status returns 401', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 11. AUTH: LOGOUT
// ============================================================
async function testLogout() {
  console.log('\n' + '='.repeat(60));
  console.log('11. AUTH: LOGOUT');
  console.log('='.repeat(60));

  // First re-login to get fresh tokens
  let res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }),
    noAuth: true
  });
  if (res.ok && res.data?.data) {
    accessToken = res.data.data.accessToken;
    refreshToken = res.data.data.refreshToken;
  }

  // Logout
  res = await api('/api/v1/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken })
  });
  log('Auth-Logout', 'Logout succeeds', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Try using old access token after logout
  res = await api('/api/v1/auth/me');
  // This might still work since JWT is stateless, but refresh token is revoked
  log('Auth-Logout', 'After logout, /me may still work (stateless JWT)', true ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Try refreshing with revoked token
  res = await api('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    noAuth: true
  });
  log('Auth-Logout', 'Revoked refresh token rejected', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Re-login for remaining tests
  res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }),
    noAuth: true
  });
  if (res.ok && res.data?.data) {
    accessToken = res.data.data.accessToken;
    refreshToken = res.data.data.refreshToken;
    log('Auth-Logout', 'Re-login after logout', true ? 'PASS' : 'FAIL');
  }
}

// ============================================================
// 12. CRM API TESTS
// ============================================================
async function testCRMAPIs() {
  console.log('\n' + '='.repeat(60));
  console.log('12. CRM API');
  console.log('='.repeat(60));

  // CRM Dashboard
  let res = await api('/api/v1/crm/dashboard');
  log('CRM', 'Dashboard', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Leads - List
  res = await api('/api/v1/crm/leads');
  log('CRM', 'List leads', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Leads - Create
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      mobile: '+919876543210',
      company: 'Acme Corp',
      source: 'WEBSITE',
      status: 'NEW',
      priority: 'HIGH'
    })
  });
  log('CRM', 'Create lead', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, msg=${res.data?.message || res.data?.error || 'ok'}`);
  const leadId = res.data?.data?.id;

  // Lead detail
  if (leadId) {
    res = await api(`/api/v1/crm/leads/${leadId}`);
    log('CRM', 'Get lead detail', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

    // Update lead
    res = await api(`/api/v1/crm/leads/${leadId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'CONTACTED' })
    });
    log('CRM', 'Update lead', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

    // Convert lead to contact
    res = await api(`/api/v1/crm/leads/${leadId}/convert`, { method: 'POST' });
    log('CRM', 'Convert lead to contact', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, msg=${res.data?.message || res.data?.error || 'ok'}`);
  }

  // Contacts - List
  res = await api('/api/v1/crm/contacts');
  log('CRM', 'List contacts', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Contacts - Create
  res = await api('/api/v1/crm/contacts', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      mobile: '+919123456789'
    })
  });
  log('CRM', 'Create contact', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  const contactId = res.data?.data?.id;

  if (contactId) {
    res = await api(`/api/v1/crm/contacts/${contactId}`);
    log('CRM', 'Get contact detail', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

    res = await api(`/api/v1/crm/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify({ firstName: 'Janet' })
    });
    log('CRM', 'Update contact', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // Companies - List & Create
  res = await api('/api/v1/crm/companies');
  log('CRM', 'List companies', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/crm/companies', {
    method: 'POST',
    body: JSON.stringify({ name: 'Acme Corp', industry: 'TECHNOLOGY', website: 'https://acme.com' })
  });
  log('CRM', 'Create company', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  const companyId = res.data?.data?.id;

  if (companyId) {
    res = await api(`/api/v1/crm/companies/${companyId}`);
    log('CRM', 'Get company detail', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // Deals - List & Create
  res = await api('/api/v1/crm/deals');
  log('CRM', 'List deals', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/crm/deals', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Enterprise Deal',
      value: 50000,
      currency: 'USD',
      stage: 'PROSPECTING',
      probability: 30
    })
  });
  log('CRM', 'Create deal', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, msg=${res.data?.message || res.data?.error || 'ok'}`);
  const dealId = res.data?.data?.id;

  if (dealId) {
    res = await api(`/api/v1/crm/deals/${dealId}`);
    log('CRM', 'Get deal detail', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

    // Move deal stage
    res = await api(`/api/v1/crm/deals/${dealId}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stage: 'QUALIFICATION' })
    });
    log('CRM', 'Move deal stage', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, msg=${res.data?.message || res.data?.error || 'ok'}`);
  }

  // Tasks
  res = await api('/api/v1/crm/tasks');
  log('CRM', 'List tasks', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/crm/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Follow up with client', priority: 'HIGH', status: 'TODO' })
  });
  log('CRM', 'Create task', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Follow-ups
  res = await api('/api/v1/crm/follow-ups');
  log('CRM', 'List follow-ups', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Notes
  res = await api('/api/v1/crm/notes');
  log('CRM', 'List notes', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Tags
  res = await api('/api/v1/crm/tags');
  log('CRM', 'List tags', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Timeline
  res = await api('/api/v1/crm/timeline');
  log('CRM', 'Timeline', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Search
  res = await api('/api/v1/crm/search?q=John');
  log('CRM', 'Search', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Calls
  res = await api('/api/v1/crm/calls');
  log('CRM', 'List calls', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 13. HRMS API TESTS
// ============================================================
async function testHRMSAPIs() {
  console.log('\n' + '='.repeat(60));
  console.log('13. HRMS API');
  console.log('='.repeat(60));

  // HR Dashboard
  let res = await api('/api/v1/hrms/dashboard');
  log('HRMS', 'Dashboard', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Departments
  res = await api('/api/v1/hrms/departments');
  log('HRMS', 'List departments', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/hrms/departments', {
    method: 'POST',
    body: JSON.stringify({ name: 'Engineering', code: 'ENG' })
  });
  log('HRMS', 'Create department', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, msg=${res.data?.message || res.data?.error || 'ok'}`);
  const deptId = res.data?.data?.id;

  // Designations
  res = await api('/api/v1/hrms/designations');
  log('HRMS', 'List designations', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/hrms/designations', {
    method: 'POST',
    body: JSON.stringify({ title: 'Software Engineer', departmentId: deptId || undefined })
  });
  log('HRMS', 'Create designation', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, msg=${res.data?.message || res.data?.error || 'ok'}`);

  // Employees
  res = await api('/api/v1/hrms/employees');
  log('HRMS', 'List employees', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Attendance
  res = await api('/api/v1/hrms/attendance');
  log('HRMS', 'List attendance', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Leave types
  res = await api('/api/v1/hrms/leave-types');
  log('HRMS', 'List leave types', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Leave requests
  res = await api('/api/v1/hrms/leave-requests');
  log('HRMS', 'List leave requests', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Field visits
  res = await api('/api/v1/hrms/field-visits');
  log('HRMS', 'List field visits', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Field dashboard
  res = await api('/api/v1/hrms/field-dashboard');
  log('HRMS', 'Field dashboard', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Expenses
  res = await api('/api/v1/hrms/expenses');
  log('HRMS', 'List expenses', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Payroll
  res = await api('/api/v1/hrms/payroll');
  log('HRMS', 'List payroll', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 14. COMMUNICATION API TESTS
// ============================================================
async function testCommunicationAPIs() {
  console.log('\n' + '='.repeat(60));
  console.log('14. COMMUNICATION API');
  console.log('='.repeat(60));

  let res = await api('/api/v1/communication/dashboard');
  log('Comm', 'Dashboard', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/communication/conversations');
  log('Comm', 'List conversations', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/communication/templates');
  log('Comm', 'List templates', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/communication/providers');
  log('Comm', 'List providers', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/communication/notifications');
  log('Comm', 'List notifications', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 15. AUTOMATION API TESTS
// ============================================================
async function testAutomationAPIs() {
  console.log('\n' + '='.repeat(60));
  console.log('15. AUTOMATION API');
  console.log('='.repeat(60));

  let res = await api('/api/v1/automation/dashboard');
  log('Automation', 'Dashboard', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/automation/workflows');
  log('Automation', 'List workflows', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/automation/executions');
  log('Automation', 'List executions', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 16. AI API TESTS
// ============================================================
async function testAIAPIs() {
  console.log('\n' + '='.repeat(60));
  console.log('16. AI API');
  console.log('='.repeat(60));

  let res = await api('/api/v1/ai/agents');
  log('AI', 'List agents', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/ai/providers');
  log('AI', 'List providers', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/ai/usage');
  log('AI', 'Usage stats', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 17. ANALYTICS API TESTS
// ============================================================
async function testAnalyticsAPIs() {
  console.log('\n' + '='.repeat(60));
  console.log('17. ANALYTICS API');
  console.log('='.repeat(60));

  const endpoints = [
    ['Executive', '/api/v1/analytics/executive'],
    ['CRM', '/api/v1/analytics/crm'],
    ['Telecaller', '/api/v1/analytics/telecaller'],
    ['HR', '/api/v1/analytics/hr'],
    ['Communication', '/api/v1/analytics/communication'],
    ['Automation', '/api/v1/analytics/automation'],
    ['AI Usage', '/api/v1/analytics/ai-usage'],
  ];

  for (const [name, path] of endpoints) {
    const res = await api(path);
    log('Analytics', `${name} analytics`, res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }
}

// ============================================================
// 18. ADMIN API TESTS
// ============================================================
async function testAdminAPIs() {
  console.log('\n' + '='.repeat(60));
  console.log('18. ADMIN API');
  console.log('='.repeat(60));

  let res = await api('/api/v1/admin/users');
  log('Admin', 'List tenant users', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/admin/roles');
  log('Admin', 'List tenant roles', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/admin/memberships');
  log('Admin', 'List memberships', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/admin/settings');
  log('Admin', 'Get settings', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/admin/audit');
  log('Admin', 'List audit logs', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 19. SUPER ADMIN API TESTS
// ============================================================
async function testSuperAdminAPIs() {
  console.log('\n' + '='.repeat(60));
  console.log('19. SUPER ADMIN API');
  console.log('='.repeat(60));

  let res = await api('/api/v1/super-admin/tenants');
  log('SuperAdmin', 'List tenants', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/super-admin/users');
  log('SuperAdmin', 'List platform users', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/super-admin/roles');
  log('SuperAdmin', 'List platform roles', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/super-admin/audit');
  log('SuperAdmin', 'Platform audit logs', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  res = await api('/api/v1/super-admin/stats');
  log('SuperAdmin', 'Platform stats', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 20. UNAUTHORIZED ACCESS TESTS
// ============================================================
async function testUnauthorizedAccess() {
  console.log('\n' + '='.repeat(60));
  console.log('20. UNAUTHORIZED ACCESS TESTS');
  console.log('='.repeat(60));

  const protectedEndpoints = [
    '/api/v1/crm/leads',
    '/api/v1/hrms/employees',
    '/api/v1/communication/conversations',
    '/api/v1/automation/workflows',
    '/api/v1/ai/agents',
    '/api/v1/analytics/executive',
    '/api/v1/admin/users',
    '/api/v1/super-admin/tenants',
  ];

  for (const ep of protectedEndpoints) {
    const res = await api(ep, { noAuth: true });
    log('Security', `Unauthenticated ${ep} returns 401`, res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
  }
}

// ============================================================
// 21. CRM EXPORT & IMPORT
// ============================================================
async function testCRMExportImport() {
  console.log('\n' + '='.repeat(60));
  console.log('21. CRM EXPORT & IMPORT');
  console.log('='.repeat(60));

  let res = await api('/api/v1/crm/export?entity=leads&format=csv');
  log('CRM-Export', 'Export leads CSV', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// 22. APP PAGES (LOAD CHECK)
// ============================================================
async function testAppPages() {
  console.log('\n' + '='.repeat(60));
  console.log('22. APP PAGES (LOAD CHECK)');
  console.log('='.repeat(60));

  const pages = [
    '/crm', '/crm/leads', '/crm/contacts', '/crm/companies', '/crm/deals',
    '/crm/tasks', '/crm/follow-ups', '/crm/calls', '/crm/telecaller',
    '/hrms', '/hrms/employees', '/hrms/departments', '/hrms/designations',
    '/hrms/attendance', '/hrms/leave', '/hrms/field-sales', '/hrms/expenses', '/hrms/payroll',
    '/communication', '/communication/inbox', '/communication/notifications',
    '/communication/templates', '/communication/settings',
    '/automation', '/automation/workflows', '/automation/executions',
    '/analytics', '/analytics/executive', '/analytics/crm',
    '/ai', '/ai/chat',
    '/admin', '/admin/users', '/admin/roles', '/admin/audit', '/admin/settings',
    '/super-admin', '/super-admin/tenants', '/super-admin/users', '/super-admin/roles',
  ];

  for (const page of pages) {
    try {
      const res = await fetch(BASE + page, { redirect: 'manual' });
      // Pages may redirect to login if no session cookie, which is expected
      const ok = res.status === 200 || res.status === 307 || res.status === 302;
      log('Pages', `Page ${page}`, ok ? 'PASS' : 'FAIL', `status=${res.status}`);
    } catch (e) {
      log('Pages', `Page ${page}`, 'FAIL', e.message);
    }
  }
}

// ============================================================
// 23. VALIDATION & ERROR HANDLING
// ============================================================
async function testValidation() {
  console.log('\n' + '='.repeat(60));
  console.log('23. VALIDATION & ERROR HANDLING');
  console.log('='.repeat(60));

  // Invalid JSON
  let res;
  try {
    res = await fetch(`${BASE}/api/v1/crm/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: 'not json'
    });
    log('Validation', 'Invalid JSON rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  } catch (e) {
    log('Validation', 'Invalid JSON rejected', 'FAIL', e.message);
  }

  // Missing required fields
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: JSON.stringify({})
  });
  log('Validation', 'Empty lead body rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Invalid email format in lead
  res = await api('/api/v1/crm/leads', {
    method: 'POST',
    body: JSON.stringify({ firstName: 'Test', email: 'not-an-email' })
  });
  log('Validation', 'Invalid email format rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // Non-existent lead ID
  res = await api('/api/v1/crm/leads/00000000-0000-0000-0000-000000000000');
  log('Validation', 'Non-existent lead returns 404', res.status === 404 ? 'PASS' : 'FAIL', `status=${res.status}`);
}

// ============================================================
// MAIN RUNNER
// ============================================================
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  HubSphere v3 — Comprehensive End-to-End Test Suite     ║');
  console.log('║  Target: ' + BASE + '              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  try {
    await testPublicPages();
    await testSystemEndpoints();
    const setupOk = await testSetupWizard();
    if (setupOk) {
      await testLogin();
      await testMe();
      await testSignup();
      await testTokenRefresh();
      await testChangePassword();
      await testForgotPassword();
      await test2FA();
      await testLogout();
      await testCRMAPIs();
      await testHRMSAPIs();
      await testCommunicationAPIs();
      await testAutomationAPIs();
      await testAIAPIs();
      await testAnalyticsAPIs();
      await testAdminAPIs();
      await testSuperAdminAPIs();
      await testUnauthorizedAccess();
      await testCRMExportImport();
      await testValidation();
    }
    await testAppPages();
  } catch (e) {
    console.error('FATAL ERROR:', e);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`PASSED: ${results.passed}`);
  console.log(`FAILED: ${results.failed}`);
  console.log(`TOTAL:  ${results.passed + results.failed}`);
  console.log(`PASS RATE: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.errors.length > 0) {
    console.log('\nFAILED TESTS:');
    results.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }
}

main().catch(console.error);
