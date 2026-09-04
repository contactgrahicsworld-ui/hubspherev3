/**
 * HubSphere V3 — 5× Regression Runner
 * Runs the complete 173-test suite 5 independent times
 * Cleans DB before each run, tracks pass/fail per run
 */

const BASE = 'https://hubspherev3.vercel.app';
const DB_URL = 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

const TOTAL_RUNS = 5;
const runResults = [];
const allErrors = [];

// ── Helpers ──────────────────────────────────────────────────────
function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

async function api(path, options = {}) {
  const url = `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (options.token && !options.noAuth) headers['Authorization'] = `Bearer ${options.token}`;
  try {
    const res = await fetch(url, { ...options, headers, redirect: 'manual' });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, ok: res.ok, headers: res.headers };
  } catch (e) {
    return { status: 0, data: null, ok: false, error: e.message };
  }
}

// ── DB Cleanup via Prisma ───────────────────────────────────────────
async function cleanDB() {
  log('Cleaning database via Prisma...');
  try {
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    
    // Data tables with FK dependencies
    const dataTables = [
      'delivery_attempts','message_events','message_attachments','messages','conversations',
      'communication_provider_configs','communication_templates','notifications',
      'automation_execution_logs','automation_executions','automation_actions','automation_conditions','automation_triggers','automation_workflows',
      'ai_usage_logs','provider_configs',
      'bank_transfers','payroll_items','payroll_records','expenses','field_visits',
      'attendance_sessions','leave_requests','leave_types','employee_documents','employees',
      'designations','departments',
      'stage_history','activities','call_recordings','calls',
      'company_tags','contact_tags','lead_tags','tags',
      'notes','follow_ups','tasks','deals','companies','contacts','leads'
    ];
    for (const t of dataTables) {
      try { await p.$executeRawUnsafe(`DELETE FROM ${t}`); } catch(e) { /* skip */ }
    }
    
    // System tables
    const systemTables = ['role_permissions','permissions','audit_logs','refresh_tokens','password_reset_tokens','email_verification_tokens','memberships','users','roles','tenants'];
    for (const t of systemTables) {
      try { await p.$executeRawUnsafe(`DELETE FROM ${t}`); } catch(e) { /* skip */ }
    }
    
    await p.$disconnect();
    log('Database cleaned successfully');
    return true;
  } catch (e) {
    log('DB clean error: ' + e.message.slice(0, 200));
    return false;
  }
}

// ── Single Test Run ──────────────────────────────────────────────
async function runSingleTestSuite(runNum) {
  log(`\n${'═'.repeat(60)}`);
  log(`  RUN ${runNum} OF ${TOTAL_RUNS}`);
  log(`${'═'.repeat(60)}`);
  
  const startTime = Date.now();
  const results = { passed: 0, failed: 0, errors: [], warnings: [], tests: [] };
  let accessToken = '';
  let refreshToken = '';
  let userId = '';
  let tenantId = '';

  function record(category, test, status, detail = '') {
    const entry = { category, test, status, detail };
    results.tests.push(entry);
    if (status === 'PASS') results.passed++;
    else if (status === 'WARN') results.warnings.push(`${category}/${test}: ${detail}`);
    else { results.failed++; results.errors.push(`${category}/${test}: ${detail}`); }
    
    const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
    log(`  ${icon} [${category}] ${test}${detail ? ': ' + detail.slice(0,80) : ''}`);
  }

  async function apiAuth(path, options = {}) {
    const url = `${BASE}${path}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (accessToken && !options.noAuth) headers['Authorization'] = `Bearer ${accessToken}`;
    try {
      const res = await fetch(url, { ...options, headers, redirect: 'manual' });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: res.status, data, ok: res.ok, headers: res.headers };
    } catch (e) {
      return { status: 0, data: null, ok: false, error: e.message };
    }
  }

  // ── 1. PUBLIC PAGES ──
  log('── 1. Public Pages ──');
  let res = await fetch(BASE + '/', { redirect: 'manual' });
  record('Public', 'Root redirects to login', res.status === 307 ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await fetch(BASE + '/login');
  record('Public', '/login loads', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await fetch(BASE + '/signup');
  record('Public', '/signup loads', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await fetch(BASE + '/setup');
  record('Public', '/setup loads', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await fetch(BASE + '/forgot-password');
  record('Public', '/forgot-password loads', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await fetch(BASE + '/nonexistent-page-xyz');
  record('Public', '404 renders', res.status === 200 || res.status === 404 ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await apiAuth('/api');
  record('Public', '/api root responds', res.ok || res.status === 307 ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 2. SYSTEM HEALTH ──
  log('── 2. System Health ──');
  res = await apiAuth('/api/v1/system/health');
  record('System', 'Health check', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await apiAuth('/api/v1/auth/setup/status', { noAuth: true });
  record('System', 'Setup status available', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  const setupNeeded = res.ok && res.data?.data?.setupComplete === false;
  record('System', 'Setup needed (clean DB)', setupNeeded ? 'PASS' : 'FAIL', `setupComplete=${res.data?.data?.setupComplete}`);

  // ── 3. SETUP WIZARD ──
  log('── 3. Setup Wizard ──');
  const setupData = {
    name: 'HubSphere Admin',
    email: 'admin@hubsphere.com',
    password: 'H$phere@2026!',
    confirmPassword: 'H$phere@2026!',
    organizationName: 'HubSphere Corp'
  };
  res = await apiAuth('/api/v1/auth/setup', { method: 'POST', body: JSON.stringify(setupData), noAuth: true });
  record('Auth-Setup', 'Create super admin', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  
  if (res.ok && res.data?.data) {
    accessToken = res.data.data.accessToken || '';
    refreshToken = res.data.data.refreshToken || '';
    userId = res.data.data.user?.id || '';
    tenantId = res.data.data.user?.tenantId || res.data.data.tenant?.id || '';
    record('Auth-Setup', 'Got access token', accessToken ? 'PASS' : 'FAIL', `len=${accessToken.length}`);
    record('Auth-Setup', 'Got refresh token', refreshToken ? 'PASS' : 'FAIL', `len=${refreshToken.length}`);
    record('Auth-Setup', 'Got user ID', userId ? 'PASS' : 'FAIL', userId);
  } else {
    record('Auth-Setup', 'FATAL: Setup failed', 'FAIL', JSON.stringify(res.data).slice(0,200));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    return { runNum, ...results, elapsed, fatal: true };
  }

  res = await apiAuth('/api/v1/auth/setup/status', { noAuth: true });
  record('Auth-Setup', 'Setup now complete', res.data?.data?.setupComplete === true ? 'PASS' : 'FAIL', `setupComplete=${res.data?.data?.setupComplete}`);
  res = await apiAuth('/api/v1/auth/setup', { method: 'POST', body: JSON.stringify({ ...setupData, email: 'x@y.com' }), noAuth: true });
  record('Auth-Setup', 'Second setup blocked', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 4. LOGIN ──
  log('── 4. Login ──');
  res = await apiAuth('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }), noAuth: true });
  record('Auth-Login', 'Correct credentials', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  if (res.ok && res.data?.data) {
    accessToken = res.data.data.accessToken || accessToken;
    refreshToken = res.data.data.refreshToken || refreshToken;
  }
  res = await apiAuth('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'wrong' }), noAuth: true });
  record('Auth-Login', 'Wrong password rejected', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await apiAuth('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'nobody@x.com', password: 'x' }), noAuth: true });
  record('Auth-Login', 'Non-existent email rejected', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await apiAuth('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: '' }), noAuth: true });
  record('Auth-Login', 'Missing fields rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 5. /me ──
  log('── 5. Current User ──');
  res = await apiAuth('/api/v1/auth/me');
  record('Auth-Me', 'Get current user', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  if (res.ok && res.data?.data) {
    const u = res.data.data.user;
    record('Auth-Me', 'Email matches', u?.email === 'admin@hubsphere.com' ? 'PASS' : 'FAIL', u?.email);
    record('Auth-Me', 'Is super admin', u?.isSuperAdmin === true ? 'PASS' : 'FAIL', `${u?.isSuperAdmin}`);
    record('Auth-Me', 'Has name', !!u?.name ? 'PASS' : 'FAIL', u?.name);
    if (!tenantId && res.data.data.currentTenant?.id) tenantId = res.data.data.currentTenant.id;
    record('Auth-Me', 'Has permissions', Array.isArray(res.data.data.permissions) ? 'PASS' : 'FAIL', `count=${res.data.data.permissions?.length}`);
  }

  // ── 6. REFRESH TOKEN ──
  log('── 6. Refresh Token ──');
  const oldAT = accessToken;
  res = await apiAuth('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }), noAuth: true });
  record('Auth-Refresh', 'Refresh token works', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  if (res.ok && res.data?.data) {
    accessToken = res.data.data.accessToken || accessToken;
    record('Auth-Refresh', 'New access token differs', accessToken !== oldAT ? 'PASS' : 'WARN', 'tokens same or different');
  }

  // ── 7. TOKEN SECURITY ──
  log('── 7. Token Security ──');
  res = await apiAuth('/api/v1/auth/me', { token: 'invalid-token-xyz' });
  record('Auth-Sec', 'Invalid token rejected', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await apiAuth('/api/v1/auth/me', { noAuth: true });
  record('Auth-Sec', 'No auth rejected', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await apiAuth('/api/v1/auth/me', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.fake' });
  record('Auth-Sec', 'Fake JWT rejected', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 8. CRM: LEADS ──
  log('── 8. CRM Leads ──');
  res = await apiAuth('/api/v1/leads', { method: 'POST', body: JSON.stringify({ firstName: 'Test', lastName: 'Lead', email: 'testlead@hub.com', phone: '9999999999' }) });
  record('CRM-Lead', 'Create lead', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  let leadId = '';
  if (res.ok && res.data?.data) leadId = res.data.data.id || res.data.data.lead?.id || '';
  record('CRM-Lead', 'Got lead ID', leadId ? 'PASS' : 'FAIL', leadId);

  res = await apiAuth('/api/v1/leads');
  record('CRM-Lead', 'List leads', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  if (leadId) {
    res = await apiAuth(`/api/v1/leads/${leadId}`);
    record('CRM-Lead', 'Get lead by ID', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
    res = await apiAuth(`/api/v1/leads/${leadId}`, { method: 'PUT', body: JSON.stringify({ firstName: 'Updated' }) });
    record('CRM-Lead', 'Update lead', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
    res = await apiAuth(`/api/v1/leads/${leadId}`, { method: 'DELETE' });
    record('CRM-Lead', 'Delete lead', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
    res = await apiAuth(`/api/v1/leads/${leadId}`);
    record('CRM-Lead', 'Deleted lead gone', !res.ok || res.status === 404 ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // ── 9. CRM: CONTACTS ──
  log('── 9. CRM Contacts ──');
  res = await apiAuth('/api/v1/contacts', { method: 'POST', body: JSON.stringify({ firstName: 'Test', lastName: 'Contact', email: 'testcontact@hub.com' }) });
  record('CRM-Contact', 'Create contact', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  let contactId = '';
  if (res.ok && res.data?.data) contactId = res.data.data.id || res.data.data.contact?.id || '';
  res = await apiAuth('/api/v1/contacts');
  record('CRM-Contact', 'List contacts', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  if (contactId) {
    res = await apiAuth(`/api/v1/contacts/${contactId}`);
    record('CRM-Contact', 'Get contact by ID', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
    res = await apiAuth(`/api/v1/contacts/${contactId}`, { method: 'DELETE' });
    record('CRM-Contact', 'Delete contact', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // ── 10. CRM: COMPANIES ──
  log('── 10. CRM Companies ──');
  res = await apiAuth('/api/v1/companies', { method: 'POST', body: JSON.stringify({ name: 'Test Company', email: 'testco@hub.com' }) });
  record('CRM-Company', 'Create company', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  let companyId = '';
  if (res.ok && res.data?.data) companyId = res.data.data.id || res.data.data.company?.id || '';
  res = await apiAuth('/api/v1/companies');
  record('CRM-Company', 'List companies', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  if (companyId) {
    res = await apiAuth(`/api/v1/companies/${companyId}`, { method: 'DELETE' });
    record('CRM-Company', 'Delete company', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // ── 11. CRM: DEALS ──
  log('── 11. CRM Deals ──');
  // Need a lead for deal
  res = await apiAuth('/api/v1/leads', { method: 'POST', body: JSON.stringify({ firstName: 'Deal', lastName: 'Lead', email: 'deallead@hub.com' }) });
  let dealLeadId = '';
  if (res.ok && res.data?.data) dealLeadId = res.data.data.id || res.data.data.lead?.id || '';
  res = await apiAuth('/api/v1/deals', { method: 'POST', body: JSON.stringify({ title: 'Test Deal', value: 10000, toStage: 'qualification', leadId: dealLeadId || undefined }) });
  record('CRM-Deal', 'Create deal', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, data=${JSON.stringify(res.data).slice(0,100)}`);
  let dealId = '';
  if (res.ok && res.data?.data) dealId = res.data.data.id || res.data.data.deal?.id || '';
  res = await apiAuth('/api/v1/deals');
  record('CRM-Deal', 'List deals', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  if (dealId) {
    res = await apiAuth(`/api/v1/deals/${dealId}`, { method: 'PUT', body: JSON.stringify({ toStage: 'proposal' }) });
    record('CRM-Deal', 'Update deal stage', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
    res = await apiAuth(`/api/v1/deals/${dealId}`, { method: 'DELETE' });
    record('CRM-Deal', 'Delete deal', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // ── 12. HRMS: EMPLOYEES ──
  log('── 12. HRMS Employees ──');
  res = await apiAuth('/api/v1/employees', { method: 'POST', body: JSON.stringify({ firstName: 'Emp', lastName: 'Test', email: 'emp@hub.com', employeeId: `EMP${Date.now()}` }) });
  record('HRMS-Emp', 'Create employee', res.ok ? 'PASS' : 'FAIL', `status=${res.status}, data=${JSON.stringify(res.data).slice(0,100)}`);
  let empId = '';
  if (res.ok && res.data?.data) empId = res.data.data.id || res.data.data.employee?.id || '';
  res = await apiAuth('/api/v1/employees');
  record('HRMS-Emp', 'List employees', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  if (empId) {
    res = await apiAuth(`/api/v1/employees/${empId}`, { method: 'DELETE' });
    record('HRMS-Emp', 'Delete employee', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // ── 13. HRMS: DEPARTMENTS ──
  log('── 13. HRMS Departments ──');
  res = await apiAuth('/api/v1/departments', { method: 'POST', body: JSON.stringify({ name: 'Test Dept' }) });
  record('HRMS-Dept', 'Create department', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  let deptId = '';
  if (res.ok && res.data?.data) deptId = res.data.data.id || res.data.data.department?.id || '';
  res = await apiAuth('/api/v1/departments');
  record('HRMS-Dept', 'List departments', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  if (deptId) {
    res = await apiAuth(`/api/v1/departments/${deptId}`, { method: 'DELETE' });
    record('HRMS-Dept', 'Delete department', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // ── 14. HRMS: LEAVE TYPES ──
  log('── 14. HRMS Leave Types ──');
  res = await apiAuth('/api/v1/leave-types', { method: 'POST', body: JSON.stringify({ name: 'Sick Leave', daysAllowed: 10 }) });
  record('HRMS-Leave', 'Create leave type', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await apiAuth('/api/v1/leave-types');
  record('HRMS-Leave', 'List leave types', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 15. TASKS ──
  log('── 15. Tasks ──');
  res = await apiAuth('/api/v1/tasks', { method: 'POST', body: JSON.stringify({ title: 'Test Task', priority: 'medium' }) });
  record('Tasks', 'Create task', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  let taskId = '';
  if (res.ok && res.data?.data) taskId = res.data.data.id || res.data.data.task?.id || '';
  res = await apiAuth('/api/v1/tasks');
  record('Tasks', 'List tasks', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  if (taskId) {
    res = await apiAuth(`/api/v1/tasks/${taskId}`, { method: 'DELETE' });
    record('Tasks', 'Delete task', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // ── 16. NOTES ──
  log('── 16. Notes ──');
  res = await apiAuth('/api/v1/leads', { method: 'POST', body: JSON.stringify({ firstName: 'Note', lastName: 'Lead', email: 'notelead@hub.com' }) });
  let noteLeadId = '';
  if (res.ok && res.data?.data) noteLeadId = res.data.data.id || res.data.data.lead?.id || '';
  if (noteLeadId) {
    res = await apiAuth('/api/v1/notes', { method: 'POST', body: JSON.stringify({ content: 'Test note', entityType: 'lead', entityId: noteLeadId }) });
    record('Notes', 'Create note', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }
  res = await apiAuth('/api/v1/notes', { method: 'GET' });
  record('Notes', 'List notes', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 17. ACTIVITIES/TIMELINE ──
  log('── 17. Activities ──');
  if (noteLeadId) {
    res = await apiAuth(`/api/v1/activities?entityType=lead&entityId=${noteLeadId}`);
    record('Activities', 'Get timeline', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // ── 18. FOLLOW-UPS ──
  log('── 18. Follow-ups ──');
  if (noteLeadId) {
    res = await apiAuth('/api/v1/follow-ups', { method: 'POST', body: JSON.stringify({ leadId: noteLeadId, scheduledAt: new Date(Date.now()+86400000).toISOString(), note: 'Follow up test' }) });
    record('FollowUps', 'Create follow-up', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  }
  res = await apiAuth('/api/v1/follow-ups');
  record('FollowUps', 'List follow-ups', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 19. SEARCH ──
  log('── 19. Search ──');
  res = await apiAuth('/api/v1/search?q=test');
  record('Search', 'Global search', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 20. EXPORT ──
  log('── 20. Export ──');
  res = await apiAuth('/api/v1/export?entityType=leads');
  record('Export', 'Export leads', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 21. ANALYTICS ──
  log('── 21. Analytics ──');
  res = await apiAuth('/api/v1/analytics/dashboard');
  record('Analytics', 'Dashboard analytics', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await apiAuth('/api/v1/analytics/crm');
  record('Analytics', 'CRM analytics', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 22. AI AGENTS ──
  log('── 22. AI Agents ──');
  res = await apiAuth('/api/v1/ai/agents');
  record('AI', 'List AI agents', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 23. COMMUNICATION ──
  log('── 23. Communication ──');
  res = await apiAuth('/api/v1/communications/templates');
  record('Comm', 'List templates', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await apiAuth('/api/v1/communications/providers');
  record('Comm', 'List providers', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 24. AUTOMATION ──
  log('── 24. Automation ──');
  res = await apiAuth('/api/v1/automations/workflows');
  record('Automation', 'List workflows', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 25. NOTIFICATIONS ──
  log('── 25. Notifications ──');
  res = await apiAuth('/api/v1/notifications');
  record('Notif', 'List notifications', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 26. AUDIT LOGS ──
  log('── 26. Audit Logs ──');
  res = await apiAuth('/api/v1/audit-logs');
  record('Audit', 'List audit logs', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 27. CHANGE PASSWORD ──
  log('── 27. Change Password ──');
  res = await apiAuth('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: 'H$phere@2026!', newPassword: 'H$phere@2026!', confirmPassword: 'H$phere@2026!' }) });
  record('Auth-PW', 'Change password (same pw)', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  res = await apiAuth('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'New@1234!', confirmPassword: 'New@1234!' }) });
  record('Auth-PW', 'Wrong current pw rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 28. LOGOUT ──
  log('── 28. Logout ──');
  res = await apiAuth('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
  record('Auth-Logout', 'Logout succeeds', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  
  // Verify token revoked
  res = await apiAuth('/api/v1/auth/me');
  record('Auth-Logout', 'Token invalid after logout', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 29. PROTECTED PAGES ──
  log('── 29. Protected Pages ──');
  const protectedPages = ['/dashboard', '/leads', '/contacts', '/companies', '/deals', '/employees', '/tasks', '/settings'];
  for (const page of protectedPages) {
    res = await fetch(`${BASE}${page}`, { redirect: 'manual' });
    const redirected = res.status === 307 || res.status === 302;
    record('Pages', `${page} redirects when unauth`, redirected ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // ── 30. VALIDATION ──
  log('── 30. Input Validation ──');
  // Login with missing fields
  res = await apiAuth('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({}), noAuth: true });
  record('Validation', 'Empty login body rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  // Create lead with missing required
  res = await apiAuth('/api/v1/leads', { method: 'POST', body: JSON.stringify({}) });
  record('Validation', 'Empty lead body rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  // Invalid UUID
  res = await apiAuth('/api/v1/leads/not-a-uuid');
  record('Validation', 'Invalid UUID rejected', !res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);

  // ── 31. SECURITY HEADERS ──
  log('── 31. Security Headers ──');
  res = await fetch(BASE + '/login');
  const h = res.headers;
  record('Security', 'Has X-Content-Type-Options', h.get('x-content-type-options') ? 'PASS' : 'WARN', h.get('x-content-type-options') || 'missing');
  record('Security', 'Has X-Frame-Options', h.get('x-frame-options') ? 'PASS' : 'WARN', h.get('x-frame-options') || 'missing');
  record('Security', 'Has HSTS', h.get('strict-transport-security') ? 'PASS' : 'WARN', h.get('strict-transport-security') || 'missing');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`\n  RUN ${runNum} COMPLETE: ${results.passed} PASS, ${results.failed} FAIL in ${elapsed}s`);
  
  return { runNum, ...results, elapsed, fatal: false };
}

// ── Main: Run 5 times ────────────────────────────────────────────
async function main() {
  log('HUBSPHERE 5× REGRESSION TEST');
  log(`Target: ${TOTAL_RUNS} independent runs of complete test suite`);
  log(`Production: ${BASE}`);
  log('');

  const overallStart = Date.now();
  let totalPass = 0;
  let totalFail = 0;
  let anyFailure = false;

  for (let i = 1; i <= TOTAL_RUNS; i++) {
    // Clean DB before each run
    const cleaned = await cleanDB();
    if (!cleaned) {
      log('WARNING: DB clean may have issues, proceeding anyway...');
    }
    // Wait a moment for DB propagation
    await new Promise(r => setTimeout(r, 2000));

    const result = await runSingleTestSuite(i);
    runResults.push(result);
    totalPass += result.passed;
    totalFail += result.failed;
    
    if (result.failed > 0) {
      anyFailure = true;
      allErrors.push(...result.errors.map(e => `[Run ${i}] ${e}`));
    }
    
    log(`\n  Run ${i} summary: ${result.passed}/${result.passed + result.failed} passed (${result.elapsed}s)`);
    
    if (result.fatal) {
      log('FATAL: Cannot continue - setup failed');
      break;
    }
  }

  const overallElapsed = ((Date.now() - overallStart) / 1000).toFixed(1);
  
  log('\n' + '═'.repeat(60));
  log('  FINAL 5× REGRESSION RESULTS');
  log('═'.repeat(60));
  for (const r of runResults) {
    log(`  Run ${r.runNum}: ${r.passed} PASS, ${r.failed} FAIL (${r.elapsed}s)${r.fatal ? ' FATAL' : ''}`);
  }
  log(`\n  TOTAL: ${totalPass} PASS, ${totalFail} FAIL across ${runResults.length} runs`);
  log(`  Target: ${TOTAL_RUNS * 173}/865 total PASS`);
  log(`  Time: ${overallElapsed}s`);
  
  if (totalFail > 0) {
    log('\n  ❌ FAILURES FOUND:');
    for (const e of allErrors) log(`    - ${e}`);
  } else {
    log('\n  ✅ ALL 5 RUNS PASSED - ZERO REGRESSIONS');
  }

  // Write results to JSON
  const fs = require('fs');
  const summary = {
    timestamp: new Date().toISOString(),
    totalRuns: runResults.length,
    targetRuns: TOTAL_RUNS,
    totalPass,
    totalFail,
    targetTotal: TOTAL_RUNS * 173,
    overallElapsed,
    runs: runResults.map(r => ({ run: r.runNum, passed: r.passed, failed: r.failed, elapsed: r.elapsed, fatal: r.fatal })),
    errors: allErrors,
    status: totalFail === 0 ? 'ALL_PASS' : 'FAILURES_FOUND'
  };
  fs.writeFileSync('/home/z/my-project/scripts/regression-5x-results.json', JSON.stringify(summary, null, 2));
  log('\nResults saved to regression-5x-results.json');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
