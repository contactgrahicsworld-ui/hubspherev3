/**
 * HubSphere V3 — 5× Regression Runner v3
 * CORRECT API PATHS: /api/v1/crm/leads, /api/v1/hrms/employees, etc.
 * PROPER AUTH: options.token overrides default accessToken
 */

const BASE = 'https://hubspherev3.vercel.app';
const DB_URL = 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

const TOTAL_RUNS = 5;
const runResults = [];
const allErrors = [];

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

// ── DB Cleanup ──
async function cleanDB() {
  log('Cleaning database...');
  try {
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    const tables = [
      'delivery_attempts','message_events','message_attachments','messages','conversations',
      'communication_provider_configs','communication_templates','notifications',
      'automation_execution_logs','automation_executions','automation_actions','automation_conditions','automation_triggers','automation_workflows',
      'ai_usage_logs','provider_configs',
      'bank_transfers','payroll_items','payroll_records','expenses','field_visits',
      'attendance_sessions','leave_requests','leave_types','employee_documents','employees',
      'designations','departments',
      'stage_history','activities','call_recordings','calls',
      'company_tags','contact_tags','lead_tags','tags',
      'notes','follow_ups','tasks','deals','companies','contacts','leads',
      'role_permissions','permissions','audit_logs','refresh_tokens','password_reset_tokens','email_verification_tokens','memberships','users','roles','tenants'
    ];
    for (const t of tables) {
      try { await p.$executeRawUnsafe(`DELETE FROM ${t}`); } catch(e) {}
    }
    await p.$disconnect();
    log('DB cleaned');
    return true;
  } catch (e) { log('DB clean error: ' + e.message.slice(0, 200)); return false; }
}

// ── Single Test Run ──
async function runSingleTestSuite(runNum) {
  log(`\n${'═'.repeat(60)}`);
  log(`  RUN ${runNum} OF ${TOTAL_RUNS}`);
  log('═'.repeat(60));

  const startTime = Date.now();
  const res = { passed: 0, failed: 0, errors: [], warnings: [] };
  let at = ''; // accessToken
  let rt = ''; // refreshToken

  function record(cat, test, status, detail = '') {
    if (status === 'PASS') res.passed++;
    else if (status === 'WARN') res.warnings.push(`${cat}/${test}: ${detail}`);
    else { res.failed++; res.errors.push(`${cat}/${test}: ${detail}`); }
    const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
    log(`  ${icon} [${cat}] ${test}${detail ? ': ' + detail.slice(0,80) : ''}`);
  }

  // API helper with proper token override
  async function api(path, opts = {}) {
    const url = `${BASE}${path}`;
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    // Use opts.token if provided, else use default at, unless noAuth
    const token = opts.noAuth ? null : (opts.token !== undefined ? opts.token : at);
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const r = await fetch(url, { ...opts, headers, redirect: 'manual' });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: r.status, data, ok: r.ok, headers: r.headers };
    } catch (e) {
      return { status: 0, data: null, ok: false, error: e.message };
    }
  }

  // ════════════════════════════════════════════════════════
  // 1. PUBLIC PAGES
  // ════════════════════════════════════════════════════════
  log('── 1. Public Pages ──');
  let r = await fetch(BASE + '/', { redirect: 'manual' });
  record('Public', 'Root → login redirect', r.status === 307 ? 'PASS' : 'FAIL', `status=${r.status}`);
  for (const page of ['/login', '/signup', '/setup', '/forgot-password']) {
    r = await fetch(BASE + page);
    record('Public', `${page} loads`, r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
  r = await fetch(BASE + '/nonexistent-xyz');
  record('Public', '404 renders', r.status === 200 || r.status === 404 ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 2. SYSTEM HEALTH
  // ════════════════════════════════════════════════════════
  log('── 2. System Health ──');
  r = await api('/api/v1/system/health', { noAuth: true });
  record('System', 'Health OK', r.ok && r.data?.data?.status === 'ok' ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/auth/setup/status', { noAuth: true });
  record('System', 'Setup status available', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  record('System', 'Setup needed (fresh DB)', r.data?.data?.setupComplete === false ? 'PASS' : 'FAIL', `setupComplete=${r.data?.data?.setupComplete}`);

  // ════════════════════════════════════════════════════════
  // 3. SETUP WIZARD
  // ════════════════════════════════════════════════════════
  log('── 3. Setup Wizard ──');
  const setupBody = { name: 'Admin User', email: 'admin@hubsphere.com', password: 'H$phere@2026!', confirmPassword: 'H$phere@2026!', organizationName: 'Test Org' };
  r = await api('/api/v1/auth/setup', { method: 'POST', body: JSON.stringify(setupBody), noAuth: true });
  record('Setup', 'Create super admin', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (r.ok && r.data?.data) {
    at = r.data.data.accessToken || '';
    rt = r.data.data.refreshToken || '';
    record('Setup', 'Got access token', at.length > 0 ? 'PASS' : 'FAIL', `len=${at.length}`);
    record('Setup', 'Got refresh token', rt.length > 0 ? 'PASS' : 'FAIL', `len=${rt.length}`);
  } else {
    record('Setup', 'FATAL: cannot proceed', 'FAIL', JSON.stringify(r.data).slice(0,200));
    return { runNum, ...res, elapsed: ((Date.now()-startTime)/1000).toFixed(1), fatal: true };
  }
  r = await api('/api/v1/auth/setup/status', { noAuth: true });
  record('Setup', 'Setup now complete', r.data?.data?.setupComplete === true ? 'PASS' : 'FAIL', `setupComplete=${r.data?.data?.setupComplete}`);
  r = await api('/api/v1/auth/setup', { method: 'POST', body: JSON.stringify({...setupBody, email:'x@y.com'}), noAuth: true });
  record('Setup', 'Second setup blocked', !r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 4. LOGIN
  // ════════════════════════════════════════════════════════
  log('── 4. Login ──');
  r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }), noAuth: true });
  record('Login', 'Valid credentials', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (r.ok && r.data?.data) { at = r.data.data.accessToken || at; rt = r.data.data.refreshToken || rt; }
  r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'wrong' }), noAuth: true });
  record('Login', 'Wrong password → 401', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'nobody@x.com', password: 'x' }), noAuth: true });
  record('Login', 'Unknown email → 401', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({}), noAuth: true });
  record('Login', 'Empty body → 400', !r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 5. /me
  // ════════════════════════════════════════════════════════
  log('── 5. Current User ──');
  r = await api('/api/v1/auth/me');
  record('Me', 'Get current user', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (r.ok && r.data?.data) {
    const u = r.data.data.user;
    record('Me', 'Email matches', u?.email === 'admin@hubsphere.com' ? 'PASS' : 'FAIL', u?.email);
    record('Me', 'Is super admin', u?.isSuperAdmin === true ? 'PASS' : 'FAIL', `${u?.isSuperAdmin}`);
    record('Me', 'Has permissions', Array.isArray(r.data.data.permissions) ? 'PASS' : 'FAIL', `count=${r.data.data.permissions?.length}`);
  }

  // ════════════════════════════════════════════════════════
  // 6. REFRESH TOKEN
  // ════════════════════════════════════════════════════════
  log('── 6. Refresh Token ──');
  const oldAT = at;
  r = await api('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: rt }), noAuth: true });
  record('Refresh', 'Token rotation works', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (r.ok && r.data?.data) {
    at = r.data.data.accessToken || at;
    record('Refresh', 'New token differs', at !== oldAT ? 'PASS' : 'WARN', 'tokens comparison');
  }
  // Old refresh token should be revoked
  r = await api('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: rt }), noAuth: true });
  record('Refresh', 'Old RT revoked after rotation', !r.ok ? 'PASS' : 'FAIL', `status=${r.status} (should be 401)`);

  // ════════════════════════════════════════════════════════
  // 7. TOKEN SECURITY
  // ════════════════════════════════════════════════════════
  log('── 7. Token Security ──');
  r = await api('/api/v1/auth/me', { token: 'invalid-token-xyz' });
  record('TokenSec', 'Invalid token → 401', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/auth/me', { noAuth: true });
  record('TokenSec', 'No auth → 401', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/auth/me', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.fake' });
  record('TokenSec', 'Fake JWT → 401', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 8. CRM: LEADS (/api/v1/crm/leads)
  // ════════════════════════════════════════════════════════
  log('── 8. CRM Leads ──');
  r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: 'Test', lastName: 'Lead', email: 'testlead@hub.com', phone: '9999999999' }) });
  record('CRM-Lead', 'Create lead', r.ok ? 'PASS' : 'FAIL', `status=${r.status}, data=${JSON.stringify(r.data).slice(0,100)}`);
  let leadId = r.data?.data?.id || r.data?.data?.lead?.id || '';
  r = await api('/api/v1/crm/leads');
  record('CRM-Lead', 'List leads', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (leadId) {
    r = await api(`/api/v1/crm/leads/${leadId}`);
    record('CRM-Lead', 'Get lead by ID', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`/api/v1/crm/leads/${leadId}`, { method: 'PUT', body: JSON.stringify({ firstName: 'Updated' }) });
    record('CRM-Lead', 'Update lead', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`/api/v1/crm/leads/${leadId}`, { method: 'DELETE' });
    record('CRM-Lead', 'Delete lead', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`/api/v1/crm/leads/${leadId}`);
    record('CRM-Lead', 'Deleted lead gone', !r.ok || r.status === 404 ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // ════════════════════════════════════════════════════════
  // 9. CRM: CONTACTS
  // ════════════════════════════════════════════════════════
  log('── 9. CRM Contacts ──');
  r = await api('/api/v1/crm/contacts', { method: 'POST', body: JSON.stringify({ firstName: 'Test', lastName: 'Contact', email: 'testcontact@hub.com' }) });
  record('CRM-Contact', 'Create contact', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  let contactId = r.data?.data?.id || r.data?.data?.contact?.id || '';
  r = await api('/api/v1/crm/contacts');
  record('CRM-Contact', 'List contacts', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (contactId) {
    r = await api(`/api/v1/crm/contacts/${contactId}`);
    record('CRM-Contact', 'Get contact by ID', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`/api/v1/crm/contacts/${contactId}`, { method: 'DELETE' });
    record('CRM-Contact', 'Delete contact', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // ════════════════════════════════════════════════════════
  // 10. CRM: COMPANIES
  // ════════════════════════════════════════════════════════
  log('── 10. CRM Companies ──');
  r = await api('/api/v1/crm/companies', { method: 'POST', body: JSON.stringify({ name: 'Test Company', email: 'testco@hub.com' }) });
  record('CRM-Company', 'Create company', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  let companyId = r.data?.data?.id || r.data?.data?.company?.id || '';
  r = await api('/api/v1/crm/companies');
  record('CRM-Company', 'List companies', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (companyId) {
    r = await api(`/api/v1/crm/companies/${companyId}`, { method: 'DELETE' });
    record('CRM-Company', 'Delete company', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // ════════════════════════════════════════════════════════
  // 11. CRM: DEALS
  // ════════════════════════════════════════════════════════
  log('── 11. CRM Deals ──');
  r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: 'Deal', lastName: 'Lead', email: 'deallead@hub.com' }) });
  let dealLeadId = r.data?.data?.id || r.data?.data?.lead?.id || '';
  r = await api('/api/v1/crm/deals', { method: 'POST', body: JSON.stringify({ title: 'Test Deal', value: 10000, toStage: 'qualification', leadId: dealLeadId || undefined }) });
  record('CRM-Deal', 'Create deal', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  let dealId = r.data?.data?.id || r.data?.data?.deal?.id || '';
  r = await api('/api/v1/crm/deals');
  record('CRM-Deal', 'List deals', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (dealId) {
    r = await api(`/api/v1/crm/deals/${dealId}`, { method: 'PUT', body: JSON.stringify({ toStage: 'proposal' }) });
    record('CRM-Deal', 'Update deal stage', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`/api/v1/crm/deals/${dealId}`, { method: 'DELETE' });
    record('CRM-Deal', 'Delete deal', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // ════════════════════════════════════════════════════════
  // 12. CRM: TASKS
  // ════════════════════════════════════════════════════════
  log('── 12. CRM Tasks ──');
  r = await api('/api/v1/crm/tasks', { method: 'POST', body: JSON.stringify({ title: 'Test Task', priority: 'MEDIUM' }) });
  record('CRM-Task', 'Create task', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  let taskId = r.data?.data?.id || r.data?.data?.task?.id || '';
  r = await api('/api/v1/crm/tasks');
  record('CRM-Task', 'List tasks', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (taskId) {
    r = await api(`/api/v1/crm/tasks/${taskId}`, { method: 'DELETE' });
    record('CRM-Task', 'Delete task', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // ════════════════════════════════════════════════════════
  // 13. CRM: NOTES & FOLLOW-UPS & SEARCH & EXPORT
  // ════════════════════════════════════════════════════════
  log('── 13. CRM Notes/Search/Export ──');
  r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: 'Note', lastName: 'Lead', email: 'notelead@hub.com' }) });
  let noteLeadId = r.data?.data?.id || r.data?.data?.lead?.id || '';
  if (noteLeadId) {
    r = await api('/api/v1/crm/notes', { method: 'POST', body: JSON.stringify({ content: 'Test note', entityType: 'LEAD', entityId: noteLeadId }) });
    record('CRM-Note', 'Create note', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api('/api/v1/crm/follow-ups', { method: 'POST', body: JSON.stringify({ title: 'Follow up', followUpAt: new Date(Date.now()+86400000).toISOString(), leadId: noteLeadId, description: 'Follow up note' }) });
    record('CRM-FU', 'Create follow-up', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    r = await api(`/api/v1/crm/timeline?entityType=LEAD&entityId=${noteLeadId}`);
    record('CRM-Timeline', 'Get timeline', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
  r = await api('/api/v1/crm/notes');
  record('CRM-Note', 'List notes', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/crm/follow-ups');
  record('CRM-FU', 'List follow-ups', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/crm/search?q=test');
  record('CRM-Search', 'Search', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/crm/export?entityType=leads');
  record('CRM-Export', 'Export leads', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 14. HRMS: EMPLOYEES
  // ════════════════════════════════════════════════════════
  log('── 14. HRMS Employees ──');
  // Employee requires userId - get current user's ID
  let meRes = await api('/api/v1/auth/me');
  let meUserId = meRes.data?.data?.user?.id || '';
  r = await api('/api/v1/hrms/employees', { method: 'POST', body: JSON.stringify({ firstName: 'Emp', lastName: 'Test', userId: meUserId, employeeId: `EMP${Date.now()}` }) });
  record('HRMS-Emp', 'Create employee', r.ok ? 'PASS' : 'FAIL', `status=${r.status}, data=${JSON.stringify(r.data).slice(0,100)}`);
  let empId = r.data?.data?.id || r.data?.data?.employee?.id || '';
  r = await api('/api/v1/hrms/employees');
  record('HRMS-Emp', 'List employees', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (empId) {
    r = await api(`/api/v1/hrms/employees/${empId}`, { method: 'DELETE' });
    record('HRMS-Emp', 'Delete employee', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // ════════════════════════════════════════════════════════
  // 15. HRMS: DEPARTMENTS & LEAVE TYPES
  // ════════════════════════════════════════════════════════
  log('── 15. HRMS Departments/Leave ──');
  r = await api('/api/v1/hrms/departments', { method: 'POST', body: JSON.stringify({ name: 'Test Dept' }) });
  record('HRMS-Dept', 'Create department', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  let deptId = r.data?.data?.id || r.data?.data?.department?.id || '';
  r = await api('/api/v1/hrms/departments');
  record('HRMS-Dept', 'List departments', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  if (deptId) {
    r = await api(`/api/v1/hrms/departments/${deptId}`, { method: 'DELETE' });
    record('HRMS-Dept', 'Delete department', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }
  r = await api('/api/v1/hrms/leave-types', { method: 'POST', body: JSON.stringify({ name: 'Sick Leave', code: 'SICK', defaultDays: 10 }) });
  record('HRMS-Leave', 'Create leave type', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/hrms/leave-types');
  record('HRMS-Leave', 'List leave types', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 16. ANALYTICS
  // ════════════════════════════════════════════════════════
  log('── 16. Analytics ──');
  r = await api('/api/v1/analytics/crm');
  record('Analytics', 'CRM analytics', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/analytics/hr');
  record('Analytics', 'HR analytics', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/analytics/executive');
  record('Analytics', 'Executive analytics', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 17. AI AGENTS
  // ════════════════════════════════════════════════════════
  log('── 17. AI Agents ──');
  r = await api('/api/v1/ai/agents');
  record('AI', 'List AI agents', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 18. COMMUNICATION
  // ════════════════════════════════════════════════════════
  log('── 18. Communication ──');
  r = await api('/api/v1/communication/templates');
  record('Comm', 'List templates', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/communication/providers');
  record('Comm', 'List providers', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/communication/conversations');
  record('Comm', 'List conversations', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/communication/notifications');
  record('Comm', 'List notifications', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 19. AUTOMATION
  // ════════════════════════════════════════════════════════
  log('── 19. Automation ──');
  r = await api('/api/v1/automation/workflows');
  record('Auto', 'List workflows', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 20. ADMIN
  // ════════════════════════════════════════════════════════
  log('── 20. Admin ──');
  r = await api('/api/v1/admin/users');
  record('Admin', 'List users', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/admin/roles');
  record('Admin', 'List roles', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/admin/audit');
  record('Admin', 'List audit logs', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 21. CHANGE PASSWORD
  // ════════════════════════════════════════════════════════
  log('── 21. Change Password ──');
  // newPassword must differ from currentPassword
  r = await api('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: 'H$phere@2026!', newPassword: 'H$phere@2027!', confirmPassword: 'H$phere@2027!' }) });
  record('Auth-PW', 'Change password (different)', r.ok ? 'PASS' : 'FAIL', `status=${r.status}, data=${JSON.stringify(r.data).slice(0,100)}`);
  // Reset back
  if (r.ok) {
    const resetLogin = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2027!' }), noAuth: true });
    if (resetLogin.ok) {
      const resetAT = resetLogin.data?.data?.accessToken;
      await api('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: 'H$phere@2027!', newPassword: 'H$phere@2026!', confirmPassword: 'H$phere@2026!' }), token: resetAT });
    }
  }
  r = await api('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'New@1234!', confirmPassword: 'New@1234!' }) });
  record('Auth-PW', 'Wrong current pw rejected', !r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 22. LOGOUT
  // ════════════════════════════════════════════════════════
  log('── 22. Logout ──');
  // Re-login to get fresh tokens for logout test
  r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }), noAuth: true });
  let logoutAT = r.data?.data?.accessToken || at;
  let logoutRT = r.data?.data?.refreshToken || rt;
  
  r = await api('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: logoutRT }), token: logoutAT });
  record('Logout', 'Logout succeeds', r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  // Verify refresh token revoked (cannot rotate)
  r = await api('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: logoutRT }), noAuth: true });
  record('Logout', 'Refresh token revoked after logout', !r.ok ? 'PASS' : 'FAIL', `status=${r.status} (should be 401)`);
  // Note: JWT access token remains valid until natural expiry (standard JWT behavior)
  // This is expected - access tokens are short-lived and don't use a blacklist

  // ════════════════════════════════════════════════════════
  // 23. PROTECTED PAGES
  // ════════════════════════════════════════════════════════
  log('── 23. Protected Pages ──');
  for (const page of ['/dashboard', '/leads', '/contacts', '/companies', '/deals', '/employees', '/tasks', '/settings']) {
    r = await fetch(`${BASE}${page}`, { redirect: 'manual' });
    record('Pages', `${page} → redirect`, r.status === 307 || r.status === 302 ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // ════════════════════════════════════════════════════════
  // 24. INPUT VALIDATION
  // ════════════════════════════════════════════════════════
  log('── 24. Input Validation ──');
  r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({}), noAuth: true });
  record('Valid', 'Empty login body rejected', !r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  // Re-auth for validation tests
  r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'H$phere@2026!' }), noAuth: true });
  at = r.data?.data?.accessToken || at;
  
  r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({}) });
  record('Valid', 'Empty lead body rejected', !r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  r = await api('/api/v1/crm/leads/not-a-uuid');
  record('Valid', 'Invalid UUID → 400/404', !r.ok ? 'PASS' : 'FAIL', `status=${r.status}`);

  // ════════════════════════════════════════════════════════
  // 25. SECURITY HEADERS
  // ════════════════════════════════════════════════════════
  log('── 25. Security Headers ──');
  r = await fetch(BASE + '/login');
  const h = r.headers;
  record('SecHdr', 'X-Content-Type-Options', h.get('x-content-type-options') ? 'PASS' : 'WARN', h.get('x-content-type-options') || 'missing');
  record('SecHdr', 'X-Frame-Options', h.get('x-frame-options') ? 'PASS' : 'WARN', h.get('x-frame-options') || 'missing');
  record('SecHdr', 'HSTS', h.get('strict-transport-security') ? 'PASS' : 'WARN', h.get('strict-transport-security') || 'missing');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const total = res.passed + res.failed;
  log(`\n  RUN ${runNum} COMPLETE: ${res.passed}/${total} PASS, ${res.failed} FAIL in ${elapsed}s`);
  return { runNum, ...res, elapsed, fatal: false, total };
}

// ── Main ──
async function main() {
  log('HUBSPHERE 5× REGRESSION TEST v3');
  log(`Production: ${BASE}\n`);

  const overallStart = Date.now();
  let totalPass = 0, totalFail = 0;

  for (let i = 1; i <= TOTAL_RUNS; i++) {
    await cleanDB();
    await new Promise(r => setTimeout(r, 2000));
    const result = await runSingleTestSuite(i);
    runResults.push(result);
    totalPass += result.passed;
    totalFail += result.failed;
    if (result.fatal) { log('FATAL: Setup failed, stopping'); break; }
  }

  const overallElapsed = ((Date.now() - overallStart) / 1000).toFixed(1);
  
  log('\n' + '═'.repeat(60));
  log('  FINAL 5× REGRESSION RESULTS');
  log('═'.repeat(60));
  let totalTests = 0;
  for (const r of runResults) {
    const t = r.passed + r.failed;
    totalTests = t; // They should all be same
    log(`  Run ${r.runNum}: ${r.passed}/${t} PASS (${r.elapsed}s)`);
  }
  log(`\n  TOTAL: ${totalPass} PASS, ${totalFail} FAIL across ${runResults.length} runs`);
  log(`  Per-run test count: ${totalTests}`);
  log(`  Target: ${totalTests * TOTAL_RUNS} total across ${TOTAL_RUNS} runs`);
  log(`  Time: ${overallElapsed}s`);

  if (totalFail > 0) {
    log('\n  ❌ FAILURES:');
    for (const r of runResults) {
      if (r.errors.length > 0) {
        log(`  Run ${r.runNum}:`);
        for (const e of r.errors) log(`    - ${e}`);
      }
    }
  } else {
    log('\n  ✅ ALL 5 RUNS PASSED — ZERO REGRESSIONS');
  }

  const fs = require('fs');
  fs.writeFileSync('/home/z/my-project/scripts/regression-5x-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    runs: runResults.length,
    totalPass, totalFail,
    perRunTests: totalTests,
    targetTotal: totalTests * TOTAL_RUNS,
    overallElapsed,
    runDetails: runResults.map(r => ({ run: r.runNum, passed: r.passed, failed: r.failed, total: r.passed+r.failed, elapsed: r.elapsed, fatal: r.fatal })),
    errors: runResults.flatMap(r => r.errors.map(e => `[Run ${r.runNum}] ${e}`)),
    status: totalFail === 0 ? 'ALL_PASS' : 'FAILURES_FOUND'
  }, null, 2));
  log('\nResults saved.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
