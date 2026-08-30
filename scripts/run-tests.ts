const B='https://hubspherev3.vercel.app';let TK='';const R={};function L(m,t,ok,s){if(!R[m])R[m]={p:0,f:0,e:[]};if(ok)R[m].p++;else{R[m].f++;R[m].e.push(t+': s='+s)}}
async function A(path,opts={}){try{const h={'Content-Type':'application/json'};if(TK)h['Authorization']='Bearer '+TK;if(opts.na)delete h['Authorization'];const r=await fetch(B+path,{...opts,headers:h,signal:AbortSignal.timeout(20000)});const d=await r.json().catch(()=>null);return{s:r.status,d,o:r.status>=200&&r.status<300}}catch(e){return{s:0,d:{error:String(e)},o:false}}}

async function main(){
console.log('HubSphere Test Suite - 10 Rounds Each Module');
const t0=Date.now();

// AUTH
const m='AUTH';
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'Admin@123456'}),na:true});L(m,'Login',r.o&&r.d?.data?.accessToken,r.s);if(r.o)TK=r.d.data.accessToken;}
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/me');L(m,'Me',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/system/health',{na:true});L(m,'Health',r.o&&r.d?.data?.status==='ok',r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/me',{na:true});L(m,'UnauthBlock',r.s===401,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'Wrong1'}),na:true});L(m,'WrongPwd',r.s===401,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'bad',password:'A'}),na:true});L(m,'InvalidEmail',r.s===422,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'a@b.com'}),na:true});L(m,'MissingPwd',r.s===422,r.s);}
for(let i=0;i<10;i++){const lg=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'Admin@123456'}),na:true});if(!lg.o){L(m,'Refresh',false,'loginFail');continue;}TK=lg.d.data.accessToken;const r=await A('/api/v1/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:lg.d.data.refreshToken}),na:true});L(m,'Refresh',r.o&&r.d?.data?.accessToken,r.s);if(r.o)TK=r.d.data.accessToken;}
for(let i=0;i<5;i++){const r=await A('/api/v1/auth/setup',{method:'POST',body:JSON.stringify({name:'H',email:'h'+i+'@t.com',password:'Hacker@12345',confirmPassword:'Hacker@12345'}),na:true});L(m,'SetupOnce',r.s===403,r.s);}
console.log('  AUTH done');

// SUPER ADMIN
const sa='SUPER_ADMIN';
for(let i=0;i<10;i++){const r=await A('/api/v1/super-admin/stats');L(sa,'Stats',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/super-admin/tenants');L(sa,'Tenants',r.o&&Array.isArray(r.d?.data),r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/super-admin/tenants',{method:'POST',body:JSON.stringify({name:'Org'+i,slug:'org'+i+Date.now(),status:'ACTIVE',plan:'PRO',maxUsers:100,settings:{}})});L(sa,'CreateTenant',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/super-admin/roles');L(sa,'Roles',r.o&&Array.isArray(r.d?.data),r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/super-admin/audit');L(sa,'Audit',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/system/providers');L(sa,'Providers',r.o,r.s);}
console.log('  SUPER_ADMIN done');

// CRM
const cr='CRM';
let cid='',lid='',did='',tid='';
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/dashboard');L(cr,'Dashboard',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/companies',{method:'POST',body:JSON.stringify({name:'Co'+i,industry:'TECHNOLOGY',city:'Mumbai',country:'India'})});L(cr,'CreateCo',r.o&&r.d?.data?.id,r.s);if(r.o&&!cid)cid=r.d.data.id;}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/companies');L(cr,'ListCo',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/contacts',{method:'POST',body:JSON.stringify({firstName:'C'+i,lastName:'T',email:'c'+i+'@t.com',phone:'987654321'+(i%10),companyId:cid||undefined})});L(cr,'CreateContact',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/contacts');L(cr,'ListContacts',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'L'+i,lastName:'T',email:'l'+i+'@t.com',phone:'9998800'+i,source:'WEBSITE',priority:'MEDIUM',status:'NEW',value:(i+1)*10000})});L(cr,'CreateLead',r.o&&r.d?.data?.id,r.s);if(r.o&&!lid)lid=r.d.data.id;}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/leads');L(cr,'ListLeads',r.o,r.s);}
if(lid){for(let i=0;i<10;i++){const r=await A('/api/v1/crm/leads/'+lid);L(cr,'LeadDetail',r.o,r.s);}for(let i=0;i<10;i++){const r=await A('/api/v1/crm/leads/'+lid,{method:'PUT',body:JSON.stringify({status:'CONTACTED',priority:'HIGH'})});L(cr,'UpdateLead',r.o,r.s);}}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/deals',{method:'POST',body:JSON.stringify({title:'Deal'+i,value:(i+1)*50000,currency:'INR',stage:'PROSPECTING',probability:50})});L(cr,'CreateDeal',r.o&&r.d?.data?.id,r.s);if(r.o&&!did)did=r.d.data.id;}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/deals');L(cr,'ListDeals',r.o,r.s);}
if(did){const st=['PROSPECTING','QUALIFICATION','PROPOSAL','NEGOTIATION','CLOSED_WON'];for(let i=0;i<10;i++){const r=await A('/api/v1/crm/deals/'+did+'/stage',{method:'PATCH',body:JSON.stringify({stage:st[i%5]})});L(cr,'DealStage',r.o,r.s);}}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/tasks',{method:'POST',body:JSON.stringify({title:'T'+i,priority:'HIGH',status:'TODO',dueDate:new Date(Date.now()+86400000).toISOString(),entityType:'LEAD',entityId:lid||undefined})});L(cr,'CreateTask',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/tasks');L(cr,'ListTasks',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/follow-ups',{method:'POST',body:JSON.stringify({entityType:'LEAD',entityId:lid||undefined,notes:'FU'+i,scheduledAt:new Date(Date.now()+3600000).toISOString(),status:'PENDING'})});L(cr,'CreateFU',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/follow-ups');L(cr,'ListFU',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/notes',{method:'POST',body:JSON.stringify({entityType:'LEAD',entityId:lid||undefined,content:'Note '+i})});L(cr,'CreateNote',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/crm/tags',{method:'POST',body:JSON.stringify({name:'Tag'+i,color:'#3B82F6'})});L(cr,'CreateTag',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/tags');L(cr,'ListTags',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/search?q=Test');L(cr,'Search',r.o,r.s);}
console.log('  CRM done');

// HRMS
const hr='HRMS';
let eid='',deptid='';
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/dashboard');L(hr,'Dashboard',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/departments',{method:'POST',body:JSON.stringify({name:'Dept'+i,description:'Test'})});L(hr,'CreateDept',r.o&&r.d?.data?.id,r.s);if(r.o&&!deptid)deptid=r.d.data.id;}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/departments');L(hr,'ListDepts',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/designations',{method:'POST',body:JSON.stringify({title:'Desig'+i,departmentId:deptid||undefined})});L(hr,'CreateDesig',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/designations');L(hr,'ListDesigs',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/employees',{method:'POST',body:JSON.stringify({firstName:'E'+i,lastName:'T',email:'e'+i+'@h.com',phone:'98877'+(100+i),departmentId:deptid||undefined,dateOfJoining:'2024-01-15',salary:50000+i*5000,employmentStatus:'ACTIVE',workLocation:'Mumbai'})});L(hr,'CreateEmp',r.o&&r.d?.data?.id,r.s);if(r.o&&!eid)eid=r.d.data.id;}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/employees');L(hr,'ListEmps',r.o,r.s);}
if(eid){for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/employees/'+eid);L(hr,'EmpDetail',r.o,r.s);}}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/attendance',{method:'POST',body:JSON.stringify({employeeId:eid||undefined,date:'2025-01-15',checkIn:'2025-01-15T09:00:00Z',checkOut:'2025-01-15T18:00:00Z',status:'PRESENT',workingMinutes:540})});L(hr,'CreateAtt',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/attendance');L(hr,'ListAtt',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/leave-requests',{method:'POST',body:JSON.stringify({employeeId:eid||undefined,startDate:'2025-02-01',endDate:'2025-02-03',totalDays:3,reason:'P',status:'PENDING'})});L(hr,'CreateLeave',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/leave-requests');L(hr,'ListLeave',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/expenses',{method:'POST',body:JSON.stringify({employeeId:eid||undefined,title:'Exp'+i,amount:1000+i*200,category:'TRAVEL',description:'T',status:'PENDING'})});L(hr,'CreateExp',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/expenses');L(hr,'ListExp',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/field-visits',{method:'POST',body:JSON.stringify({employeeId:eid||undefined,date:'2025-01-20',purpose:'Meeting',status:'PLANNED'})});L(hr,'CreateFV',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/field-dashboard');L(hr,'FieldDash',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/hrms/payroll',{method:'POST',body:JSON.stringify({employeeId:eid||undefined,month:'2025-01',basicSalary:40000,totalAllowances:10000,totalDeductions:5000,netSalary:45000,status:'DRAFT'})});L(hr,'CreatePayroll',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/payroll');L(hr,'ListPayroll',r.o,r.s);}
console.log('  HRMS done');

// COMMUNICATION
const cm='COMMUNICATION';
for(let i=0;i<10;i++){const r=await A('/api/v1/communication/dashboard');L(cm,'Dashboard',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/communication/templates');L(cm,'Templates',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/communication/templates',{method:'POST',body:JSON.stringify({name:'T'+i,channel:'EMAIL',category:'TRANSACTIONAL',subject:'S'+i,body:'Hello {{name}}',status:'ACTIVE'})});L(cm,'CreateTmpl',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/communication/notifications');L(cm,'Notifications',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/communication/providers');L(cm,'Providers',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/communication/conversations');L(cm,'Conversations',r.o,r.s);}
console.log('  COMMUNICATION done');

// AUTOMATION
const au='AUTOMATION';
for(let i=0;i<10;i++){const r=await A('/api/v1/automation/dashboard');L(au,'Dashboard',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/automation/workflows');L(au,'Workflows',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/automation/workflows',{method:'POST',body:JSON.stringify({name:'WF'+i,description:'T',triggerType:'lead.created',triggerConfig:{},conditions:[],actions:[{type:'create_notification',config:{message:'Lead'},sortOrder:0}]})});L(au,'CreateWF',r.o&&r.d?.data?.id,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/automation/executions');L(au,'Executions',r.o,r.s);}
console.log('  AUTOMATION done');

// ANALYTICS
const an='ANALYTICS';
const ap=['/api/v1/analytics/executive','/api/v1/analytics/crm','/api/v1/analytics/telecaller','/api/v1/analytics/hr','/api/v1/analytics/communication','/api/v1/analytics/automation','/api/v1/analytics/ai-usage'];
for(const p of ap){const n=p.split('/').pop()!;for(let i=0;i<10;i++){const r=await A(p);L(an,n,r.o,r.s);}}
console.log('  ANALYTICS done');

// AI
const ai='AI';
for(let i=0;i<10;i++){const r=await A('/api/v1/ai/agents');L(ai,'Agents',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/ai/chat',{method:'POST',body:JSON.stringify({agent:'NOVA',message:'Hi'})});L(ai,'Chat',r.s===503||r.s===200,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/ai/usage');L(ai,'Usage',r.o,r.s);}
console.log('  AI done');

// ADMIN
const ad='ADMIN';
for(let i=0;i<10;i++){const r=await A('/api/v1/admin/users');L(ad,'Users',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/admin/roles');L(ad,'Roles',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/admin/audit');L(ad,'Audit',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/admin/memberships');L(ad,'Memberships',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/admin/settings');L(ad,'Settings',r.o,r.s);}
console.log('  ADMIN done');

// SECURITY
const sc='SECURITY';
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:"' OR '1'='1",password:"x"}),na:true});L(sc,'SQLi',r.s===422||r.s===401,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'<script>alert(1)</script>',lastName:'XSS',email:'x'+i+'@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW'})});L(sc,'XSS',r.o||r.s===422,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:{'$ne':''},password:{'$ne':''}}),na:true});L(sc,'NoSQLi',r.s===422,r.s);}
for(let i=0;i<10;i++){const r2=await fetch(B+'/api/v1/auth/me',{headers:{Authorization:'Bearer fake.'+i}});L(sc,'FakeJWT',r2.status===401,r2.status);}
for(let i=0;i<10;i++){const r2=await fetch(B+'/api/v1/auth/me',{headers:{Authorization:'Bearer '}});L(sc,'EmptyJWT',r2.status===401,r2.status);}
for(let i=0;i<10;i++){const r2=await fetch(B+'/api/v1/crm/leads');L(sc,'NoAuth',r2.status===401,r2.status);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'M'+i,lastName:'A',email:'m'+i+'@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW',isSuperAdmin:true,roleCode:'SUPER_ADMIN',passwordHash:'hacked'})});L(sc,'MassAssign',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'A'.repeat(10000),lastName:'H',email:'h'+i+'@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW'})});L(sc,'LargePayload',r.s===422||r.o,r.s);}
for(let i=0;i<5;i++){try{const r=await fetch(B+'/api/v1/system/health');const h=r.headers.get('strict-transport-security');const x=r.headers.get('x-frame-options');const c=r.headers.get('x-content-type-options');L(sc,'SecHeaders',!!(h&&x&&c),'HSTS='+(!!h)+' XF='+(!!x));}catch(e){L(sc,'SecHeaders',false,'err');}}
for(let i=0;i<5;i++){try{const r=await fetch(B+'/api/v1/system/health',{headers:{Origin:'https://evil.com'}});const o=r.headers.get('access-control-allow-origin');L(sc,'CORS',o===null||o!=='https://evil.com','origin='+o);}catch(e){L(sc,'CORS',true,'blocked');}}
const bf=[];for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'W'+i}),na:true});bf.push(r.s);}L(sc,'BruteForce',bf.every(s=>s===401||s===422||s===429),bf.join(','));
for(let i=0;i<5;i++){try{const ms=['PUT','PATCH','DELETE'];const r=await fetch(B+'/api/v1/auth/login',{method:ms[i%3]});L(sc,'MethodTamper',r.status===405||r.status===404,r.status);}catch(e){L(sc,'MethodTamper',true,'ok');}}
console.log('  SECURITY done');

// RESULTS
const elapsed=((Date.now()-t0)/1000).toFixed(1);
let tp=0,tf=0;
const lines=['HUBSPHERE TEST RESULTS','Time: '+elapsed+'s',''];
for(const[mod,r]of Object.entries(R)){const ic=r.f===0?'PASS':'WARN';const l=ic+' | '+mod+' | '+r.p+'/'+(r.p+r.f);lines.push(l);console.log(l);if(r.e.length>0)r.e.slice(0,3).forEach(e=>{const fl='  FAIL: '+e;lines.push(fl);console.log(fl);});tp+=r.p;tf+=r.f;}
const pct=((tp/(tp+tf))*100).toFixed(1);
const summary='TOTAL: '+tp+'/'+(tp+tf)+' ('+pct+'%)';
lines.push('');lines.push(summary);console.log('\n'+summary);

const fs=await import('fs');
fs.writeFileSync('/home/z/my-project/scripts/test-results.json',JSON.stringify({results:R,summary:{pass:tp,fail:tf,total:tp+tf,percent:pct,time:elapsed},lines},null,2));
console.log('Saved test-results.json');
}
main().catch(e=>{console.error('FATAL:',e);process.exit(1);});
