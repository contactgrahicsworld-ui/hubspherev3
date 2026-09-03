const BASE = 'https://hubspherev3.vercel.app';
let PASS = 0, FAIL = 0, ERRORS = [];
const pass = (msg) => { PASS++; console.log(`✅ ${msg}`); };
const fail = (msg, detail) => { FAIL++; console.log(`❌ ${msg} — ${detail}`); ERRORS.push({ msg, detail }); };

async function api(method, path, body = null, token = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, ok: res.ok };
}

async function main() {
  // Load tokens from auth test
  let tokens;
  try {
    const fs = await import('fs');
    tokens = JSON.parse(fs.readFileSync('/tmp/hs-tokens.json', 'utf8'));
  } catch {
    console.error('No tokens found. Run test-auth.mjs first.');
    process.exit(1);
  }
  let T = tokens.ACCESS_TOKEN;

  console.log('=========================================');
  console.log('HUBSPHERE FULL API TEST SUITE');
  console.log('=========================================\n');

  // ======================
  // CRM MODULE TESTS
  // ======================
  console.log('=== CRM MODULE ===\n');

  // Dashboard
  let r = await api('GET', '/api/v1/crm/dashboard', null, T);
  if (r.status === 200) { pass('CRM Dashboard 200'); console.log('  Data keys:', Object.keys(r.data?.data || {}).join(', ')); }
  else fail('CRM Dashboard', `Got ${r.status}`);

  // Create Lead
  r = await api('POST', '/api/v1/crm/leads', {
    firstName: 'John', lastName: 'Doe', email: 'john@test.com',
    phone: '+919876543210', company: 'Test Corp', status: 'NEW', source: 'WEBSITE'
  }, T);
  let LEAD_ID = '';
  if (r.status === 201) {
    pass('Create Lead 201');
    LEAD_ID = r.data?.data?.id || '';
    console.log(`  Lead ID: ${LEAD_ID}`);
  } else {
    fail('Create Lead', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);
  }

  // List Leads
  r = await api('GET', '/api/v1/crm/leads', null, T);
  if (r.status === 200) {
    pass('List Leads 200');
    const count = r.data?.data?.length || r.data?.data?.items?.length || 0;
    console.log(`  Leads count: ${count}`);
    if (count > 0) pass('Leads list has data');
    else fail('Leads data', 'Empty list');
  } else fail('List Leads', `Got ${r.status}`);

  // Get Lead Detail
  if (LEAD_ID) {
    r = await api('GET', `/api/v1/crm/leads/${LEAD_ID}`, null, T);
    if (r.status === 200) { pass('Get Lead Detail 200'); }
    else fail('Get Lead Detail', `Got ${r.status}`);

    // Update Lead
    r = await api('PUT', `/api/v1/crm/leads/${LEAD_ID}`, { firstName: 'John Updated', status: 'CONTACTED' }, T);
    if (r.status === 200) { pass('Update Lead 200'); }
    else fail('Update Lead', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

    // Convert Lead to Contact
    r = await api('POST', `/api/v1/crm/leads/${LEAD_ID}/convert`, {}, T);
    if (r.status === 200 || r.status === 201) { pass('Convert Lead 200/201'); }
    else fail('Convert Lead', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);
  }

  // Create Contact
  r = await api('POST', '/api/v1/crm/contacts', {
    firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com', phone: '+919876543211'
  }, T);
  let CONTACT_ID = '';
  if (r.status === 201) { pass('Create Contact 201'); CONTACT_ID = r.data?.data?.id || ''; }
  else fail('Create Contact', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

  // List Contacts
  r = await api('GET', '/api/v1/crm/contacts', null, T);
  if (r.status === 200) { pass('List Contacts 200'); }
  else fail('List Contacts', `Got ${r.status}`);

  // Create Company
  r = await api('POST', '/api/v1/crm/companies', {
    name: 'Test Company Inc', industry: 'Technology', website: 'https://test.com'
  }, T);
  let COMPANY_ID = '';
  if (r.status === 201) { pass('Create Company 201'); COMPANY_ID = r.data?.data?.id || ''; }
  else fail('Create Company', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

  // List Companies
  r = await api('GET', '/api/v1/crm/companies', null, T);
  if (r.status === 200) { pass('List Companies 200'); }
  else fail('List Companies', `Got ${r.status}`);

  // Create Deal
  r = await api('POST', '/api/v1/crm/deals', {
    title: 'Test Deal', value: 50000, stage: 'NEW', contactId: CONTACT_ID, companyId: COMPANY_ID
  }, T);
  let DEAL_ID = '';
  if (r.status === 201) { pass('Create Deal 201'); DEAL_ID = r.data?.data?.id || ''; }
  else fail('Create Deal', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

  // List Deals
  r = await api('GET', '/api/v1/crm/deals', null, T);
  if (r.status === 200) { pass('List Deals 200'); }
  else fail('List Deals', `Got ${r.status}`);

  // Create Task
  r = await api('POST', '/api/v1/crm/tasks', {
    title: 'Follow up with John', description: 'Call and discuss proposal', priority: 'HIGH', status: 'TODO'
  }, T);
  let TASK_ID = '';
  if (r.status === 201) { pass('Create Task 201'); TASK_ID = r.data?.data?.id || ''; }
  else fail('Create Task', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

  // List Tasks
  r = await api('GET', '/api/v1/crm/tasks', null, T);
  if (r.status === 200) { pass('List Tasks 200'); }
  else fail('List Tasks', `Got ${r.status}`);

  // Create Note
  r = await api('POST', '/api/v1/crm/notes', {
    content: 'Meeting notes from client call', entityType: 'LEAD', entityId: LEAD_ID
  }, T);
  let NOTE_ID = '';
  if (r.status === 201) { pass('Create Note 201'); NOTE_ID = r.data?.data?.id || ''; }
  else fail('Create Note', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

  // Create Follow-Up
  r = await api('POST', '/api/v1/crm/follow-ups', {
    title: 'Follow up call', dueDate: '2026-09-10T10:00:00Z', priority: 'MEDIUM'
  }, T);
  if (r.status === 201) { pass('Create Follow-Up 201'); }
  else fail('Create Follow-Up', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

  // List Follow-Ups
  r = await api('GET', '/api/v1/crm/follow-ups', null, T);
  if (r.status === 200) { pass('List Follow-Ups 200'); }
  else fail('List Follow-Ups', `Got ${r.status}`);

  // CRM Search
  r = await api('GET', '/api/v1/crm/search?q=John', null, T);
  if (r.status === 200) { pass('CRM Search 200'); }
  else fail('CRM Search', `Got ${r.status}`);

  // CRM Timeline
  r = await api('GET', '/api/v1/crm/timeline', null, T);
  if (r.status === 200) { pass('CRM Timeline 200'); }
  else fail('CRM Timeline', `Got ${r.status}`);

  // Tags
  r = await api('GET', '/api/v1/crm/tags', null, T);
  if (r.status === 200) { pass('Tags 200'); }
  else fail('Tags', `Got ${r.status}`);

  r = await api('POST', '/api/v1/crm/tags', { name: 'VIP', color: '#FF0000' }, T);
  if (r.status === 201) { pass('Create Tag 201'); }
  else fail('Create Tag', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

  // Calls list
  r = await api('GET', '/api/v1/crm/calls', null, T);
  if (r.status === 200) { pass('List Calls 200'); }
  else fail('List Calls', `Got ${r.status}`);

  // ======================
  // HRMS MODULE TESTS
  // ======================
  console.log('\n=== HRMS MODULE ===\n');

  // HR Dashboard
  r = await api('GET', '/api/v1/hrms/dashboard', null, T);
  if (r.status === 200) { pass('HRMS Dashboard 200'); console.log('  Keys:', Object.keys(r.data?.data || {}).join(', ')); }
  else fail('HRMS Dashboard', `Got ${r.status}`);

  // Create Department
  r = await api('POST', '/api/v1/hrms/departments', { name: 'Engineering', description: 'Tech team' }, T);
  let DEPT_ID = '';
  if (r.status === 201) { pass('Create Department 201'); DEPT_ID = r.data?.data?.id || ''; }
  else fail('Create Department', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

  // List Departments
  r = await api('GET', '/api/v1/hrms/departments', null, T);
  if (r.status === 200) { pass('List Departments 200'); }
  else fail('List Departments', `Got ${r.status}`);

  // Create Designation
  r = await api('POST', '/api/v1/hrms/designations', { name: 'Senior Developer', departmentId: DEPT_ID }, T);
  if (r.status === 201) { pass('Create Designation 201'); }
  else fail('Create Designation', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

  // List Designations
  r = await api('GET', '/api/v1/hrms/designations', null, T);
  if (r.status === 200) { pass('List Designations 200'); }
  else fail('List Designations', `Got ${r.status}`);

  // Create Employee
  r = await api('POST', '/api/v1/hrms/employees', {
    firstName: 'Rahul', lastName: 'Kumar', email: 'rahul@hubsphere.in',
    phone: '+919988776655', departmentId: DEPT_ID, dateOfJoining: '2026-01-15',
    employmentStatus: 'ACTIVE'
  }, T);
  let EMP_ID = '';
  if (r.status === 201) { pass('Create Employee 201'); EMP_ID = r.data?.data?.id || ''; }
  else fail('Create Employee', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

  // List Employees
  r = await api('GET', '/api/v1/hrms/employees', null, T);
  if (r.status === 200) { pass('List Employees 200'); }
  else fail('List Employees', `Got ${r.status}`);

  // Leave Types
  r = await api('GET', '/api/v1/hrms/leave-types', null, T);
  if (r.status === 200) { pass('Leave Types 200'); }
  else fail('Leave Types', `Got ${r.status}`);

  r = await api('POST', '/api/v1/hrms/leave-types', { name: 'Casual Leave', code: 'CASUAL', daysPerYear: 12 }, T);
  if (r.status === 201) { pass('Create Leave Type 201'); }
  else fail('Create Leave Type', `Got ${r.status}: ${JSON.stringify(r.data)?.substring(0,200)}`);

  // Leave Requests
  r = await api('GET', '/api/v1/hrms/leave-requests', null, T);
  if (r.status === 200) { pass('Leave Requests 200'); }
  else fail('Leave Requests', `Got ${r.status}`);

  // Attendance
  r = await api('GET', '/api/v1/hrms/attendance', null, T);
  if (r.status === 200) { pass('Attendance 200'); }
  else fail('Attendance', `Got ${r.status}`);

  // Expenses
  r = await api('GET', '/api/v1/hrms/expenses', null, T);
  if (r.status === 200) { pass('Expenses 200'); }
  else fail('Expenses', `Got ${r.status}`);

  // Field Visits
  r = await api('GET', '/api/v1/hrms/field-visits', null, T);
  if (r.status === 200) { pass('Field Visits 200'); }
  else fail('Field Visits', `Got ${r.status}`);

  // Payroll
  r = await api('GET', '/api/v1/hrms/payroll', null, T);
  if (r.status === 200) { pass('Payroll 200'); }
  else fail('Payroll', `Got ${r.status}`);

  // Field Dashboard
  r = await api('GET', '/api/v1/hrms/field-dashboard', null, T);
  if (r.status === 200) { pass('Field Dashboard 200'); }
  else fail('Field Dashboard', `Got ${r.status}`);

  // ======================
  // ADMIN MODULE TESTS
  // ======================
  console.log('\n=== ADMIN MODULE ===\n');

  // Admin Users
  r = await api('GET', '/api/v1/admin/users', null, T);
  if (r.status === 200) { pass('Admin Users 200'); }
  else fail('Admin Users', `Got ${r.status}`);

  // Admin Roles
  r = await api('GET', '/api/v1/admin/roles', null, T);
  if (r.status === 200) { pass('Admin Roles 200'); }
  else fail('Admin Roles', `Got ${r.status}`);

  // Admin Settings
  r = await api('GET', '/api/v1/admin/settings', null, T);
  if (r.status === 200) { pass('Admin Settings 200'); }
  else fail('Admin Settings', `Got ${r.status}`);

  // Admin Memberships
  r = await api('GET', '/api/v1/admin/memberships', null, T);
  if (r.status === 200) { pass('Admin Memberships 200'); }
  else fail('Admin Memberships', `Got ${r.status}`);

  // Admin Audit
  r = await api('GET', '/api/v1/admin/audit', null, T);
  if (r.status === 200) { pass('Admin Audit 200'); }
  else fail('Admin Audit', `Got ${r.status}`);

  // ======================
  // SUPER ADMIN MODULE TESTS
  // ======================
  console.log('\n=== SUPER ADMIN MODULE ===\n');

  r = await api('GET', '/api/v1/super-admin/stats', null, T);
  if (r.status === 200) { pass('Super Admin Stats 200'); }
  else fail('Super Admin Stats', `Got ${r.status}`);

  r = await api('GET', '/api/v1/super-admin/tenants', null, T);
  if (r.status === 200) { pass('Super Admin Tenants 200'); }
  else fail('Super Admin Tenants', `Got ${r.status}`);

  r = await api('GET', '/api/v1/super-admin/users', null, T);
  if (r.status === 200) { pass('Super Admin Users 200'); }
  else fail('Super Admin Users', `Got ${r.status}`);

  r = await api('GET', '/api/v1/super-admin/roles', null, T);
  if (r.status === 200) { pass('Super Admin Roles 200'); }
  else fail('Super Admin Roles', `Got ${r.status}`);

  r = await api('GET', '/api/v1/super-admin/audit', null, T);
  if (r.status === 200) { pass('Super Admin Audit 200'); }
  else fail('Super Admin Audit', `Got ${r.status}`);

  // ======================
  // ANALYTICS MODULE TESTS
  // ======================
  console.log('\n=== ANALYTICS MODULE ===\n');

  const analyticsEndpoints = [
    '/api/v1/analytics/crm',
    '/api/v1/analytics/hr',
    '/api/v1/analytics/executive',
    '/api/v1/analytics/telecaller',
    '/api/v1/analytics/communication',
    '/api/v1/analytics/automation',
    '/api/v1/analytics/ai-usage',
    '/api/v1/analytics/report',
  ];
  for (const ep of analyticsEndpoints) {
    r = await api('GET', ep, null, T);
    if (r.status === 200) { pass(`${ep} 200`); }
    else fail(ep, `Got ${r.status}`);
  }

  // ======================
  // AUTOMATION MODULE TESTS
  // ======================
  console.log('\n=== AUTOMATION MODULE ===\n');

  r = await api('GET', '/api/v1/automation/dashboard', null, T);
  if (r.status === 200) { pass('Automation Dashboard 200'); }
  else fail('Automation Dashboard', `Got ${r.status}`);

  r = await api('GET', '/api/v1/automation/workflows', null, T);
  if (r.status === 200) { pass('List Workflows 200'); }
  else fail('List Workflows', `Got ${r.status}`);

  r = await api('GET', '/api/v1/automation/executions', null, T);
  if (r.status === 200) { pass('List Executions 200'); }
  else fail('List Executions', `Got ${r.status}`);

  r = await api('GET', '/api/v1/automation/events', null, T);
  // Events is POST only, GET should fail or return empty
  console.log(`  Events GET: ${r.status} (may not support GET)`);

  // ======================
  // COMMUNICATION MODULE TESTS
  // ======================
  console.log('\n=== COMMUNICATION MODULE ===\n');

  r = await api('GET', '/api/v1/communication/dashboard', null, T);
  if (r.status === 200) { pass('Communication Dashboard 200'); }
  else fail('Communication Dashboard', `Got ${r.status}`);

  r = await api('GET', '/api/v1/communication/conversations', null, T);
  if (r.status === 200) { pass('List Conversations 200'); }
  else fail('List Conversations', `Got ${r.status}`);

  r = await api('GET', '/api/v1/communication/notifications', null, T);
  if (r.status === 200) { pass('List Notifications 200'); }
  else fail('List Notifications', `Got ${r.status}`);

  r = await api('GET', '/api/v1/communication/templates', null, T);
  if (r.status === 200) { pass('List Templates 200'); }
  else fail('List Templates', `Got ${r.status}`);

  r = await api('GET', '/api/v1/communication/providers', null, T);
  if (r.status === 200) { pass('List Providers 200'); }
  else fail('List Providers', `Got ${r.status}`);

  // ======================
  // AI MODULE TESTS
  // ======================
  console.log('\n=== AI MODULE ===\n');

  r = await api('GET', '/api/v1/ai/agents', null, T);
  if (r.status === 200) { pass('AI Agents 200'); }
  else fail('AI Agents', `Got ${r.status}`);

  r = await api('GET', '/api/v1/ai/providers', null, T);
  if (r.status === 200) { pass('AI Providers 200'); }
  else fail('AI Providers', `Got ${r.status}`);

  r = await api('GET', '/api/v1/ai/usage', null, T);
  if (r.status === 200) { pass('AI Usage 200'); }
  else fail('AI Usage', `Got ${r.status}`);

  // ======================
  // SYSTEM TESTS
  // ======================
  console.log('\n=== SYSTEM ===\n');

  r = await api('GET', '/api/v1/system/providers', null, T);
  if (r.status === 200) { pass('System Providers 200'); }
  else fail('System Providers', `Got ${r.status}`);

  // ======================
  // UNAUTHORIZED ACCESS TESTS
  // ======================
  console.log('\n=== SECURITY: UNAUTHORIZED ACCESS ===\n');

  const protectedEndpoints = [
    '/api/v1/crm/dashboard', '/api/v1/crm/leads', '/api/v1/crm/contacts',
    '/api/v1/hrms/dashboard', '/api/v1/hrms/employees',
    '/api/v1/admin/users', '/api/v1/admin/roles',
    '/api/v1/super-admin/stats', '/api/v1/super-admin/tenants',
    '/api/v1/automation/workflows', '/api/v1/communication/conversations',
    '/api/v1/analytics/crm', '/api/v1/ai/agents',
  ];
  for (const ep of protectedEndpoints) {
    r = await api('GET', ep);
    if (r.status === 401) { pass(`Unauthorized ${ep} → 401`); }
    else fail(`Unauthorized ${ep}`, `Expected 401, got ${r.status}`);
  }

  // ======================
  // SUMMARY
  // ======================
  console.log('\n=========================================');
  console.log(`ALL API TESTS: ${PASS} PASSED, ${FAIL} FAILED`);
  console.log('=========================================');
  if (ERRORS.length > 0) {
    console.log('\nFAILURES:');
    ERRORS.forEach(e => console.log(`  ❌ ${e.msg}: ${e.detail}`));
  }
  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(2); });
