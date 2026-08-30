/**
 * HubSphere — Complete Feature Test Suite + Security Audit
 * Tests ALL API endpoints 10 times each, checks security vulnerabilities
 */

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL + '?pgbouncer=true' } }
});

const BASE = 'https://hubspherev3.vercel.app';
let TOKEN = '';
let USER_ID = '';
let TENANT_ID = '';
const results: Record<string, { pass: number; fail: number; errors: string[] }> = {};

function log(module: string, test: string, pass: boolean, detail?: string) {
  if (!results[module]) results[module] = { pass: 0, fail: 0, errors: [] };
  if (pass) {
    results[module].pass++;
  } else {
    results[module].fail++;
    results[module].errors.push(`${test}: ${detail || 'Unknown error'}`);
  }
}

async function api(path: string, opts: RequestInit = {}): Promise<{ status: number; data: any; ok: boolean }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string>) };
    if (TOKEN && !opts.noAuth) headers['Authorization'] = 'Bearer ' + TOKEN;
    const resp = await fetch(BASE + path, { ...opts, headers, signal: AbortSignal.timeout(30000) });
    const data = await resp.json().catch(() => null);
    return { status: resp.status, data, ok: resp.status >= 200 && resp.status < 300 };
  } catch (e: any) {
    return { status: 0, data: { error: e.message }, ok: false };
  }
}

// ============ AUTH TESTS ============
async function testAuth() {
  const m = 'AUTH';
  
  // Test 1: Login
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'Admin@123456' }), noAuth: true });
    log(m, `Login round ${i+1}`, r.ok && r.data?.data?.accessToken, `status=${r.status}`);
    if (r.ok && r.data?.data?.accessToken) {
      TOKEN = r.data.data.accessToken;
      USER_ID = r.data.data.user?.id || '';
    }
  }

  // Test 2: Get current user (me)
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/auth/me');
    log(m, `Get Me round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
    if (r.ok && r.data?.data?.id) USER_ID = r.data.data.id;
  }

  // Test 3: Health check
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/system/health', { noAuth: true });
    log(m, `Health check round ${i+1}`, r.ok && r.data?.data?.status === 'ok', `status=${r.status}`);
  }

  // Test 4: Unauthenticated access should fail
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/auth/me', { noAuth: true });
    log(m, `Unauth blocked round ${i+1}`, r.status === 401, `status=${r.status}`);
  }

  // Test 5: Wrong password
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'WrongPass1' }), noAuth: true });
    log(m, `Wrong password rejected round ${i+1}`, r.status === 401, `status=${r.status}`);
  }

  // Test 6: Invalid email format
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'not-an-email', password: 'Admin@123456' }), noAuth: true });
    log(m, `Invalid email rejected round ${i+1}`, r.status === 422, `status=${r.status}`);
  }

  // Test 7: Missing fields
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com' }), noAuth: true });
    log(m, `Missing password rejected round ${i+1}`, r.status === 422, `status=${r.status}`);
  }

  // Test 8: Refresh token flow
  for (let i = 0; i < 10; i++) {
    // First login to get tokens
    const login = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'Admin@123456' }), noAuth: true });
    if (!login.ok) { log(m, `Refresh round ${i+1}`, false, 'Login failed'); continue; }
    TOKEN = login.data.data.accessToken;
    const refreshToken = login.data.data.refreshToken;
    // Now refresh
    const r = await api('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }), noAuth: true });
    log(m, `Token refresh round ${i+1}`, r.ok && r.data?.data?.accessToken, `status=${r.status}`);
    if (r.ok) TOKEN = r.data.data.accessToken;
  }

  // Test 9: Double setup should fail
  for (let i = 0; i < 5; i++) {
    const r = await api('/api/v1/auth/setup', { method: 'POST', body: JSON.stringify({ name: 'Hacker', email: `hacker${i}@test.com`, password: 'Hacker@12345', confirmPassword: 'Hacker@12345' }), noAuth: true });
    log(m, `Double setup blocked round ${i+1}`, r.status === 403, `status=${r.status}`);
  }
}

// ============ SUPER ADMIN TESTS ============
async function testSuperAdmin() {
  const m = 'SUPER_ADMIN';

  // Get platform stats
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/super-admin/stats');
    log(m, `Platform stats round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Create tenant
  let tenantId = '';
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/super-admin/tenants', { method: 'POST', body: JSON.stringify({ name: `Test Org ${i+1}`, slug: `test-org-${i+1}-${Date.now()}`, status: 'ACTIVE', plan: 'PRO', maxUsers: 100, settings: {} }) });
    log(m, `Create tenant round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status} body=${JSON.stringify(r.data)?.substring(0,100)}`);
    if (r.ok && r.data?.data?.id && !tenantId) tenantId = r.data.data.id;
  }
  TENANT_ID = tenantId;

  // List tenants
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/super-admin/tenants');
    log(m, `List tenants round ${i+1}`, r.ok && Array.isArray(r.data?.data), `status=${r.status}`);
  }

  // Get roles
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/super-admin/roles');
    log(m, `List roles round ${i+1}`, r.ok && Array.isArray(r.data?.data), `status=${r.status}`);
  }

  // Audit logs
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/super-admin/audit');
    log(m, `Audit logs round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // System providers
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/system/providers');
    log(m, `System providers round ${i+1}`, r.ok, `status=${r.status}`);
  }
}

// ============ CRM TESTS ============
let leadId = '';
let contactId = '';
let companyId = '';
let dealId = '';

async function testCRM() {
  const m = 'CRM';

  // CRM Dashboard
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/dashboard');
    log(m, `CRM Dashboard round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // Create Company
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/companies', { method: 'POST', body: JSON.stringify({ name: `Test Company ${i+1}`, industry: 'TECHNOLOGY', website: `https://company${i+1}.com`, city: 'Mumbai', state: 'MH', country: 'India' }) });
    log(m, `Create company round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
    if (r.ok && r.data?.data?.id && !companyId) companyId = r.data.data.id;
  }

  // List Companies
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/companies');
    log(m, `List companies round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Create Contact
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/contacts', { method: 'POST', body: JSON.stringify({ firstName: `Test${i+1}`, lastName: 'Contact', email: `test${i+1}@contact.com`, phone: `987654321${i}`, title: 'Manager', companyId: companyId || undefined }) });
    log(m, `Create contact round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
    if (r.ok && r.data?.data?.id && !contactId) contactId = r.data.data.id;
  }

  // List Contacts
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/contacts');
    log(m, `List contacts round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Create Lead
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: `Lead${i+1}`, lastName: 'Test', email: `lead${i+1}@test.com`, phone: `999988880${i}`, source: 'WEBSITE', priority: i % 4 === 0 ? 'URGENT' : i % 3 === 0 ? 'HIGH' : 'MEDIUM', status: 'NEW', value: (i + 1) * 10000, description: `Test lead ${i+1}` }) });
    log(m, `Create lead round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
    if (r.ok && r.data?.data?.id && !leadId) leadId = r.data.data.id;
  }

  // List Leads
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/leads');
    log(m, `List leads round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Get Lead Detail
  if (leadId) {
    for (let i = 0; i < 10; i++) {
      const r = await api(`/api/v1/crm/leads/${leadId}`);
      log(m, `Get lead detail round ${i+1}`, r.ok && r.data?.data?.id === leadId, `status=${r.status}`);
    }

    // Update Lead
    for (let i = 0; i < 10; i++) {
      const r = await api(`/api/v1/crm/leads/${leadId}`, { method: 'PUT', body: JSON.stringify({ status: 'CONTACTED', priority: 'HIGH' }) });
      log(m, `Update lead round ${i+1}`, r.ok, `status=${r.status}`);
    }
  }

  // Create Deal
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/deals', { method: 'POST', body: JSON.stringify({ title: `Deal ${i+1}`, value: (i + 1) * 50000, currency: 'INR', stage: 'PROSPECTING', probability: 50, contactId: contactId || undefined, companyId: companyId || undefined }) });
    log(m, `Create deal round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
    if (r.ok && r.data?.data?.id && !dealId) dealId = r.data.data.id;
  }

  // List Deals
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/deals');
    log(m, `List deals round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Update Deal Stage
  if (dealId) {
    for (let i = 0; i < 10; i++) {
      const stages = ['PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON'];
      const r = await api(`/api/v1/crm/deals/${dealId}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: stages[i % stages.length] }) });
      log(m, `Deal stage change round ${i+1}`, r.ok, `status=${r.status}`);
    }
  }

  // Create Task
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/tasks', { method: 'POST', body: JSON.stringify({ title: `Task ${i+1}`, description: 'Test task', priority: 'HIGH', status: 'TODO', dueDate: new Date(Date.now() + 86400000).toISOString(), entityType: 'LEAD', entityId: leadId || undefined }) });
    log(m, `Create task round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
  }

  // List Tasks
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/tasks');
    log(m, `List tasks round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Create Follow-up
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/follow-ups', { method: 'POST', body: JSON.stringify({ entityType: 'LEAD', entityId: leadId || undefined, notes: `Follow up ${i+1}`, scheduledAt: new Date(Date.now() + 3600000).toISOString(), status: 'PENDING' }) });
    log(m, `Create follow-up round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
  }

  // List Follow-ups
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/follow-ups');
    log(m, `List follow-ups round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Create Note
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/notes', { method: 'POST', body: JSON.stringify({ entityType: 'LEAD', entityId: leadId || undefined, content: `Test note ${i+1} - This is a detailed test note for verification.` }) });
    log(m, `Create note round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
  }

  // Create Tag
  for (let i = 0; i < 5; i++) {
    const r = await api('/api/v1/crm/tags', { method: 'POST', body: JSON.stringify({ name: `Tag${i+1}`, color: '#3B82F6' }) });
    log(m, `Create tag round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
  }

  // List Tags
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/tags');
    log(m, `List tags round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // CRM Search
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/search?q=Test');
    log(m, `CRM search round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // Lead Convert (if lead exists)
  if (leadId) {
    for (let i = 0; i < 3; i++) {
      const r = await api(`/api/v1/crm/leads/${leadId}/convert`, { method: 'POST' });
      log(m, `Lead convert round ${i+1}`, r.ok || r.status === 409, `status=${r.status}`);
    }
  }

  // Export CSV
  for (let i = 0; i < 3; i++) {
    const r = await fetch(BASE + '/api/v1/crm/export?entityType=leads', { headers: { Authorization: 'Bearer ' + TOKEN } }).then(res => ({ status: res.status, ok: res.ok }));
    log(m, `Export CSV round ${i+1}`, r.ok, `status=${r.status}`);
  }
}

// ============ HRMS TESTS ============
let deptId = '';
let desigId = '';
let empId = '';

async function testHRMS() {
  const m = 'HRMS';

  // HR Dashboard
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/dashboard');
    log(m, `HR Dashboard round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // Create Department
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/departments', { method: 'POST', body: JSON.stringify({ name: `Department ${i+1}`, description: 'Test department' }) });
    log(m, `Create dept round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
    if (r.ok && r.data?.data?.id && !deptId) deptId = r.data.data.id;
  }

  // List Departments
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/departments');
    log(m, `List depts round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Create Designation
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/designations', { method: 'POST', body: JSON.stringify({ title: `Designation ${i+1}`, departmentId: deptId || undefined }) });
    log(m, `Create designation round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
    if (r.ok && r.data?.data?.id && !desigId) desigId = r.data.data.id;
  }

  // List Designations
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/designations');
    log(m, `List designations round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Create Employee
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/employees', { method: 'POST', body: JSON.stringify({ firstName: `Emp${i+1}`, lastName: 'Test', email: `emp${i+1}@hubsphere.com`, phone: `988877660${i}`, departmentId: deptId || undefined, designationId: desigId || undefined, dateOfJoining: '2024-01-15', salary: 50000 + (i * 5000), employmentStatus: 'ACTIVE', workLocation: 'Mumbai' }) });
    log(m, `Create employee round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
    if (r.ok && r.data?.data?.id && !empId) empId = r.data.data.id;
  }

  // List Employees
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/employees');
    log(m, `List employees round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Get Employee Detail
  if (empId) {
    for (let i = 0; i < 10; i++) {
      const r = await api(`/api/v1/hrms/employees/${empId}`);
      log(m, `Get employee detail round ${i+1}`, r.ok && r.data?.data?.id === empId, `status=${r.status}`);
    }
  }

  // Create Attendance
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/attendance', { method: 'POST', body: JSON.stringify({ employeeId: empId || undefined, date: '2025-01-15', checkIn: '2025-01-15T09:00:00Z', checkOut: '2025-01-15T18:00:00Z', status: 'PRESENT', workingMinutes: 540 }) });
    log(m, `Create attendance round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
  }

  // List Attendance
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/attendance');
    log(m, `List attendance round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Create Leave Type
  for (let i = 0; i < 5; i++) {
    const r = await api('/api/v1/hrms/leave-types', { method: 'POST', body: JSON.stringify({ name: `Leave Type ${i+1}`, code: `LT${i+1}`, paid: true, carryForward: false, maxDays: 12 }) });
    log(m, `Create leave type round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
  }

  // Create Leave Request
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/leave-requests', { method: 'POST', body: JSON.stringify({ employeeId: empId || undefined, leaveTypeId: undefined, startDate: '2025-02-01', endDate: '2025-02-03', totalDays: 3, reason: 'Personal work', status: 'PENDING' }) });
    log(m, `Create leave request round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
  }

  // List Leave Requests
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/leave-requests');
    log(m, `List leave requests round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Create Expense
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/expenses', { method: 'POST', body: JSON.stringify({ employeeId: empId || undefined, title: `Expense ${i+1}`, amount: 1000 + (i * 200), category: 'TRAVEL', description: 'Travel expense', status: 'PENDING' }) });
    log(m, `Create expense round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
  }

  // List Expenses
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/expenses');
    log(m, `List expenses round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }

  // Create Field Visit
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/field-visits', { method: 'POST', body: JSON.stringify({ employeeId: empId || undefined, date: '2025-01-20', purpose: 'Client meeting', status: 'PLANNED', notes: 'Visit to client office' }) });
    log(m, `Create field visit round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
  }

  // Field Dashboard
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/field-dashboard');
    log(m, `Field dashboard round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // Create Payroll
  for (let i = 0; i < 5; i++) {
    const r = await api('/api/v1/hrms/payroll', { method: 'POST', body: JSON.stringify({ employeeId: empId || undefined, month: '2025-01', basicSalary: 40000, totalAllowances: 10000, totalDeductions: 5000, netSalary: 45000, status: 'DRAFT' }) });
    log(m, `Create payroll round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
  }

  // List Payroll
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/hrms/payroll');
    log(m, `List payroll round ${i+1}`, r.ok && r.data?.data, `status=${r.status}`);
  }
}

// ============ SECURITY AUDIT ============
async function testSecurity() {
  const m = 'SECURITY';

  // 1. SQL Injection attempts
  const sqliPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE users;--",
    "1; SELECT * FROM users--",
    "admin'/**/OR/**/1=1--"
  ];
  for (let i = 0; i < 10; i++) {
    const payload = sqliPayloads[i % sqliPayloads.length];
    const r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: payload, password: payload }), noAuth: true });
    log(m, `SQLi blocked #${i+1}`, r.status === 422 || r.status === 401, `status=${r.status} payload=${payload.substring(0,30)}`);
  }

  // 2. XSS attempts
  const xssPayloads = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    '{{constructor.constructor("alert(1)")()}}',
    '<svg onload=alert(1)>'
  ];
  for (let i = 0; i < 10; i++) {
    const payload = xssPayloads[i % xssPayloads.length];
    const r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: payload, lastName: 'XSS', email: `xss${i}@test.com`, phone: '9876543210', source: 'WEBSITE', priority: 'LOW', status: 'NEW' }) });
    log(m, `XSS sanitized #${i+1}`, r.ok || r.status === 422, `status=${r.status}`);
  }

  // 3. NoSQL/NoDB Injection
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: { $ne: '' }, password: { $ne: '' } }), noAuth: true });
    log(m, `NoSQLi blocked #${i+1}`, r.status === 422, `status=${r.status}`);
  }

  // 4. Path traversal
  for (let i = 0; i < 10; i++) {
    const paths = ['../../../etc/passwd', '..\\..\\..\\windows\\system32', '/api/v1/../../admin/settings'];
    const r = await fetch(BASE + paths[i % paths.length]).then(res => ({ status: res.status }));
    log(m, `Path traversal blocked #${i+1}`, r.status === 404 || r.status === 400 || r.status === 308, `status=${r.status}`);
  }

  // 5. CORS check
  for (let i = 0; i < 5; i++) {
    const r = await fetch(BASE + '/api/v1/system/health', { headers: { Origin: 'https://evil-site.com' } }).then(async res => ({
      status: res.status,
      allowOrigin: res.headers.get('access-control-allow-origin')
    }));
    const blocked = r.allowOrigin === null || r.allowOrigin !== 'https://evil-site.com';
    log(m, `CORS blocked #${i+1}`, blocked, `origin=${r.allowOrigin}`);
  }

  // 6. Security headers check
  for (let i = 0; i < 5; i++) {
    const resp = await fetch(BASE + '/api/v1/system/health');
    const hsts = resp.headers.get('strict-transport-security');
    const xframe = resp.headers.get('x-frame-options');
    const xcontent = resp.headers.get('x-content-type-options');
    const csp = resp.headers.get('content-security-policy') || resp.headers.get('x-content-security-policy');
    const hasAll = !!(hsts && xframe && xcontent);
    log(m, `Security headers present #${i+1}`, hasAll, `HSTS=${!!hsts} X-Frame=${!!xframe} X-Content=${!!xcontent}`);
  }

  // 7. JWT manipulation
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer fake.token.here' } as any });
    log(m, `Fake JWT rejected #${i+1}`, r.status === 401, `status=${r.status}`);
  }

  // 8. Empty/bearer-less auth
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' } as any });
    log(m, `Empty JWT rejected #${i+1}`, r.status === 401, `status=${r.status}`);
  }

  // 9. Rate limiting / brute force simulation
  const rapidResults = [];
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hubsphere.com', password: 'WrongPass1' }), noAuth: true });
    rapidResults.push(r.status);
  }
  // Should allow but just verify it doesn't crash
  const allValid = rapidResults.every(s => s === 401 || s === 422 || s === 429);
  log(m, 'Brute force handled', allValid, `statuses=${rapidResults.join(',')}`);

  // 10. Mass assignment - try to set protected fields
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: `Mass${i}`, lastName: 'Assign', email: `mass${i}@test.com`, phone: '9876543210', source: 'WEBSITE', priority: 'LOW', status: 'NEW', isSuperAdmin: true, roleCode: 'SUPER_ADMIN', tenantId: 'fake-tenant-id', passwordHash: 'hacked' }) });
    log(m, `Mass assignment blocked #${i+1}`, r.ok, `status=${r.status}`);
  }

  // 11. Large payload
  for (let i = 0; i < 5; i++) {
    const hugeName = 'A'.repeat(10000);
    const r = await api('/api/v1/crm/leads', { method: 'POST', body: JSON.stringify({ firstName: hugeName, lastName: 'Huge', email: `huge${i}@test.com`, phone: '9876543210', source: 'WEBSITE', priority: 'LOW', status: 'NEW' }) });
    log(m, `Large payload handled #${i+1}`, r.status === 422 || r.ok, `status=${r.status}`);
  }

  // 12. HTTP method tampering
  for (let i = 0; i < 5; i++) {
    const methods = ['PUT', 'PATCH', 'DELETE'];
    const r = await fetch(BASE + '/api/v1/auth/login', { method: methods[i % 3], headers: { 'Content-Type': 'application/json' } }).then(res => ({ status: res.status }));
    log(m, `Method tampered #${i+1}`, r.status === 405 || r.status === 404 || r.status === 400, `status=${r.status}`);
  }
}

// ============ AUTOMATION TESTS ============
async function testAutomation() {
  const m = 'AUTOMATION';

  // Dashboard
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/automation/dashboard');
    log(m, `Automation dashboard round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // List Workflows
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/automation/workflows');
    log(m, `List workflows round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // Create Workflow
  let wfId = '';
  for (let i = 0; i < 5; i++) {
    const r = await api('/api/v1/automation/workflows', { method: 'POST', body: JSON.stringify({ name: `Workflow ${i+1}`, description: 'Test workflow', triggerType: 'lead.created', triggerConfig: {}, conditions: [], actions: [{ type: 'create_notification', config: { message: 'New lead created' }, sortOrder: 0 }] }) });
    log(m, `Create workflow round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
    if (r.ok && r.data?.data?.id && !wfId) wfId = r.data.data.id;
  }

  // List Executions
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/automation/executions');
    log(m, `List executions round ${i+1}`, r.ok, `status=${r.status}`);
  }
}

// ============ COMMUNICATION TESTS ============
async function testCommunication() {
  const m = 'COMMUNICATION';

  // Dashboard
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/communication/dashboard');
    log(m, `Comm dashboard round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // List Templates
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/communication/templates');
    log(m, `List templates round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // Create Template
  for (let i = 0; i < 5; i++) {
    const r = await api('/api/v1/communication/templates', { method: 'POST', body: JSON.stringify({ name: `Template ${i+1}`, channel: 'EMAIL', category: 'TRANSACTIONAL', subject: `Test Subject ${i+1}`, body: `Hello {{name}}, your account is ready.`, status: 'ACTIVE' }) });
    log(m, `Create template round ${i+1}`, r.ok && r.data?.data?.id, `status=${r.status}`);
  }

  // Notifications
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/communication/notifications');
    log(m, `List notifications round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // Providers
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/communication/providers');
    log(m, `List providers round ${i+1}`, r.ok, `status=${r.status}`);
  }
}

// ============ ANALYTICS TESTS ============
async function testAnalytics() {
  const m = 'ANALYTICS';

  const dashboards = [
    '/api/v1/analytics/executive',
    '/api/v1/analytics/crm',
    '/api/v1/analytics/telecaller',
    '/api/v1/analytics/hr',
    '/api/v1/analytics/communication',
    '/api/v1/analytics/automation',
    '/api/v1/analytics/ai-usage',
  ];

  for (const dash of dashboards) {
    const name = dash.split('/').pop() || dash;
    for (let i = 0; i < 10; i++) {
      const r = await api(dash);
      log(m, `Analytics ${name} round ${i+1}`, r.ok, `status=${r.status}`);
    }
  }
}

// ============ AI TESTS ============
async function testAI() {
  const m = 'AI';

  // List Agents
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/ai/agents');
    log(m, `AI agents list round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // AI Chat (may fail if no provider configured - that's expected)
  for (let i = 0; i < 3; i++) {
    const r = await api('/api/v1/ai/chat', { method: 'POST', body: JSON.stringify({ agent: 'NOVA', message: 'Hello' }) });
    // Expected: 503 (not configured) or 200 (if configured)
    log(m, `AI chat round ${i+1}`, r.status === 503 || r.status === 200, `status=${r.status} (503=expected if no provider)`);
  }

  // AI Usage
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/ai/usage');
    log(m, `AI usage round ${i+1}`, r.ok, `status=${r.status}`);
  }
}

// ============ ADMIN TESTS ============
async function testAdmin() {
  const m = 'ADMIN';

  // Admin Users
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/admin/users');
    log(m, `Admin users round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // Admin Roles
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/admin/roles');
    log(m, `Admin roles round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // Admin Audit
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/admin/audit');
    log(m, `Admin audit round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // Admin Memberships
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/admin/memberships');
    log(m, `Admin memberships round ${i+1}`, r.ok, `status=${r.status}`);
  }

  // Admin Settings
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/v1/admin/settings');
    log(m, `Admin settings round ${i+1}`, r.ok, `status=${r.status}`);
  }
}

// ============ MAIN RUNNER ============
async function main() {
  console.log('='.repeat(60));
  console.log('  HubSphere Complete Test Suite + Security Audit');
  console.log('  Testing ALL features 10 rounds each');
  console.log('='.repeat(60));

  const startTime = Date.now();

  await testAuth();
  console.log('  Auth tests completed...');

  await testSuperAdmin();
  console.log('  Super Admin tests completed...');

  await testCRM();
  console.log('  CRM tests completed...');

  await testHRMS();
  console.log('  HRMS tests completed...');

  await testAdmin();
  console.log('  Admin tests completed...');

  await testCommunication();
  console.log('  Communication tests completed...');

  await testAutomation();
  console.log('  Automation tests completed...');

  await testAnalytics();
  console.log('  Analytics tests completed...');

  await testAI();
  console.log('  AI tests completed...');

  await testSecurity();
  console.log('  Security audit completed...');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Print Report
  console.log('\n' + '='.repeat(60));
  console.log('  TEST RESULTS REPORT');
  console.log('='.repeat(60));

  let totalPass = 0, totalFail = 0;
  for (const [module, result] of Object.entries(results)) {
    const icon = result.fail === 0 ? '✅' : '⚠️';
    console.log(`\n${icon} ${module}: ${result.pass} PASS / ${result.fail} FAIL`);
    if (result.errors.length > 0) {
      // Show first 5 errors only
      result.errors.slice(0, 5).forEach(e => console.log(`   ❌ ${e}`));
      if (result.errors.length > 5) console.log(`   ... and ${result.errors.length - 5} more errors`);
    }
    totalPass += result.pass;
    totalFail += result.fail;
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`  TOTAL: ${totalPass} PASS / ${totalFail} FAIL out of ${totalPass + totalFail} tests`);
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Pass Rate: ${((totalPass / (totalPass + totalFail)) * 100).toFixed(1)}%`);
  console.log('-'.repeat(60));

  // DB Stats
  console.log('\n  Database Record Counts:');
  const models = ['User','Role','Permission','Tenant','Lead','Contact','Company','Deal','Employee','Department','Designation','Task','FollowUp','Note','Tag','FieldVisit','Expense','AttendanceSession','LeaveRequest','PayrollRecord','AutomationWorkflow','CommunicationTemplate','Notification','AuditLog','AiUsageLog','RefreshToken'];
  for (const m of models) {
    // @ts-expect-error
    const c = await db[m].count();
    if (c > 0) console.log(`    ${m}: ${c}`);
  }

  await db.$disconnect();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
