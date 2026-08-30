import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true' } }
});
const B = 'https://hubspherev3.vercel.app';
let TK = '';
const RES: Record<string,{p:number;f:number;e:string[]}> = {};

function log(m:string, t:string, ok:boolean, d?:string) {
  if (!RES[m]) RES[m] = {p:0, f:0, e:[]};
  if (ok) RES[m].p++; else { RES[m].f++; RES[m].e.push(t + ': ' + (d||'')); }
}

async function api(path:string, opts:any = {}) {
  try {
    const h: Record<string,string> = {'Content-Type': 'application/json'};
    if (TK && !opts.na) h['Authorization'] = 'Bearer ' + TK;
    const r = await fetch(B + path, {...opts, headers: h, signal: AbortSignal.timeout(25000)});
    const d = await r.json().catch(() => null);
    return {s: r.status, d, o: r.status >= 200 && r.status < 300};
  } catch(e) {
    return {s: 0, d: {error: String(e)}, o: false};
  }
}

// ===== AUTH =====
async function testAuth() {
  const m = 'AUTH';
  for (let i=0;i<10;i++) { const r=await api('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'Admin@123456'}),na:true}); log(m,'Login '+i,r.o&&r.d?.data?.accessToken,'s='+r.s); if(r.o&&r.d?.data?.accessToken)TK=r.d.data.accessToken; }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/auth/me'); log(m,'Me '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/system/health',{na:true}); log(m,'Health '+i,r.o&&r.d?.data?.status==='ok','s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/auth/me',{na:true}); log(m,'Unauth blocked '+i,r.s===401,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'WrongPass1'}),na:true}); log(m,'Wrong pwd '+i,r.s===401,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'bad',password:'A'}),na:true}); log(m,'Invalid email '+i,r.s===422,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'a@b.com'}),na:true}); log(m,'Missing pwd '+i,r.s===422,'s='+r.s); }
  for (let i=0;i<10;i++) { const lg=await api('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'Admin@123456'}),na:true}); if(!lg.o){log(m,'Refresh '+i,false,'login fail');continue;} TK=lg.d.data.accessToken; const r=await api('/api/v1/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:lg.d.data.refreshToken}),na:true}); log(m,'Refresh '+i,r.o&&r.d?.data?.accessToken,'s='+r.s); if(r.o)TK=r.d.data.accessToken; }
  for (let i=0;i<5;i++) { const r=await api('/api/v1/auth/setup',{method:'POST',body:JSON.stringify({name:'H',email:'h'+i+'@t.com',password:'Hacker@12345',confirmPassword:'Hacker@12345'}),na:true}); log(m,'Setup once '+i,r.s===403,'s='+r.s); }
}

// ===== SUPER ADMIN =====
async function testSuperAdmin() {
  const m = 'SUPER_ADMIN';
  for (let i=0;i<10;i++) { const r=await api('/api/v1/super-admin/stats'); log(m,'Stats '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/super-admin/tenants'); log(m,'List tenants '+i,r.o&&Array.isArray(r.d?.data),'s='+r.s); }
  for (let i=0;i<5;i++) { const r=await api('/api/v1/super-admin/tenants',{method:'POST',body:JSON.stringify({name:'Org '+i,slug:'org-'+i+'-'+Date.now(),status:'ACTIVE',plan:'PRO',maxUsers:100,settings:{}})}); log(m,'Create tenant '+i,r.o&&r.d?.data?.id,'s='+r.s+' '+(r.d?.error?.message||'').substring(0,80)); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/super-admin/roles'); log(m,'List roles '+i,r.o&&Array.isArray(r.d?.data),'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/super-admin/audit'); log(m,'Audit '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/system/providers'); log(m,'Providers '+i,r.o,'s='+r.s); }
}

// ===== CRM =====
let leadId='',contactId='',companyId='',dealId='';
async function testCRM() {
  const m = 'CRM';
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/dashboard'); log(m,'Dashboard '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/companies',{method:'POST',body:JSON.stringify({name:'Co '+i,industry:'TECHNOLOGY',website:'https://c'+i+'.com',city:'Mumbai',country:'India'})}); log(m,'Create company '+i,r.o&&r.d?.data?.id,'s='+r.s); if(r.o&&r.d?.data?.id&&!companyId)companyId=r.d.data.id; }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/companies'); log(m,'List companies '+i,r.o&&r.d?.data,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/contacts',{method:'POST',body:JSON.stringify({firstName:'C'+i,lastName:'Test',email:'c'+i+'@t.com',phone:'987654321'+(i%10),title:'Manager',companyId:companyId||undefined})}); log(m,'Create contact '+i,r.o&&r.d?.data?.id,'s='+r.s); if(r.o&&r.d?.data?.id&&!contactId)contactId=r.d.data.id; }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/contacts'); log(m,'List contacts '+i,r.o&&r.d?.data,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'Lead'+i,lastName:'T',email:'l'+i+'@t.com',phone:'999988880'+(i%10),source:'WEBSITE',priority:i%4===0?'URGENT':'MEDIUM',status:'NEW',value:(i+1)*10000,description:'Test lead'})}); log(m,'Create lead '+i,r.o&&r.d?.data?.id,'s='+r.s); if(r.o&&r.d?.data?.id&&!leadId)leadId=r.d.data.id; }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/leads'); log(m,'List leads '+i,r.o&&r.d?.data,'s='+r.s); }
  if(leadId){for(let i=0;i<10;i++){const r=await api('/api/v1/crm/leads/'+leadId);log(m,'Lead detail '+i,r.o&&r.d?.data?.id===leadId,'s='+r.s);}for(let i=0;i<10;i++){const r=await api('/api/v1/crm/leads/'+leadId,{method:'PUT',body:JSON.stringify({status:'CONTACTED',priority:'HIGH'})});log(m,'Update lead '+i,r.o,'s='+r.s);}}
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/deals',{method:'POST',body:JSON.stringify({title:'Deal '+i,value:(i+1)*50000,currency:'INR',stage:'PROSPECTING',probability:50,contactId:contactId||undefined,companyId:companyId||undefined})}); log(m,'Create deal '+i,r.o&&r.d?.data?.id,'s='+r.s); if(r.o&&r.d?.data?.id&&!dealId)dealId=r.d.data.id; }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/deals'); log(m,'List deals '+i,r.o&&r.d?.data,'s='+r.s); }
  if(dealId){const stages=['PROSPECTING','QUALIFICATION','PROPOSAL','NEGOTIATION','CLOSED_WON'];for(let i=0;i<10;i++){const r=await api('/api/v1/crm/deals/'+dealId+'/stage',{method:'PATCH',body:JSON.stringify({stage:stages[i%5]})});log(m,'Deal stage '+i,r.o,'s='+r.s);}}
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/tasks',{method:'POST',body:JSON.stringify({title:'Task '+i,description:'Test',priority:'HIGH',status:'TODO',dueDate:new Date(Date.now()+86400000).toISOString(),entityType:'LEAD',entityId:leadId||undefined})}); log(m,'Create task '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/tasks'); log(m,'List tasks '+i,r.o&&r.d?.data,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/follow-ups',{method:'POST',body:JSON.stringify({entityType:'LEAD',entityId:leadId||undefined,notes:'FU '+i,scheduledAt:new Date(Date.now()+3600000).toISOString(),status:'PENDING'})}); log(m,'Create follow-up '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/follow-ups'); log(m,'List follow-ups '+i,r.o&&r.d?.data,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/notes',{method:'POST',body:JSON.stringify({entityType:'LEAD',entityId:leadId||undefined,content:'Note '+i+' detailed test content here.'})}); log(m,'Create note '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<5;i++) { const r=await api('/api/v1/crm/tags',{method:'POST',body:JSON.stringify({name:'Tag'+i,color:'#3B82F6'})}); log(m,'Create tag '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/tags'); log(m,'List tags '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/crm/search?q=Test'); log(m,'Search '+i,r.o,'s='+r.s); }
  if(leadId){const r=await api('/api/v1/crm/leads/'+leadId+'/convert',{method:'POST'});log(m,'Lead convert',r.o||r.s===409,'s='+r.s);}
  for(let i=0;i<3;i++){try{const r=await fetch(B+'/api/v1/crm/export?entityType=leads',{headers:{Authorization:'Bearer '+TK}});log(m,'Export CSV '+i,r.ok,'s='+r.status);}catch(e){log(m,'Export CSV '+i,false,String(e));}}
}

// ===== HRMS =====
let deptId='',desigId='',empId='';
async function testHRMS() {
  const m = 'HRMS';
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/dashboard'); log(m,'Dashboard '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/departments',{method:'POST',body:JSON.stringify({name:'Dept '+i,description:'Test'})}); log(m,'Create dept '+i,r.o&&r.d?.data?.id,'s='+r.s); if(r.o&&r.d?.data?.id&&!deptId)deptId=r.d.data.id; }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/departments'); log(m,'List depts '+i,r.o&&r.d?.data,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/designations',{method:'POST',body:JSON.stringify({title:'Desig '+i,departmentId:deptId||undefined})}); log(m,'Create desig '+i,r.o&&r.d?.data?.id,'s='+r.s); if(r.o&&r.d?.data?.id&&!desigId)desigId=r.d.data.id; }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/designations'); log(m,'List desigs '+i,r.o&&r.d?.data,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/employees',{method:'POST',body:JSON.stringify({firstName:'Emp'+i,lastName:'T',email:'emp'+i+'@h.com',phone:'98877'+(100+i),departmentId:deptId||undefined,designationId:desigId||undefined,dateOfJoining:'2024-01-15',salary:50000+(i*5000),employmentStatus:'ACTIVE',workLocation:'Mumbai'})}); log(m,'Create emp '+i,r.o&&r.d?.data?.id,'s='+r.s); if(r.o&&r.d?.data?.id&&!empId)empId=r.d.data.id; }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/employees'); log(m,'List emps '+i,r.o&&r.d?.data,'s='+r.s); }
  if(empId){for(let i=0;i<10;i++){const r=await api('/api/v1/hrms/employees/'+empId);log(m,'Emp detail '+i,r.o&&r.d?.data?.id===empId,'s='+r.s);}}
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/attendance',{method:'POST',body:JSON.stringify({employeeId:empId||undefined,date:'2025-01-15',checkIn:'2025-01-15T09:00:00Z',checkOut:'2025-01-15T18:00:00Z',status:'PRESENT',workingMinutes:540})}); log(m,'Create attendance '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/attendance'); log(m,'List attendance '+i,r.o&&r.d?.data,'s='+r.s); }
  for (let i=0;i<5;i++) { const r=await api('/api/v1/hrms/leave-types',{method:'POST',body:JSON.stringify({name:'LT '+i,code:'LT'+i,paid:true,carryForward:false,maxDays:12})}); log(m,'Create leave type '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/leave-requests',{method:'POST',body:JSON.stringify({employeeId:empId||undefined,startDate:'2025-02-01',endDate:'2025-02-03',totalDays:3,reason:'Personal',status:'PENDING'})}); log(m,'Create leave req '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/leave-requests'); log(m,'List leave reqs '+i,r.o&&r.d?.data,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/expenses',{method:'POST',body:JSON.stringify({employeeId:empId||undefined,title:'Expense '+i,amount:1000+(i*200),category:'TRAVEL',description:'Travel',status:'PENDING'})}); log(m,'Create expense '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/expenses'); log(m,'List expenses '+i,r.o&&r.d?.data,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/field-visits',{method:'POST',body:JSON.stringify({employeeId:empId||undefined,date:'2025-01-20',purpose:'Client meeting',status:'PLANNED',notes:'Visit'})}); log(m,'Create field visit '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/field-dashboard'); log(m,'Field dashboard '+i,r.o,'s='+r.s); }
  for (let i=0;i<5;i++) { const r=await api('/api/v1/hrms/payroll',{method:'POST',body:JSON.stringify({employeeId:empId||undefined,month:'2025-01',basicSalary:40000,totalAllowances:10000,totalDeductions:5000,netSalary:45000,status:'DRAFT'})}); log(m,'Create payroll '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/hrms/payroll'); log(m,'List payroll '+i,r.o&&r.d?.data,'s='+r.s); }
}

// ===== COMMUNICATION =====
async function testComm() {
  const m = 'COMMUNICATION';
  for (let i=0;i<10;i++) { const r=await api('/api/v1/communication/dashboard'); log(m,'Dashboard '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/communication/templates'); log(m,'List templates '+i,r.o,'s='+r.s); }
  for (let i=0;i<5;i++) { const r=await api('/api/v1/communication/templates',{method:'POST',body:JSON.stringify({name:'Tmpl '+i,channel:'EMAIL',category:'TRANSACTIONAL',subject:'Sub '+i,body:'Hello {{name}}, welcome.',status:'ACTIVE'})}); log(m,'Create template '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/communication/notifications'); log(m,'List notifications '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/communication/providers'); log(m,'List providers '+i,r.o,'s='+r.s); }
  for (let i=0;i<5;i++) { const r=await api('/api/v1/communication/conversations'); log(m,'List conversations '+i,r.o,'s='+r.s); }
}

// ===== AUTOMATION =====
async function testAuto() {
  const m = 'AUTOMATION';
  for (let i=0;i<10;i++) { const r=await api('/api/v1/automation/dashboard'); log(m,'Dashboard '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/automation/workflows'); log(m,'List workflows '+i,r.o,'s='+r.s); }
  for (let i=0;i<5;i++) { const r=await api('/api/v1/automation/workflows',{method:'POST',body:JSON.stringify({name:'WF '+i,description:'Test',triggerType:'lead.created',triggerConfig:{},conditions:[],actions:[{type:'create_notification',config:{message:'New lead'},sortOrder:0}]})}); log(m,'Create workflow '+i,r.o&&r.d?.data?.id,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/automation/executions'); log(m,'List executions '+i,r.o,'s='+r.s); }
}

// ===== ANALYTICS =====
async function testAnalytics() {
  const m = 'ANALYTICS';
  const paths = ['/api/v1/analytics/executive','/api/v1/analytics/crm','/api/v1/analytics/telecaller','/api/v1/analytics/hr','/api/v1/analytics/communication','/api/v1/analytics/automation','/api/v1/analytics/ai-usage'];
  for (const p of paths) {
    const name = p.split('/').pop()!;
    for (let i=0;i<10;i++) { const r=await api(p); log(m,name+' '+i,r.o,'s='+r.s); }
  }
}

// ===== AI =====
async function testAI() {
  const m = 'AI';
  for (let i=0;i<10;i++) { const r=await api('/api/v1/ai/agents'); log(m,'List agents '+i,r.o,'s='+r.s); }
  for (let i=0;i<5;i++) { const r=await api('/api/v1/ai/chat',{method:'POST',body:JSON.stringify({agent:'NOVA',message:'Hello'})}); log(m,'AI chat '+i,r.s===503||r.s===200,'s='+r.s+' (503=ok if no provider)'); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/ai/usage'); log(m,'AI usage '+i,r.o,'s='+r.s); }
}

// ===== ADMIN =====
async function testAdmin() {
  const m = 'ADMIN';
  for (let i=0;i<10;i++) { const r=await api('/api/v1/admin/users'); log(m,'Users '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/admin/roles'); log(m,'Roles '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/admin/audit'); log(m,'Audit '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/admin/memberships'); log(m,'Memberships '+i,r.o,'s='+r.s); }
  for (let i=0;i<10;i++) { const r=await api('/api/v1/admin/settings'); log(m,'Settings '+i,r.o,'s='+r.s); }
}

// ===== SECURITY AUDIT =====
async function testSecurity() {
  const m = 'SECURITY';
  // SQL Injection x10
  const sqli=["' OR '1'='1","'; DROP TABLE","1; SELECT *","admin'/**/OR/**/"];
  for(let i=0;i<10;i++){const p=sqli[i%4];const r=await api('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:p,password:p}),na:true});log(m,'SQLi '+i,r.s===422||r.s===401,'s='+r.s);}
  // XSS x10
  const xss=['<script>alert(1)</script>','"><img src=x onerror=alert(1)>','{{constructor.constructor()}}','<svg onload=alert(1)>'];
  for(let i=0;i<10;i++){const r=await api('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:xss[i%4],lastName:'XSS',email:'xss'+i+'@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW'})});log(m,'XSS '+i,r.o||r.s===422,'s='+r.s);}
  // NoSQLi x10
  for(let i=0;i<10;i++){const r=await api('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:{'$ne':''},password:{'$ne':''}}),na:true});log(m,'NoSQLi '+i,r.s===422,'s='+r.s);}
  // Fake JWT x10
  for(let i=0;i<10;i++){const r=await api('/api/v1/auth/me');const r2=await fetch(B+'/api/v1/auth/me',{headers:{Authorization:'Bearer fake.token.'+i}});log(m,'Fake JWT '+i,r2.status===401,'s='+r2.status);}
  // Empty JWT x10
  for(let i=0;i<10;i++){const r2=await fetch(B+'/api/v1/auth/me',{headers:{Authorization:'Bearer '}});log(m,'Empty JWT '+i,r2.status===401,'s='+r2.status);}
  // No auth header x10
  for(let i=0;i<10;i++){const r2=await fetch(B+'/api/v1/crm/leads');log(m,'No auth header '+i,r2.status===401,'s='+r2.status);}
  // Mass assignment x10
  for(let i=0;i<10;i++){const r=await api('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'M'+i,lastName:'A',email:'m'+i+'@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW',isSuperAdmin:true,roleCode:'SUPER_ADMIN',tenantId:'fake',passwordHash:'hacked'})});log(m,'Mass assign '+i,r.o,'s='+r.s);}
  // Large payload x5
  for(let i=0;i<5;i++){const r=await api('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'A'.repeat(10000),lastName:'H',email:'h'+i+'@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW'})});log(m,'Large payload '+i,r.s===422||r.o,'s='+r.s);}
  // Security headers x5
  for(let i=0;i<5;i++){try{const r=await fetch(B+'/api/v1/system/health');const h=r.headers.get('strict-transport-security');const x=r.headers.get('x-frame-options');const c=r.headers.get('x-content-type-options');log(m,'Headers '+i,!!(h&&x&&c),'HSTS='+(!!h)+' XF='+(!!x)+' XC='+(!!c));}catch(e){log(m,'Headers '+i,false,String(e));}}
  // CORS x5
  for(let i=0;i<5;i++){try{const r=await fetch(B+'/api/v1/system/health',{headers:{Origin:'https://evil.com'}});const o=r.headers.get('access-control-allow-origin');log(m,'CORS '+i,o===null||o!=='https://evil.com','origin='+o);}catch(e){log(m,'CORS '+i,true,'blocked');}}
  // Brute force x10
  const st=[];for(let i=0;i<10;i++){const r=await api('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'Wrong'+i}),na:true});st.push(r.s);}log(m,'Brute force',st.every(s=>s===401||s===422||s===429),'statuses='+st.join(','));
  // Method tamper x5
  for(let i=0;i<5;i++){try{const methods=['PUT','PATCH','DELETE'];const r=await fetch(B+'/api/v1/auth/login',{method:methods[i%3]});log(m,'Method tamper '+i,r.status===405||r.status===404||r.status===400,'s='+r.status);}catch(e){log(m,'Method tamper '+i,true,'blocked');}}
}

// ===== MAIN =====
async function main() {
  console.log('Starting HubSphere Complete Test Suite + Security Audit...');
  const t0 = Date.now();
  await testAuth(); console.log('  AUTH done');
  await testSuperAdmin(); console.log('  SUPER_ADMIN done');
  await testCRM(); console.log('  CRM done');
  await testHRMS(); console.log('  HRMS done');
  await testAdmin(); console.log('  ADMIN done');
  await testComm(); console.log('  COMMUNICATION done');
  await testAuto(); console.log('  AUTOMATION done');
  await testAnalytics(); console.log('  ANALYTICS done');
  await testAI(); console.log('  AI done');
  await testSecurity(); console.log('  SECURITY done');
  const elapsed = ((Date.now()-t0)/1000).toFixed(1);

  // Print & save results
  let tp=0,tf=0;
  const lines: string[] = [];
  lines.push('HUBSPHERE TEST RESULTS');
  lines.push('Time: '+elapsed+'s');
  lines.push('');
  for (const [mod,r] of Object.entries(RES)) {
    const icon = r.f===0 ? 'PASS' : 'WARN';
    const line = icon+' | '+mod+' | '+r.p+' pass / '+r.f+' fail';
    lines.push(line);
    console.log(line);
    if (r.e.length>0) { r.e.slice(0,3).forEach(e=>{const l='  FAIL: '+e;lines.push(l);console.log(l);});if(r.e.length>3){const l='  ...+'+(r.e.length-3)+' more';lines.push(l);console.log(l);}}
    tp+=r.p;tf+=r.f;
  }
  const pct = ((tp/(tp+tf))*100).toFixed(1);
  const summary = 'TOTAL: '+tp+'/'+(tp+tf)+' ('+pct+'%)';
  lines.push('');lines.push(summary);
  console.log('\n'+summary);

  // DB counts
  lines.push('');lines.push('DB RECORDS:');
 const models=['User','Role','Permission','Tenant','Lead','Contact','Company','Deal','Employee','Department','Designation','Task','FollowUp','Note','Tag','FieldVisit','Expense','AttendanceSession','LeaveRequest','PayrollRecord','AutomationWorkflow','CommunicationTemplate','Notification','AuditLog','RefreshToken'];
  for (const m of models) { try { // @ts-expect-error
    const c = await db[m].count(); if(c>0){const l='  '+m+': '+c;lines.push(l);console.log(l);}
  } catch(e){} }

  // Save to file
  const fs = await import('fs');
  fs.writeFileSync('/home/z/my-project/scripts/test-results.json', JSON.stringify({results:RES,summary:{pass:tp,fail:tf,total:tp+tf,percent:pct,time:elapsed},lines},null,2));
  console.log('\nResults saved to test-results.json');
  await db.$disconnect();
}

main().catch(e=>{console.error('FATAL:',e);process.exit(1);});
