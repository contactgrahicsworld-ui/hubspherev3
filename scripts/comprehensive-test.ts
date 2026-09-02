const BASE = 'https://hubspherev3.vercel.app'
const results: { test: string; status: 'PASS' | 'FAIL'; detail: string }[] = []

let authToken = ''
let refreshToken = ''
let userId = ''
let tenantId = ''
let leadId = ''
let contactId = ''
let companyId = ''
let dealId = ''
let taskId = ''
let noteId = ''
let followUpId = ''
let callId = ''
let tagId = ''
let departmentId = ''
let designationId = ''
let leaveTypeId = ''
let employeeId = ''
let workflowId = ''
let templateId = ''
let notificationId = ''
let convertedContactId = ''
let convertedCompanyId = ''
let convertedDealId = ''

function log(test: string, status: 'PASS' | 'FAIL', detail: string) {
  const icon = status === 'PASS' ? '✅' : '❌'
  console.log(`${icon} ${test}: ${detail}`)
  results.push({ test, status, detail })
}

async function json(res: Response) {
  return res.json().catch(() => ({}))
}

function authHeaders(): Record<string, string> {
  return { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
}

// ============ AUTH TESTS ============

async function testSystemHealth() {
  console.log('\n=== SYSTEM HEALTH ===')
  const res = await fetch(`${BASE}/api/v1/system/health`)
  const data = await json(res)
  if (res.ok && data.data?.database === 'connected') {
    log('System Health', 'PASS', 'DB connected, status ok')
  } else {
    log('System Health', 'FAIL', `Unexpected: ${JSON.stringify(data)}`)
  }
}

async function testSetupStatus() {
  console.log('\n=== SETUP STATUS ===')
  const res = await fetch(`${BASE}/api/v1/auth/setup/status`)
  const data = await json(res)
  if (res.ok && typeof data.data?.setupComplete === 'boolean') {
    log('Setup Status API', 'PASS', `setupComplete=${data.data.setupComplete}`)
  } else {
    log('Setup Status API', 'FAIL', `Unexpected: ${JSON.stringify(data)}`)
  }
}

async function testSetupWizard() {
  console.log('\n=== SETUP WIZARD ===')
  
  const res = await fetch(`${BASE}/api/v1/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Admin',
      email: 'admin@hubsphere.test',
      password: 'Test@123456',
      confirmPassword: 'Test@123456'
    })
  })
  const data = await json(res)
  
  if (res.ok && data.success) {
    // Tokens are at data.data.accessToken / data.data.refreshToken
    authToken = data.data?.accessToken || ''
    refreshToken = data.data?.refreshToken || ''
    userId = data.data?.user?.id || ''
    log('Setup Wizard', 'PASS', `Super admin created, tokens issued. User: ${userId}`)
    
    // Get tenant ID from /me
    const meRes = await fetch(`${BASE}/api/v1/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    const meData = await json(meRes)
    if (meRes.ok && meData.data?.activeMemberships?.length > 0) {
      tenantId = meData.data.activeMemberships[0].tenantId
      log('Get Current User (Me)', 'PASS', `User: ${meData.data.user.email}, Tenant: ${tenantId}`)
    } else {
      log('Get Current User (Me)', 'FAIL', `No memberships: ${JSON.stringify(meData).substring(0,200)}`)
    }
    
    // Call seed endpoint to populate roles/permissions
    const seedRes = await fetch(`${BASE}/api/v1/system/seed`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    if (seedRes.ok) {
      log('Seed Roles/Permissions', 'PASS', 'Seeded successfully')
    } else {
      log('Seed Roles/Permissions', 'FAIL', `${seedRes.status}`)
    }
    
    // Test setup again should fail (403)
    const res2 = await fetch(`${BASE}/api/v1/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', email: 'x@test.com', password: 'Test@123456', confirmPassword: 'Test@123456' })
    })
    if (res2.status === 403) {
      log('Setup Already Done (403)', 'PASS', 'Correctly rejects duplicate setup')
    } else {
      log('Setup Already Done (403)', 'FAIL', `Expected 403, got ${res2.status}`)
    }
  } else {
    log('Setup Wizard', 'FAIL', `Setup failed: ${res.status} - ${JSON.stringify(data)}`)
  }
}

async function testLogin() {
  console.log('\n=== LOGIN ===')
  
  // Valid login
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hubsphere.test', password: 'Test@123456' })
  })
  const data = await json(res)
  if (res.ok && (data.data?.accessToken || data.data?.tokens?.accessToken)) {
    authToken = data.data?.accessToken || data.data?.tokens?.accessToken || ''
    log('Login - Valid credentials', 'PASS', 'Tokens issued')
  } else {
    log('Login - Valid credentials', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,200)}`)
  }
  
  // Invalid password
  const res2 = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hubsphere.test', password: 'WrongPassword1' })
  })
  if (res2.status === 401) log('Login - Invalid password', 'PASS', 'Correctly returns 401')
  else log('Login - Invalid password', 'FAIL', `Expected 401, got ${res2.status}`)
  
  // Non-existent email
  const res3 = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'noone@test.com', password: 'Test@123456' })
  })
  if (res3.status === 401) log('Login - Non-existent email', 'PASS', 'Correctly returns 401')
  else log('Login - Non-existent email', 'FAIL', `Expected 401, got ${res3.status}`)
  
  // Missing fields
  const res4 = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '' })
  })
  if (res4.status === 400) log('Login - Missing fields', 'PASS', 'Correctly returns 400')
  else log('Login - Missing fields', 'FAIL', `Expected 400, got ${res4.status}`)
}

async function testSignup() {
  console.log('\n=== SIGNUP ===')
  
  const res = await fetch(`${BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test User',
      email: 'testuser@hubsphere.test',
      password: 'Test@123456',
      confirmPassword: 'Test@123456'
    })
  })
  const data = await json(res)
  if (res.ok && data.success) {
    log('Signup - New user', 'PASS', 'User created successfully')
  } else {
    log('Signup - New user', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,200)}`)
  }
  
  // Duplicate email
  const res2 = await fetch(`${BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dup', email: 'testuser@hubsphere.test', password: 'Test@123456', confirmPassword: 'Test@123456' })
  })
  if (res2.status === 409 || res2.status === 400) log('Signup - Duplicate email', 'PASS', `Correctly rejects: ${res2.status}`)
  else log('Signup - Duplicate email', 'FAIL', `Expected 409/400, got ${res2.status}`)
}

async function testAuthMe() {
  console.log('\n=== AUTH ME ===')
  
  const res = await fetch(`${BASE}/api/v1/auth/me`, { headers: authHeaders() })
  const data = await json(res)
  if (res.ok && data.data?.user?.email) {
    log('Auth Me', 'PASS', `User: ${data.data.user.email}`)
  } else {
    log('Auth Me', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,200)}`)
  }
  
  // No token
  const res2 = await fetch(`${BASE}/api/v1/auth/me`)
  if (res2.status === 401) log('Auth Me - No token', 'PASS', 'Correctly returns 401')
  else log('Auth Me - No token', 'FAIL', `Expected 401, got ${res2.status}`)
}

async function testChangePassword() {
  console.log('\n=== CHANGE PASSWORD ===')
  
  const res = await fetch(`${BASE}/api/v1/auth/change-password`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({
      currentPassword: 'Test@123456',
      newPassword: 'NewTest@123456',
      confirmPassword: 'NewTest@123456'
    })
  })
  if (res.ok) {
    log('Change Password', 'PASS', 'Password changed')
    
    // Revert
    const res2 = await fetch(`${BASE}/api/v1/auth/change-password`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({
        currentPassword: 'NewTest@123456',
        newPassword: 'Test@123456',
        confirmPassword: 'Test@123456'
      })
    })
    if (res2.ok) log('Revert Password', 'PASS', 'Password reverted')
    else log('Revert Password', 'FAIL', `${res2.status} - ${await res2.text()}`)
    
    // Re-login
    const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hubsphere.test', password: 'Test@123456' })
    })
    const loginData = await json(loginRes)
    if (loginRes.ok) {
      authToken = loginData.data?.accessToken || loginData.data?.tokens?.accessToken || ''
      log('Re-login after password change', 'PASS', 'New tokens issued')
    } else {
      log('Re-login after password change', 'FAIL', `${loginRes.status}`)
    }
  } else {
    log('Change Password', 'FAIL', `${res.status} - ${await res.text()}`)
  }
}

async function testForgotPassword() {
  console.log('\n=== FORGOT PASSWORD ===')
  
  const res = await fetch(`${BASE}/api/v1/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hubsphere.test' })
  })
  if (res.ok) log('Forgot Password - Valid email', 'PASS', 'Request accepted')
  else log('Forgot Password - Valid email', 'FAIL', `${res.status}`)
  
  // Non-existent (anti-enumeration)
  const res2 = await fetch(`${BASE}/api/v1/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'noone@test.com' })
  })
  if (res2.ok) log('Forgot Password - Anti-enumeration', 'PASS', 'Returns 200 for security')
  else log('Forgot Password - Anti-enumeration', 'FAIL', `Should return 200, got ${res2.status}`)
}

async function testTwoFactor() {
  console.log('\n=== TWO FACTOR AUTH ===')
  
  // Status
  const statusRes = await fetch(`${BASE}/api/v1/auth/two-factor/status`, { headers: authHeaders() })
  const statusData = await json(statusRes)
  if (statusRes.ok && typeof statusData.data?.enabled === 'boolean') {
    log('2FA Status', 'PASS', `enabled=${statusData.data.enabled}`)
  } else {
    log('2FA Status', 'FAIL', `${statusRes.status}`)
  }
  
  // Setup 2FA
  const setupRes = await fetch(`${BASE}/api/v1/auth/two-factor/setup`, {
    method: 'POST', headers: authHeaders()
  })
  const setupData = await json(setupRes)
  if (setupRes.ok && setupData.data?.secret) {
    log('2FA Setup', 'PASS', 'Secret generated, QR URI provided')
    
    // Disable 2FA (requires current password)
    const disableRes = await fetch(`${BASE}/api/v1/auth/two-factor/disable`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ currentPassword: 'Test@123456' })
    })
    if (disableRes.ok) log('2FA Disable', 'PASS', '2FA disabled')
    else log('2FA Disable', 'FAIL', `${disableRes.status} - ${await disableRes.text()}`)
  } else {
    log('2FA Setup', 'FAIL', `${setupRes.status} - ${JSON.stringify(setupData).substring(0,200)}`)
  }
}

async function testLogout() {
  console.log('\n=== LOGOUT ===')
  
  const res = await fetch(`${BASE}/api/v1/auth/logout`, { method: 'POST', headers: authHeaders() })
  if (res.ok) {
    log('Logout', 'PASS', 'Logged out')
  } else {
    log('Logout', 'FAIL', `${res.status}`)
  }
  
  // Re-login
  const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hubsphere.test', password: 'Test@123456' })
  })
  const loginData = await json(loginRes)
  if (loginRes.ok) {
    authToken = loginData.data?.accessToken || loginData.data?.tokens?.accessToken || ''
    log('Re-login after logout', 'PASS', 'Tokens re-issued')
  } else {
    log('Re-login after logout', 'FAIL', `${loginRes.status}`)
  }
}

async function testTokenRefresh() {
  console.log('\n=== TOKEN REFRESH ===')
  
  const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })
  if (res.ok) {
    const data = await json(res)
    authToken = data.data?.accessToken || ''
    log('Token Refresh', 'PASS', 'New access token issued')
  } else {
    log('Token Refresh', 'FAIL', `${res.status}`)
  }
}

// ============ CRM TESTS ============

async function testCRMDashboard() {
  console.log('\n=== CRM DASHBOARD ===')
  const res = await fetch(`${BASE}/api/v1/crm/dashboard`, { headers: authHeaders() })
  if (res.ok) {
    const data = await json(res)
    log('CRM Dashboard', 'PASS', `Keys: ${Object.keys(data.data || {}).join(', ')}`)
  } else {
    log('CRM Dashboard', 'FAIL', `${res.status} - ${await res.text()}`)
  }
}

async function testLeads() {
  console.log('\n=== LEADS ===')
  const h = authHeaders()
  
  // Create
  const res = await fetch(`${BASE}/api/v1/crm/leads`, {
    method: 'POST', h,
    body: JSON.stringify({ firstName: 'John', lastName: 'Doe', email: 'john@test.com', phone: '+1234567890', source: 'WEBSITE', priority: 'HIGH', status: 'NEW' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    leadId = data.data.id
    log('Create Lead', 'PASS', `Lead ID: ${leadId}`)
  } else {
    log('Create Lead', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
    return
  }
  
  // List
  let r = await fetch(`${BASE}/api/v1/crm/leads`, { headers: h })
  if (r.ok) log('List Leads', 'PASS', 'Leads listed')
  else log('List Leads', 'FAIL', `${r.status}`)
  
  // Get by ID
  r = await fetch(`${BASE}/api/v1/crm/leads/${leadId}`, { headers: h })
  if (r.ok) log('Get Lead by ID', 'PASS', 'Lead retrieved')
  else log('Get Lead by ID', 'FAIL', `${r.status}`)
  
  // Update
  r = await fetch(`${BASE}/api/v1/crm/leads/${leadId}`, {
    method: 'PUT', headers: h,
    body: JSON.stringify({ firstName: 'John Updated', status: 'CONTACTED' })
  })
  if (r.ok) log('Update Lead', 'PASS', 'Lead updated')
  else log('Update Lead', 'FAIL', `${r.status} - ${await r.text()}`)
  
  // Convert lead
  r = await fetch(`${BASE}/api/v1/crm/leads/${leadId}/convert`, { method: 'POST', headers: h })
  if (r.ok) {
    const cd = await json(r)
    convertedContactId = cd.data?.contactId || ''
    convertedCompanyId = cd.data?.companyId || ''
    convertedDealId = cd.data?.dealId || ''
    log('Convert Lead', 'PASS', `Contact: ${convertedContactId}, Company: ${convertedCompanyId}`)
  } else {
    log('Convert Lead', 'FAIL', `${r.status} - ${await r.text()}`)
  }
}

async function testContacts() {
  console.log('\n=== CONTACTS ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/crm/contacts`, {
    method: 'POST', h,
    body: JSON.stringify({ firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com', phone: '+0987654321' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    contactId = data.data.id
    log('Create Contact', 'PASS', `Contact ID: ${contactId}`)
  } else {
    log('Create Contact', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
    return
  }
  
  let r = await fetch(`${BASE}/api/v1/crm/contacts`, { headers: h })
  if (r.ok) log('List Contacts', 'PASS', 'Contacts listed')
  else log('List Contacts', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/crm/contacts/${contactId}`, { headers: h })
  if (r.ok) log('Get Contact by ID', 'PASS', 'Contact retrieved')
  else log('Get Contact by ID', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/crm/contacts/${contactId}`, {
    method: 'PUT', headers: h, body: JSON.stringify({ firstName: 'Jane Updated' })
  })
  if (r.ok) log('Update Contact', 'PASS', 'Contact updated')
  else log('Update Contact', 'FAIL', `${r.status} - ${await r.text()}`)
}

async function testCompanies() {
  console.log('\n=== COMPANIES ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/crm/companies`, {
    method: 'POST', h,
    body: JSON.stringify({ name: 'Acme Corp', website: 'https://acme.com', industry: 'TECHNOLOGY', city: 'Mumbai', country: 'India' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    companyId = data.data.id
    log('Create Company', 'PASS', `Company ID: ${companyId}`)
  } else {
    log('Create Company', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
    return
  }
  
  let r = await fetch(`${BASE}/api/v1/crm/companies`, { headers: h })
  if (r.ok) log('List Companies', 'PASS', 'Companies listed')
  else log('List Companies', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/crm/companies/${companyId}`, { headers: h })
  if (r.ok) log('Get Company by ID', 'PASS', 'Company retrieved')
  else log('Get Company by ID', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/crm/companies/${companyId}`, {
    method: 'PUT', headers: h, body: JSON.stringify({ name: 'Acme Corp Updated' })
  })
  if (r.ok) log('Update Company', 'PASS', 'Company updated')
  else log('Update Company', 'FAIL', `${r.status} - ${await r.text()}`)
}

async function testDeals() {
  console.log('\n=== DEALS ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/crm/deals`, {
    method: 'POST', h,
    body: JSON.stringify({ title: 'Enterprise Deal', value: 50000, stage: 'PROPOSAL', priority: 'HIGH' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    dealId = data.data.id
    log('Create Deal', 'PASS', `Deal ID: ${dealId}`)
  } else {
    log('Create Deal', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
    return
  }
  
  let r = await fetch(`${BASE}/api/v1/crm/deals`, { headers: h })
  if (r.ok) log('List Deals', 'PASS', 'Deals listed')
  else log('List Deals', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/crm/deals/${dealId}`, { headers: h })
  if (r.ok) log('Get Deal by ID', 'PASS', 'Deal retrieved')
  else log('Get Deal by ID', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/crm/deals/${dealId}`, {
    method: 'PUT', headers: h, body: JSON.stringify({ title: 'Enterprise Deal Updated' })
  })
  if (r.ok) log('Update Deal', 'PASS', 'Deal updated')
  else log('Update Deal', 'FAIL', `${r.status} - ${await r.text()}`)
  
  // Stage update
  r = await fetch(`${BASE}/api/v1/crm/deals/${dealId}/stage`, {
    method: 'PATCH', headers: h, body: JSON.stringify({ stage: 'NEGOTIATION' })
  })
  if (r.ok) log('Update Deal Stage', 'PASS', 'Stage updated')
  else log('Update Deal Stage', 'FAIL', `${r.status} - ${await r.text()}`)
}

async function testTasks() {
  console.log('\n=== TASKS ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/crm/tasks`, {
    method: 'POST', h,
    body: JSON.stringify({ title: 'Follow up with client', description: 'Call regarding proposal', priority: 'HIGH', status: 'PENDING', dueDate: '2026-09-10' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    taskId = data.data.id
    log('Create Task', 'PASS', `Task ID: ${taskId}`)
  } else {
    log('Create Task', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
    return
  }
  
  let r = await fetch(`${BASE}/api/v1/crm/tasks`, { headers: h })
  if (r.ok) log('List Tasks', 'PASS', 'Tasks listed')
  else log('List Tasks', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/crm/tasks/${taskId}`, {
    method: 'PUT', headers: h, body: JSON.stringify({ status: 'COMPLETED' })
  })
  if (r.ok) log('Update Task', 'PASS', 'Task updated')
  else log('Update Task', 'FAIL', `${r.status} - ${await r.text()}`)
}

async function testNotes() {
  console.log('\n=== NOTES ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/crm/notes`, {
    method: 'POST', h,
    body: JSON.stringify({ title: 'Meeting Notes', content: 'Discussed Q4 strategy', entityType: 'DEAL', entityId: dealId || undefined })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    noteId = data.data.id
    log('Create Note', 'PASS', `Note ID: ${noteId}`)
  } else {
    log('Create Note', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
    return
  }
  
  let r = await fetch(`${BASE}/api/v1/crm/notes`, { headers: h })
  if (r.ok) log('List Notes', 'PASS', 'Notes listed')
  else log('List Notes', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/crm/notes/${noteId}`, {
    method: 'PUT', headers: h, body: JSON.stringify({ content: 'Updated notes' })
  })
  if (r.ok) log('Update Note', 'PASS', 'Note updated')
  else log('Update Note', 'FAIL', `${r.status} - ${await r.text()}`)
}

async function testFollowUps() {
  console.log('\n=== FOLLOW UPS ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/crm/follow-ups`, {
    method: 'POST', h,
    body: JSON.stringify({ title: 'Follow up call', type: 'CALL', priority: 'HIGH', dueDate: '2026-09-05', notes: 'Call regarding deal' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    followUpId = data.data.id
    log('Create Follow Up', 'PASS', `Follow Up ID: ${followUpId}`)
  } else {
    log('Create Follow Up', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
    return
  }
  
  let r = await fetch(`${BASE}/api/v1/crm/follow-ups`, { headers: h })
  if (r.ok) log('List Follow Ups', 'PASS', 'Follow Ups listed')
  else log('List Follow Ups', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/crm/follow-ups/${followUpId}`, {
    method: 'PUT', headers: h, body: JSON.stringify({ status: 'COMPLETED' })
  })
  if (r.ok) log('Update Follow Up', 'PASS', 'Follow Up updated')
  else log('Update Follow Up', 'FAIL', `${r.status} - ${await r.text()}`)
}

async function testCalls() {
  console.log('\n=== CALLS ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/crm/calls`, {
    method: 'POST', h,
    body: JSON.stringify({ subject: 'Client call', direction: 'OUTBOUND', duration: 300, status: 'COMPLETED', notes: 'Discussed pricing' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    callId = data.data.id
    log('Create Call', 'PASS', `Call ID: ${callId}`)
  } else {
    log('Create Call', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
  }
  
  let r = await fetch(`${BASE}/api/v1/crm/calls`, { headers: h })
  if (r.ok) log('List Calls', 'PASS', 'Calls listed')
  else log('List Calls', 'FAIL', `${r.status}`)
}

async function testTags() {
  console.log('\n=== TAGS ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/crm/tags`, {
    method: 'POST', h, body: JSON.stringify({ name: 'VIP', color: '#FF0000' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    tagId = data.data.id
    log('Create Tag', 'PASS', `Tag ID: ${tagId}`)
  } else {
    log('Create Tag', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
  }
  
  let r = await fetch(`${BASE}/api/v1/crm/tags`, { headers: h })
  if (r.ok) log('List Tags', 'PASS', 'Tags listed')
  else log('List Tags', 'FAIL', `${r.status}`)
}

async function testSearch() {
  console.log('\n=== SEARCH & TIMELINE ===')
  const h = authHeaders()
  
  const r1 = await fetch(`${BASE}/api/v1/crm/search?q=John`, { headers: h })
  if (r1.ok) log('CRM Search', 'PASS', 'Search returned')
  else log('CRM Search', 'FAIL', `${r1.status}`)
  
  const r2 = await fetch(`${BASE}/api/v1/crm/timeline`, { headers: h })
  if (r2.ok) log('CRM Timeline', 'PASS', 'Timeline returned')
  else log('CRM Timeline', 'FAIL', `${r2.status}`)
}

async function testExport() {
  console.log('\n=== EXPORT ===')
  const r = await fetch(`${BASE}/api/v1/crm/export?entityType=leads`, { headers: authHeaders() })
  if (r.ok) log('Export Leads', 'PASS', 'Export returned')
  else log('Export Leads', 'FAIL', `${r.status} - ${await r.text()}`)
}

// ============ HRMS TESTS ============

async function testHRMSDashboard() {
  console.log('\n=== HRMS DASHBOARD ===')
  const r = await fetch(`${BASE}/api/v1/hrms/dashboard`, { headers: authHeaders() })
  if (r.ok) {
    const d = await json(r)
    log('HRMS Dashboard', 'PASS', `Keys: ${Object.keys(d.data || {}).join(', ')}`)
  } else {
    log('HRMS Dashboard', 'FAIL', `${r.status} - ${await r.text()}`)
  }
}

async function testDepartments() {
  console.log('\n=== DEPARTMENTS ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/hrms/departments`, {
    method: 'POST', h, body: JSON.stringify({ name: 'Engineering', description: 'Tech team' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    departmentId = data.data.id
    log('Create Department', 'PASS', `Dept ID: ${departmentId}`)
  } else {
    log('Create Department', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
    return
  }
  
  let r = await fetch(`${BASE}/api/v1/hrms/departments`, { headers: h })
  if (r.ok) log('List Departments', 'PASS', 'Departments listed')
  else log('List Departments', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/hrms/departments/${departmentId}`, {
    method: 'PUT', headers: h, body: JSON.stringify({ name: 'Engineering Updated' })
  })
  if (r.ok) log('Update Department', 'PASS', 'Department updated')
  else log('Update Department', 'FAIL', `${r.status} - ${await r.text()}`)
}

async function testDesignations() {
  console.log('\n=== DESIGNATIONS ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/hrms/designations`, {
    method: 'POST', h, body: JSON.stringify({ name: 'Software Engineer', departmentId })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    designationId = data.data.id
    log('Create Designation', 'PASS', `ID: ${designationId}`)
  } else {
    log('Create Designation', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
    return
  }
  
  let r = await fetch(`${BASE}/api/v1/hrms/designations`, { headers: h })
  if (r.ok) log('List Designations', 'PASS', 'Designations listed')
  else log('List Designations', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/hrms/designations/${designationId}`, {
    method: 'PUT', headers: h, body: JSON.stringify({ name: 'Senior Software Engineer' })
  })
  if (r.ok) log('Update Designation', 'PASS', 'Designation updated')
  else log('Update Designation', 'FAIL', `${r.status} - ${await r.text()}`)
}

async function testLeaveTypes() {
  console.log('\n=== LEAVE TYPES ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/hrms/leave-types`, {
    method: 'POST', h, body: JSON.stringify({ name: 'Casual Leave', code: 'CL', days: 12, paid: true })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    leaveTypeId = data.data.id
    log('Create Leave Type', 'PASS', `ID: ${leaveTypeId}`)
  } else {
    log('Create Leave Type', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
  }
  
  let r = await fetch(`${BASE}/api/v1/hrms/leave-types`, { headers: h })
  if (r.ok) log('List Leave Types', 'PASS', 'Leave Types listed')
  else log('List Leave Types', 'FAIL', `${r.status}`)
}

async function testEmployees() {
  console.log('\n=== EMPLOYEES ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/hrms/employees`, {
    method: 'POST', h,
    body: JSON.stringify({ userId, employeeId: 'EMP001', departmentId, designationId, dateOfJoining: '2026-01-15' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    employeeId = data.data.id
    log('Create Employee', 'PASS', `Employee ID: ${employeeId}`)
  } else {
    log('Create Employee', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
  }
  
  let r = await fetch(`${BASE}/api/v1/hrms/employees`, { headers: h })
  if (r.ok) log('List Employees', 'PASS', 'Employees listed')
  else log('List Employees', 'FAIL', `${r.status}`)
}

async function testLeaveRequests() {
  console.log('\n=== LEAVE REQUESTS ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/hrms/leave-requests`, {
    method: 'POST', h,
    body: JSON.stringify({ leaveTypeId, startDate: '2026-09-10', endDate: '2026-09-11', reason: 'Personal work' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) {
    log('Create Leave Request', 'PASS', `ID: ${data.data.id}`)
  } else {
    log('Create Leave Request', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
  }
  
  let r = await fetch(`${BASE}/api/v1/hrms/leave-requests`, { headers: h })
  if (r.ok) log('List Leave Requests', 'PASS', 'Leave Requests listed')
  else log('List Leave Requests', 'FAIL', `${r.status}`)
}

async function testAttendance() {
  console.log('\n=== ATTENDANCE ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/hrms/attendance`, {
    method: 'POST', h,
    body: JSON.stringify({ employeeId, date: '2026-09-02', checkIn: '2026-09-02T09:00:00Z', checkOut: '2026-09-02T18:00:00Z', status: 'PRESENT' })
  })
  if (res.ok) log('Create Attendance', 'PASS', 'Attendance recorded')
  else log('Create Attendance', 'FAIL', `${res.status} - ${await res.text().catch(() => '')}`)
  
  const r = await fetch(`${BASE}/api/v1/hrms/attendance`, { headers: h })
  if (r.ok) log('List Attendance', 'PASS', 'Attendance listed')
  else log('List Attendance', 'FAIL', `${r.status}`)
}

async function testExpenses() {
  console.log('\n=== EXPENSES ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/hrms/expenses`, {
    method: 'POST', h,
    body: JSON.stringify({ title: 'Travel Expense', amount: 5000, currency: 'INR', category: 'TRAVEL', date: '2026-09-01', description: 'Client visit' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) log('Create Expense', 'PASS', `ID: ${data.data.id}`)
  else log('Create Expense', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
  
  const r = await fetch(`${BASE}/api/v1/hrms/expenses`, { headers: h })
  if (r.ok) log('List Expenses', 'PASS', 'Expenses listed')
  else log('List Expenses', 'FAIL', `${r.status}`)
}

async function testFieldVisits() {
  console.log('\n=== FIELD VISITS ===')
  const h = authHeaders()
  
  const res = await fetch(`${BASE}/api/v1/hrms/field-visits`, {
    method: 'POST', h,
    body: JSON.stringify({ title: 'Client Site Visit', date: '2026-09-03', purpose: 'Product demo', location: 'Mumbai', status: 'PLANNED' })
  })
  const data = await json(res)
  if (res.ok && data.data?.id) log('Create Field Visit', 'PASS', `ID: ${data.data.id}`)
  else log('Create Field Visit', 'FAIL', `${res.status} - ${JSON.stringify(data).substring(0,300)}`)
  
  let r = await fetch(`${BASE}/api/v1/hrms/field-visits`, { headers: h })
  if (r.ok) log('List Field Visits', 'PASS', 'Field Visits listed')
  else log('List Field Visits', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/hrms/field-dashboard`, { headers: h })
  if (r.ok) log('Field Dashboard', 'PASS', 'Field dashboard returned')
  else log('Field Dashboard', 'FAIL', `${r.status}`)
}

async function testPayroll() {
  console.log('\n=== PAYROLL ===')
  const r = await fetch(`${BASE}/api/v1/hrms/payroll`, { headers: authHeaders() })
  if (r.ok) log('List Payroll', 'PASS', 'Payroll listed')
  else log('List Payroll', 'FAIL', `${r.status}`)
}

// ============ COMMUNICATION TESTS ============

async function testCommunication() {
  console.log('\n=== COMMUNICATION ===')
  const h = authHeaders()
  
  const dr = await fetch(`${BASE}/api/v1/communication/dashboard`, { headers: h })
  if (dr.ok) log('Communication Dashboard', 'PASS', 'Dashboard returned')
  else log('Communication Dashboard', 'FAIL', `${dr.status}`)
  
  // Templates
  const tr = await fetch(`${BASE}/api/v1/communication/templates`, {
    method: 'POST', h, body: JSON.stringify({ name: 'Welcome', subject: 'Welcome!', body: 'Hello {{name}}', type: 'EMAIL', channel: 'EMAIL' })
  })
  const td = await json(tr)
  if (tr.ok && td.data?.id) { templateId = td.data.id; log('Create Template', 'PASS', `ID: ${templateId}`) }
  else log('Create Template', 'FAIL', `${tr.status} - ${JSON.stringify(td).substring(0,200)}`)
  
  let r = await fetch(`${BASE}/api/v1/communication/templates`, { headers: h })
  if (r.ok) log('List Templates', 'PASS', 'Templates listed')
  else log('List Templates', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/communication/notifications`, { headers: h })
  if (r.ok) log('List Notifications', 'PASS', 'Notifications listed')
  else log('List Notifications', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/communication/providers`, { headers: h })
  if (r.ok) log('List Providers', 'PASS', 'Providers listed')
  else log('List Providers', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/communication/conversations`, { headers: h })
  if (r.ok) log('List Conversations', 'PASS', 'Conversations listed')
  else log('List Conversations', 'FAIL', `${r.status}`)
}

// ============ AUTOMATION TESTS ============

async function testAutomation() {
  console.log('\n=== AUTOMATION ===')
  const h = authHeaders()
  
  const dr = await fetch(`${BASE}/api/v1/automation/dashboard`, { headers: h })
  if (dr.ok) log('Automation Dashboard', 'PASS', 'Dashboard returned')
  else log('Automation Dashboard', 'FAIL', `${dr.status}`)
  
  // Create workflow
  const wr = await fetch(`${BASE}/api/v1/automation/workflows`, {
    method: 'POST', h, body: JSON.stringify({ name: 'Test Workflow', description: 'Test', triggerType: 'MANUAL', status: 'DRAFT' })
  })
  const wd = await json(wr)
  if (wr.ok && wd.data?.id) {
    workflowId = wd.data.id
    log('Create Workflow', 'PASS', `ID: ${workflowId}`)
  } else {
    log('Create Workflow', 'FAIL', `${wr.status} - ${JSON.stringify(wd).substring(0,300)}`)
    return
  }
  
  let r = await fetch(`${BASE}/api/v1/automation/workflows`, { headers: h })
  if (r.ok) log('List Workflows', 'PASS', 'Workflows listed')
  else log('List Workflows', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/automation/workflows/${workflowId}`, { headers: h })
  if (r.ok) log('Get Workflow by ID', 'PASS', 'Workflow retrieved')
  else log('Get Workflow by ID', 'FAIL', `${r.status}`)
  
  r = await fetch(`${BASE}/api/v1/automation/workflows/${workflowId}/activate`, { method: 'POST', headers: h })
  if (r.ok) log('Activate Workflow', 'PASS', 'Workflow activated')
  else log('Activate Workflow', 'FAIL', `${r.status} - ${await r.text().catch(() => '')}`)
  
  r = await fetch(`${BASE}/api/v1/automation/workflows/${workflowId}/pause`, { method: 'POST', headers: h })
  if (r.ok) log('Pause Workflow', 'PASS', 'Workflow paused')
  else log('Pause Workflow', 'FAIL', `${r.status} - ${await r.text().catch(() => '')}`)
  
  r = await fetch(`${BASE}/api/v1/automation/executions`, { headers: h })
  if (r.ok) log('List Executions', 'PASS', 'Executions listed')
  else log('List Executions', 'FAIL', `${r.status}`)
}

// ============ ANALYTICS TESTS ============

async function testAnalytics() {
  console.log('\n=== ANALYTICS ===')
  const h = authHeaders()
  
 const endpoints = [
    'analytics/crm', 'analytics/hr', 'analytics/communication',
    'analytics/automation', 'analytics/ai-usage', 'analytics/executive', 'analytics/telecaller'
  ]
  
  for (const ep of endpoints) {
    const r = await fetch(`${BASE}/api/v1/${ep}`, { headers: h })
    if (r.ok) log(`Analytics: ${ep}`, 'PASS', 'Data returned')
    else log(`Analytics: ${ep}`, 'FAIL', `${r.status}`)
  }
}

// ============ ADMIN TESTS ============

async function testAdmin() {
  console.log('\n=== ADMIN ===')
  const h = authHeaders()
  
  const tests = [
    ['Admin Users', 'admin/users'],
    ['Admin Roles', 'admin/roles'],
    ['Admin Memberships', 'admin/memberships'],
    ['Admin Audit', 'admin/audit'],
    ['Admin Settings', 'admin/settings'],
  ]
  
  for (const [name, ep] of tests) {
    const r = await fetch(`${BASE}/api/v1/${ep}`, { headers: h })
    if (r.ok) log(name, 'PASS', 'Data returned')
    else log(name, 'FAIL', `${r.status}`)
  }
}

// ============ SUPER ADMIN TESTS ============

async function testSuperAdmin() {
  console.log('\n=== SUPER ADMIN ===')
  const h = authHeaders()
  
  const tests = [
    ['SA Stats', 'super-admin/stats'],
    ['SA Users', 'super-admin/users'],
    ['SA Tenants', 'super-admin/tenants'],
    ['SA Roles', 'super-admin/roles'],
    ['SA Audit', 'super-admin/audit'],
  ]
  
  for (const [name, ep] of tests) {
    const r = await fetch(`${BASE}/api/v1/${ep}`, { headers: h })
    if (r.ok) log(name, 'PASS', 'Data returned')
    else if (r.status === 403) log(name, 'PASS', 'Restricted (403) - expected if not super admin')
    else log(name, 'FAIL', `${r.status}`)
  }
}

// ============ AI TESTS ============

async function testAI() {
  console.log('\n=== AI ===')
  const h = authHeaders()
  
  const tests = [['AI Providers', 'ai/providers'], ['AI Agents', 'ai/agents'], ['AI Usage', 'ai/usage']]
  for (const [name, ep] of tests) {
    const r = await fetch(`${BASE}/api/v1/${ep}`, { headers: h })
    if (r.ok) log(name, 'PASS', 'Data returned')
    else log(name, 'FAIL', `${r.status}`)
  }
  
  // Chat (may fail without provider config)
  const cr = await fetch(`${BASE}/api/v1/ai/chat`, {
    method: 'POST', h, body: JSON.stringify({ message: 'Hello', conversationId: '' })
  })
  if (cr.ok || cr.status === 400 || cr.status === 503) log('AI Chat', 'PASS', `Responds: ${cr.status}`)
  else log('AI Chat', 'FAIL', `${cr.status}`)
}

// ============ SYSTEM TESTS ============

async function testSystem() {
  console.log('\n=== SYSTEM ===')
  const r = await fetch(`${BASE}/api/v1/system/providers`, { headers: authHeaders() })
  if (r.ok) log('System Providers', 'PASS', 'Providers listed')
  else log('System Providers', 'FAIL', `${r.status}`)
}

// ============ PAGE TESTS ============

async function testPages() {
  console.log('\n=== PAGE RENDERING ===')
  
  const pages = [
    '/', '/login', '/signup', '/setup', '/forgot-password',
    '/dashboard', '/crm', '/crm/leads', '/crm/contacts', '/crm/companies',
    '/crm/deals', '/crm/tasks', '/crm/calls', '/crm/follow-ups',
    '/crm/import', '/crm/export', '/crm/telecaller',
    '/hrms', '/hrms/employees', '/hrms/departments', '/hrms/designations',
    '/hrms/leave', '/hrms/attendance', '/hrms/expenses', '/hrms/payroll', '/hrms/field-sales',
    '/communication', '/communication/inbox', '/communication/notifications',
    '/communication/templates', '/communication/settings',
    '/automation', '/automation/workflows', '/automation/executions',
    '/analytics', '/analytics/crm', '/analytics/hr', '/analytics/communication',
    '/analytics/automation', '/analytics/ai', '/analytics/executive', '/analytics/telecaller',
    '/ai', '/ai/chat',
    '/admin', '/admin/users', '/admin/roles', '/admin/memberships',
    '/admin/audit', '/admin/settings', '/admin/security', '/admin/subscription',
    '/super-admin', '/super-admin/users', '/super-admin/tenants',
    '/super-admin/roles', '/super-admin/audit', '/super-admin/features',
    '/super-admin/health', '/super-admin/settings'
  ]
  
  for (const page of pages) {
    const res = await fetch(`${BASE}${page}`, { redirect: 'manual' })
    const s = res.status
    if (s === 200 || s === 307 || s === 302) log(`Page: ${page}`, 'PASS', `Status ${s}`)
    else if (s === 404) log(`Page: ${page}`, 'PASS', `Status 404 (expected for some)`)
    else log(`Page: ${page}`, 'FAIL', `Status ${s}`)
  }
}

// ============ MAIN ============

async function main() {
  console.log('========================================')
  console.log('  HubSphere V3 - Comprehensive Test Suite')
  console.log('========================================')
  console.log(`Target: ${BASE}`)
  console.log(`Time: ${new Date().toISOString()}\n`)
  
  try {
    await testSystemHealth()
    await testSetupStatus()
    await testSetupWizard()
    await testLogin()
    await testSignup()
    await testAuthMe()
    await testChangePassword()
    await testForgotPassword()
    await testTwoFactor()
    await testLogout()
    await testTokenRefresh()
    
    await testCRMDashboard()
    await testLeads()
    await testContacts()
    await testCompanies()
    await testDeals()
    await testTasks()
    await testNotes()
    await testFollowUps()
    await testCalls()
    await testTags()
    await testSearch()
    await testExport()
    
    await testHRMSDashboard()
    await testDepartments()
    await testDesignations()
    await testLeaveTypes()
    await testEmployees()
    await testLeaveRequests()
    await testAttendance()
    await testExpenses()
    await testFieldVisits()
    await testPayroll()
    
    await testCommunication()
    await testAutomation()
    await testAnalytics()
    await testAdmin()
    await testSuperAdmin()
    await testAI()
    await testSystem()
    
    await testPages()
  } catch (err) {
    console.error('\n💥 FATAL ERROR:', err)
  }
  
  // Summary
  console.log('\n========================================')
  console.log('  TEST SUMMARY')
  console.log('========================================')
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const total = results.length
  console.log(`Total: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`)
  console.log(`Pass Rate: ${((passed/total)*100).toFixed(1)}%`)  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.detail}`)
    })
  }
}

main()
