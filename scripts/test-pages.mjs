const BASE = 'https://hubspherev3.vercel.app';
let PASS = 0, FAIL = 0, ERRORS = [];
const pass = (msg) => { PASS++; console.log(`✅ ${msg}`); };
const fail = (msg, detail) => { FAIL++; console.log(`❌ ${msg} — ${detail}`); ERRORS.push({ msg, detail }); };

async function checkPage(url, expectedStatus = 200) {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    const status = res.status;
    // 307/302 redirects are OK (auth redirect)
    if (status === expectedStatus || status === 307 || status === 302) {
      pass(`${url} → ${status}`);
      return true;
    } else {
      fail(url, `Expected ${expectedStatus}/307/302, got ${status}`);
      return false;
    }
  } catch (e) {
    fail(url, `Fetch error: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('=========================================');
  console.log('FRONTEND PAGE LOAD TESTS');
  console.log('=========================================\n');

  // PUBLIC PAGES (no auth needed)
  console.log('=== PUBLIC PAGES ===\n');
  await checkPage(BASE + '/');
  await checkPage(BASE + '/login');
  await checkPage(BASE + '/signup');
  await checkPage(BASE + '/setup');
  await checkPage(BASE + '/forgot-password');
  await checkPage(BASE + '/reset-password');

  // APP PAGES (will redirect to /login if not authed — 307 is OK)
  console.log('\n=== APP PAGES (expect 307 redirect) ===\n');

  // Dashboard & Main
  await checkPage(BASE + '/super-admin', 307);

  // CRM
  await checkPage(BASE + '/crm', 307);
  await checkPage(BASE + '/crm/leads', 307);
  await checkPage(BASE + '/crm/contacts', 307);
  await checkPage(BASE + '/crm/companies', 307);
  await checkPage(BASE + '/crm/deals', 307);
  await checkPage(BASE + '/crm/tasks', 307);
  await checkPage(BASE + '/crm/follow-ups', 307);
  await checkPage(BASE + '/crm/calls', 307);
  await checkPage(BASE + '/crm/telecaller', 307);
  await checkPage(BASE + '/crm/export', 307);
  await checkPage(BASE + '/crm/import', 307);

  // HRMS
  await checkPage(BASE + '/hrms', 307);
  await checkPage(BASE + '/hrms/employees', 307);
  await checkPage(BASE + '/hrms/departments', 307);
  await checkPage(BASE + '/hrms/designations', 307);
  await checkPage(BASE + '/hrms/attendance', 307);
  await checkPage(BASE + '/hrms/leave', 307);
  await checkPage(BASE + '/hrms/expenses', 307);
  await checkPage(BASE + '/hrms/payroll', 307);
  await checkPage(BASE + '/hrms/field-sales', 307);

  // Admin
  await checkPage(BASE + '/admin', 307);
  await checkPage(BASE + '/admin/users', 307);
  await checkPage(BASE + '/admin/roles', 307);
  await checkPage(BASE + '/admin/settings', 307);
  await checkPage(BASE + '/admin/memberships', 307);
  await checkPage(BASE + '/admin/audit', 307);
  await checkPage(BASE + '/admin/security', 307);
  await checkPage(BASE + '/admin/subscription', 307);

  // Super Admin
  await checkPage(BASE + '/super-admin/tenants', 307);
  await checkPage(BASE + '/super-admin/users', 307);
  await checkPage(BASE + '/super-admin/roles', 307);
  await checkPage(BASE + '/super-admin/settings', 307);
  await checkPage(BASE + '/super-admin/audit', 307);
  await checkPage(BASE + '/super-admin/health', 307);
  await checkPage(BASE + '/super-admin/features', 307);

  // Communication
  await checkPage(BASE + '/communication', 307);
  await checkPage(BASE + '/communication/inbox', 307);
  await checkPage(BASE + '/communication/notifications', 307);
  await checkPage(BASE + '/communication/templates', 307);
  await checkPage(BASE + '/communication/settings', 307);

  // Automation
  await checkPage(BASE + '/automation', 307);
  await checkPage(BASE + '/automation/workflows', 307);
  await checkPage(BASE + '/automation/executions', 307);

  // AI
  await checkPage(BASE + '/ai', 307);
  await checkPage(BASE + '/ai/chat', 307);

  // Analytics
  await checkPage(BASE + '/analytics', 307);
  await checkPage(BASE + '/analytics/crm', 307);
  await checkPage(BASE + '/analytics/hr', 307);
  await checkPage(BASE + '/analytics/executive', 307);
  await checkPage(BASE + '/analytics/telecaller', 307);
  await checkPage(BASE + '/analytics/communication', 307);
  await checkPage(BASE + '/analytics/automation', 307);
  await checkPage(BASE + '/analytics/ai', 307);

  // NON-EXISTENT PAGE (should show 404)
  console.log('\n=== 404 PAGE ===\n');
  await checkPage(BASE + '/this-does-not-exist', 404);

  // SUMMARY
  console.log('\n=========================================');
  console.log(`PAGE TESTS: ${PASS} PASSED, ${FAIL} FAILED`);
  console.log('=========================================');
  if (ERRORS.length > 0) {
    console.log('\nFAILURES:');
    ERRORS.forEach(e => console.log(`  ❌ ${e.msg}: ${e.detail}`));
  }
  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(2); });
