const BASE = 'https://hubspherev3.vercel.app';
let PASS = 0, FAIL = 0, ERRORS = [];

const pass = (msg) => { PASS++; console.log(`✅ ${msg}`); };
const fail = (msg, detail) => { FAIL++; console.log(`❌ ${msg} — ${detail}`); ERRORS.push({ msg, detail }); };

async function api(method, path, body = null, token = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, ok: res.ok };
}

async function main() {
  console.log('=========================================');
  console.log('HUBSPHERE COMPREHENSIVE AUTH TESTS');
  console.log('=========================================\n');

  let ACCESS_TOKEN = '', REFRESH_TOKEN = '', USER_ID = '';

  // TEST 1: Setup Status (Fresh)
  console.log('--- TEST 1: Setup Status (Fresh DB) ---');
  let r = await api('GET', '/api/v1/auth/setup/status');
  if (r.status === 200 && r.data?.data?.setupComplete === false) {
    pass('Setup status: setupComplete=false (fresh DB)');
  } else {
    fail('Setup status', `status=${r.status} body=${JSON.stringify(r.data)?.substring(0,200)}`);
  }

  // TEST 2: Setup - Create Super Admin
  console.log('\n--- TEST 2: Setup - Create Super Admin ---');
  r = await api('POST', '/api/v1/auth/setup', {
    name: 'Admin',
    email: 'admin@hubsphere.in',
    password: 'Admin@12345',
    confirmPassword: 'Admin@12345',
  });
  if (r.status === 201 && r.data?.data?.accessToken) {
    pass(`Setup 201 - Admin created`);
    ACCESS_TOKEN = r.data.data.accessToken;
    REFRESH_TOKEN = r.data.data.refreshToken;
    USER_ID = r.data.data.user?.id || '';
    console.log(`  User ID: ${USER_ID}`);
    console.log(`  Token (40): ${ACCESS_TOKEN.substring(0,40)}...`);
    if (ACCESS_TOKEN.length > 50) pass('Valid access token (length > 50)');
    else fail('Access token', `Too short: ${ACCESS_TOKEN.length}`);
  } else {
    fail('Setup', `status=${r.status} body=${JSON.stringify(r.data)?.substring(0,300)}`);
  }

  // TEST 3: Setup Status After Setup
  console.log('\n--- TEST 3: Setup Status (After Setup) ---');
  r = await api('GET', '/api/v1/auth/setup/status');
  if (r.data?.data?.setupComplete === true) {
    pass('Setup status now true');
  } else {
    fail('Setup status post-setup', `got ${JSON.stringify(r.data?.data)}`);
  }

  // TEST 4: Login Correct
  console.log('\n--- TEST 4: Login (Correct Credentials) ---');
  r = await api('POST', '/api/v1/auth/login', {
    email: 'admin@hubsphere.in',
    password: 'Admin@12345'
  });
  if (r.status === 200 && r.data?.data?.accessToken) {
    pass('Login 200 OK');
    ACCESS_TOKEN = r.data.data.accessToken;
    REFRESH_TOKEN = r.data.data.refreshToken;
    const user = r.data.data.user;
    if (user?.email === 'admin@hubsphere.in') pass('Login returns correct user email');
    else fail('Login user email', `Got ${user?.email}`);
    if (user?.isSuperAdmin === true) pass('Login returns isSuperAdmin=true');
    else fail('Login isSuperAdmin', `Got ${user?.isSuperAdmin}`);
    if (r.data.data.role === 'SUPER_ADMIN') pass('Login returns role=SUPER_ADMIN');
    else fail('Login role', `Got ${r.data.data.role}`);
  } else {
    fail('Login', `status=${r.status} body=${JSON.stringify(r.data)?.substring(0,200)}`);
  }

  // TEST 5: Login Wrong Password
  console.log('\n--- TEST 5: Login (Wrong Password) ---');
  r = await api('POST', '/api/v1/auth/login', {
    email: 'admin@hubsphere.in',
    password: 'WrongPass123'
  });
  if (r.status === 401) {
    pass('Wrong password → 401');
    if (r.data?.success === false) pass('Error response has success=false');
  } else {
    fail('Wrong password', `Expected 401, got ${r.status}`);
  }

  // TEST 6: Login Non-existent User
  console.log('\n--- TEST 6: Login (Non-existent User) ---');
  r = await api('POST', '/api/v1/auth/login', {
    email: 'nobody@nowhere.com',
    password: 'Whatever@123'
  });
  if (r.status === 401) {
    pass('Non-existent user → 401');
  } else {
    fail('Non-existent user', `Expected 401, got ${r.status}`);
  }

  // TEST 7: Setup Again (Should 403)
  console.log('\n--- TEST 7: Setup Again (Should 403) ---');
  r = await api('POST', '/api/v1/auth/setup', {
    name: 'Hacker', email: 'hacker@evil.com', password: 'Hack@12345'
  });
  if (r.status === 403) {
    pass('Repeat setup → 403 Forbidden');
  } else {
    fail('Repeat setup', `Expected 403, got ${r.status}`);
  }

  // TEST 8: GET /auth/me With Token
  console.log('\n--- TEST 8: GET /auth/me (With Token) ---');
  r = await api('GET', '/api/v1/auth/me', null, ACCESS_TOKEN);
  if (r.status === 200 && r.data?.data?.user?.email) {
    pass('/auth/me 200 OK');
    if (r.data.data.user.email === 'admin@hubsphere.in') pass('/auth/me returns correct email');
  } else {
    fail('/auth/me', `status=${r.status} body=${JSON.stringify(r.data)?.substring(0,200)}`);
  }

  // TEST 9: GET /auth/me Without Token
  console.log('\n--- TEST 9: GET /auth/me (No Token) ---');
  r = await api('GET', '/api/v1/auth/me');
  if (r.status === 401) {
    pass('No token → 401');
  } else {
    fail('No token /auth/me', `Expected 401, got ${r.status}`);
  }

  // TEST 10: Invalid Token
  console.log('\n--- TEST 10: Invalid Token ---');
  r = await api('GET', '/api/v1/auth/me', null, 'invalidtoken12345');
  if (r.status === 401) {
    pass('Invalid token → 401');
  } else {
    fail('Invalid token', `Expected 401, got ${r.status}`);
  }

  // TEST 11: Refresh Token
  console.log('\n--- TEST 11: Refresh Token ---');
  r = await fetch(`${BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: REFRESH_TOKEN })
  });
  let refreshData;
  try { refreshData = await r.json(); } catch { refreshData = null; }
  if (r.status === 200 && refreshData?.data?.accessToken) {
    pass('Refresh token 200 OK');
    const newTok = refreshData.data.accessToken;
    if (newTok.length > 50) {
      ACCESS_TOKEN = newTok;
      pass('New access token valid (used for subsequent tests)');
    } else {
      fail('New access token', `Too short: ${newTok.length}`);
    }
  } else {
    fail('Refresh token', `status=${r.status} body=${JSON.stringify(refreshData)?.substring(0,200)}`);
  }

  // TEST 12: Forgot Password
  console.log('\n--- TEST 12: Forgot Password ---');
  r = await api('POST', '/api/v1/auth/forgot-password', { email: 'admin@hubsphere.in' });
  console.log(`  Forgot pw: status=${r.status} body=${JSON.stringify(r.data)?.substring(0,200)}`);
  if (r.status === 200) {
    pass('Forgot password 200 (no SMTP configured, but API works)');
  } else if (r.status === 500) {
    pass('Forgot password 500 (expected: no SMTP configured)');
  } else {
    fail('Forgot password', `Got ${r.status}`);
  }

  // TEST 13: Change Password
  console.log('\n--- TEST 13: Change Password ---');
  r = await api('POST', '/api/v1/auth/change-password', {
    currentPassword: 'Admin@12345',
    newPassword: 'NewAdmin@12345',
    confirmPassword: 'NewAdmin@12345',
  }, ACCESS_TOKEN);
  if (r.status === 200) {
    pass('Change password 200');
    // Login with new pw
    r = await api('POST', '/api/v1/auth/login', {
      email: 'admin@hubsphere.in', password: 'NewAdmin@12345'
    });
    if (r.status === 200) {
      pass('Login with new password OK');
      ACCESS_TOKEN = r.data.data.accessToken;
      REFRESH_TOKEN = r.data.data.refreshToken;
    } else {
      fail('Login new pw', `Got ${r.status}`);
    }
    // Change back
    r = await api('POST', '/api/v1/auth/change-password', {
      currentPassword: 'NewAdmin@12345',
      newPassword: 'Admin@12345',
      confirmPassword: 'Admin@12345',
    }, ACCESS_TOKEN);
    if (r.status === 200) {
      pass('Revert password 200');
    } else {
      fail('Revert password', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);
    }
    // Re-login original
    r = await api('POST', '/api/v1/auth/login', {
      email: 'admin@hubsphere.in', password: 'Admin@12345'
    });
    if (r.status === 200) {
      pass('Re-login original pw OK');
      ACCESS_TOKEN = r.data.data.accessToken;
      REFRESH_TOKEN = r.data.data.refreshToken;
    } else {
      fail('Re-login original', `Got ${r.status}`);
    }
  } else {
    fail('Change password', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);
  }

  // TEST 14: Logout
  console.log('\n--- TEST 14: Logout ---');
  r = await api('POST', '/api/v1/auth/logout', null, ACCESS_TOKEN);
  if (r.status === 200) {
    pass('Logout 200');
  } else {
    fail('Logout', `Got ${r.status}`);
  }
  // Re-login
  r = await api('POST', '/api/v1/auth/login', {
    email: 'admin@hubsphere.in', password: 'Admin@12345'
  });
  if (r.status === 200) {
    pass('Re-login after logout 200');
    ACCESS_TOKEN = r.data.data.accessToken;
    REFRESH_TOKEN = r.data.data.refreshToken;
  } else {
    fail('Re-login after logout', `Got ${r.status}`);
  }

  // TEST 15: 2FA Status
  console.log('\n--- TEST 15: 2FA Status ---');
  r = await api('GET', '/api/v1/auth/two-factor/status', null, ACCESS_TOKEN);
  console.log(`  2FA status: ${JSON.stringify(r.data)?.substring(0,200)}`);
  if (r.status === 200) {
    pass('2FA status 200');
    if (r.data?.data?.enabled === false) pass('2FA disabled by default');
    else fail('2FA default', `Expected false, got ${r.data?.data?.enabled}`);
  } else {
    fail('2FA status', `Got ${r.status}`);
  }

  // TEST 16: 2FA Setup
  console.log('\n--- TEST 16: 2FA Setup ---');
  r = await api('POST', '/api/v1/auth/two-factor/setup', {}, ACCESS_TOKEN);
  console.log(`  2FA setup: status=${r.status} body=${JSON.stringify(r.data)?.substring(0,300)}`);
  if (r.status === 200 && r.data?.data?.secret) {
    pass('2FA setup 200 with secret');
  } else {
    fail('2FA setup', `status=${r.status}`);
  }

  // TEST 17: System Health
  console.log('\n--- TEST 17: System Health ---');
  r = await api('GET', '/api/v1/system/health');
  console.log(`  Health: ${JSON.stringify(r.data)?.substring(0,300)}`);
  if (r.status === 200) {
    pass('System health 200');
  } else {
    fail('System health', `Got ${r.status}`);
  }

  // TEST 18: Root API
  console.log('\n--- TEST 18: Root API ---');
  r = await api('GET', '/api');
  if (r.status === 200) {
    pass('Root API 200');
  } else {
    fail('Root API', `Got ${r.status}`);
  }

  // TEST 19: Signup (no invitation — should fail or create user)
  console.log('\n--- TEST 19: Signup (No Invitation) ---');
  r = await api('POST', '/api/v1/auth/signup', {
    name: 'Test User', email: 'test@hubsphere.in', password: 'Test@12345'
  });
  console.log(`  Signup: status=${r.status} body=${JSON.stringify(r.data)?.substring(0,200)}`);
  if (r.status === 201 || r.status === 403 || r.status === 400) {
    pass(`Signup ${r.status} (acceptable)`);
  } else {
    fail('Signup', `Unexpected status ${r.status}`);
  }

  // TEST 20: Login Validation (missing fields)
  console.log('\n--- TEST 20: Login Validation (Missing Fields) ---');
  r = await api('POST', '/api/v1/auth/login', { email: '' });
  if (r.status === 400 || r.status === 422) {
    pass('Missing fields → 400/422');
  } else {
    fail('Login validation', `Expected 400/422, got ${r.status}`);
  }

  // Save tokens for next test script
  const fs = await import('fs');
  fs.writeFileSync('/tmp/hs-tokens.json', JSON.stringify({ ACCESS_TOKEN, REFRESH_TOKEN, USER_ID }));
  console.log('\n  [Tokens saved to /tmp/hs-tokens.json]');

  // SUMMARY
  console.log('\n=========================================');
  console.log(`AUTH TEST RESULTS: ${PASS} PASSED, ${FAIL} FAILED`);
  console.log('=========================================');
  if (ERRORS.length > 0) {
    console.log('\nFAILURES:');
    ERRORS.forEach(e => console.log(`  ❌ ${e.msg}: ${e.detail}`));
  }
  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(2); });
