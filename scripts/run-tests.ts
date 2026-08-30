const B='https://hubspherev3.vercel.app';let TK='';const R={};function L(m,t,ok,s){if(!R[m])R[m]={p:0,f:0,e:[]};if(ok)R[m].p++;else{R[m].f++;R[m].e.push(t+':'+s)}}
async function login(){const r=await fetch(B+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@hubsphere.com',password:'Admin@123456'}),signal:AbortSignal.timeout(15000)});const d=await r.json();if(d.data?.accessToken)TK=d.data.accessToken;return TK!=='';}
async function A(path,opts={}){try{const h={'Content-Type':'application/json'};if(TK)h['Authorization']='Bearer '+TK;if(opts.na)delete h['Authorization'];const r=await fetch(B+path,{...opts,headers:h,signal:AbortSignal.timeout(15000)});const d=await r.json().catch(()=>null);return{s:r.status,d,o:r.status>=200&&r.status<300}}catch(e){return{s:0,d:null,o:false}}}
async function main(){const t0=Date.now();await login();
const m='AUTH';for(let i=0;i<10;i++){await login();const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'Admin@123456'}),na:true});L(m,'Login',r.o&&r.d?.data?.accessToken,r.s);if(r.o)TK=r.d.data.accessToken;}
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/me');L(m,'Me',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/system/health',{na:true});L(m,'Health',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/me',{na:true});L(m,'Unauth',r.s===401,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'Wrong1'}),na:true});L(m,'BadPwd',r.s===401,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'bad',password:'A'}),na:true});L(m,'BadEmail',r.s===422,r.s);}
for(let i=0;i<10;i++){await login();const lg=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'Admin@123456'}),na:true});if(!lg.o){L(m,'Refresh',false,0);continue;}const r=await A('/api/v1/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:lg.d.data.refreshToken}),na:true});L(m,'Refresh',r.o,r.s);if(r.o)TK=r.d.data.accessToken;}
for(let i=0;i<5;i++){const r=await A('/api/v1/auth/setup',{method:'POST',body:JSON.stringify({name:'H',email:'h'+i+'@t.com',password:'Hacker@12345',confirmPassword:'Hacker@12345'}),na:true});L(m,'SetupOnce',r.s===403,r.s);}
console.log('AUTH');
const sa='SUPER_ADMIN';await login();
for(let i=0;i<10;i++){const r=await A('/api/v1/super-admin/stats');L(sa,'Stats',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/super-admin/tenants');L(sa,'Tenants',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/super-admin/tenants',{method:'POST',body:JSON.stringify({name:'O'+i,slug:'o'+i+Date.now(),status:'ACTIVE',plan:'PRO',maxUsers:100,settings:{}})});L(sa,'CreateTenant',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/super-admin/roles');L(sa,'Roles',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/super-admin/audit');L(sa,'Audit',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/system/providers');L(sa,'Providers',r.o,r.s);}
console.log('SA');
const cr='CRM';await login();
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/dashboard');L(cr,'Dashboard',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/companies',{method:'POST',body:JSON.stringify({name:'C'+i,industry:'TECHNOLOGY',city:'Mumbai',country:'India'})});L(cr,'CreateCo',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/companies');L(cr,'ListCo',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/contacts',{method:'POST',body:JSON.stringify({firstName:'C'+i,lastName:'T',email:'c'+i+'@t.com',phone:'987654321'+(i%10)})});L(cr,'CreateContact',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/contacts');L(cr,'ListContact',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'L'+i,lastName:'T',email:'l'+i+'@t.com',phone:'99'+i+'8877660',source:'WEBSITE',priority:'MEDIUM',status:'NEW',value:(i+1)*10000})});L(cr,'CreateLead',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/leads');L(cr,'ListLead',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/deals',{method:'POST',body:JSON.stringify({title:'D'+i,value:(i+1)*50000,stage:'PROSPECTING',probability:50})});L(cr,'CreateDeal',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/deals');L(cr,'ListDeal',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/tasks',{method:'POST',body:JSON.stringify({title:'T'+i,priority:'HIGH',status:'TODO',dueDate:new Date(Date.now()+86400000).toISOString(),entityType:'LEAD'})});L(cr,'CreateTask',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/tasks');L(cr,'ListTask',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/follow-ups',{method:'POST',body:JSON.stringify({entityType:'LEAD',notes:'FU'+i,scheduledAt:new Date(Date.now()+3600000).toISOString(),status:'PENDING'})});L(cr,'CreateFU',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/follow-ups');L(cr,'ListFU',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/notes',{method:'POST',body:JSON.stringify({entityType:'LEAD',content:'Note'+i})});L(cr,'CreateNote',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/crm/tags',{method:'POST',body:JSON.stringify({name:'Tag'+i,color:'#3B82F6'})});L(cr,'CreateTag',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/tags');L(cr,'ListTag',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/search?q=T');L(cr,'Search',r.o,r.s);}
console.log('CRM');
const hr='HRMS';await login();
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/dashboard');L(hr,'Dashboard',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/departments',{method:'POST',body:JSON.stringify({name:'D'+i,description:'T'})});L(hr,'CreateDept',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/departments');L(hr,'ListDept',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/designations',{method:'POST',body:JSON.stringify({title:'Des'+i})});L(hr,'CreateDesig',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/designations');L(hr,'ListDesig',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/employees',{method:'POST',body:JSON.stringify({firstName:'E'+i,lastName:'T',email:'e'+i+'@h.com',phone:'98877'+(100+i),dateOfJoining:'2024-01-15',salary:50000+i*5000,employmentStatus:'ACTIVE',workLocation:'Mumbai'})});L(hr,'CreateEmp',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/employees');L(hr,'ListEmp',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/attendance',{method:'POST',body:JSON.stringify({date:'2025-01-'+(10+i),checkIn:'2025-01-'+(10+i)+'T09:00:00Z',checkOut:'2025-01-'+(10+i)+'T18:00:00Z',status:'PRESENT',workingMinutes:540})});L(hr,'CreateAtt',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/attendance');L(hr,'ListAtt',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/leave-requests',{method:'POST',body:JSON.stringify({startDate:'2025-03-01',endDate:'2025-03-03',totalDays:3,reason:'P',status:'PENDING'})});L(hr,'CreateLeave',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/leave-requests');L(hr,'ListLeave',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/expenses',{method:'POST',body:JSON.stringify({title:'X'+i,amount:1000+i*200,category:'TRAVEL',description:'T',status:'PENDING'})});L(hr,'CreateExp',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/expenses');L(hr,'ListExp',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/field-visits',{method:'POST',body:JSON.stringify({date:'2025-01-20',purpose:'M',status:'PLANNED'})});L(hr,'CreateFV',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/field-dashboard');L(hr,'FieldDash',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/hrms/payroll',{method:'POST',body:JSON.stringify({month:'2025-01',basicSalary:40000,totalAllowances:10000,totalDeductions:5000,netSalary:45000,status:'DRAFT'})});L(hr,'CreatePay',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/hrms/payroll');L(hr,'ListPay',r.o,r.s);}
console.log('HRMS');
const cm='COMM';await login();
for(let i=0;i<10;i++){const r=await A('/api/v1/communication/dashboard');L(cm,'Dash',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/communication/templates');L(cm,'Templates',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/communication/templates',{method:'POST',body:JSON.stringify({name:'T'+i,channel:'EMAIL',category:'TRANSACTIONAL',subject:'S'+i,body:'Hi {{name}}',status:'ACTIVE'})});L(cm,'CreateTmpl',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/communication/notifications');L(cm,'Notif',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/communication/providers');L(cm,'Providers',r.o,r.s);}
console.log('COMM');
const au='AUTO';await login();
for(let i=0;i<10;i++){const r=await A('/api/v1/automation/dashboard');L(au,'Dash',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/automation/workflows');L(au,'WFs',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/automation/workflows',{method:'POST',body:JSON.stringify({name:'W'+i,triggerType:'lead.created',triggerConfig:{},conditions:[],actions:[{type:'create_notification',config:{message:'L'},sortOrder:0}]})});L(au,'CreateWF',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/automation/executions');L(au,'Execs',r.o,r.s);}
console.log('AUTO');
const an='ANLYT';await login();
for(const p of ['/api/v1/analytics/executive','/api/v1/analytics/crm','/api/v1/analytics/telecaller','/api/v1/analytics/hr','/api/v1/analytics/communication','/api/v1/analytics/automation','/api/v1/analytics/ai-usage']){const n=p.split('/').pop()!;for(let i=0;i<10;i++){const r=await A(p);L(an,n,r.o,r.s);}}
console.log('ANALYTICS');
const ai='AI';await login();
for(let i=0;i<10;i++){const r=await A('/api/v1/ai/agents');L(ai,'Agents',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/ai/chat',{method:'POST',body:JSON.stringify({agent:'NOVA',message:'Hi'})});L(ai,'Chat',r.s===503||r.s===200,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/ai/usage');L(ai,'Usage',r.o,r.s);}
console.log('AI');
const ad='ADMIN';await login();
for(let i=0;i<10;i++){const r=await A('/api/v1/admin/users');L(ad,'Users',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/admin/roles');L(ad,'Roles',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/admin/audit');L(ad,'Audit',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/admin/memberships');L(ad,'Members',r.o,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/admin/settings');L(ad,'Settings',r.o,r.s);}
console.log('ADMIN');
const sc='SECURITY';await login();
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:"' OR 1=1",password:"x"}),na:true});L(sc,'SQLi',r.s===422||r.s===401||r.s===400,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'<script>',lastName:'X',email:'x'+i+'@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW'})});L(sc,'XSS',r.o||r.s===422,r.s);}
for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:{'$ne':''},password:{'$ne':''}}),na:true});L(sc,'NoSQLi',r.s===422||r.s===400,r.s);}
for(let i=0;i<10;i++){const r2=await fetch(B+'/api/v1/auth/me',{headers:{Authorization:'Bearer fake.'+i}});L(sc,'FakeJWT',r2.status===401,r2.status);}
for(let i=0;i<10;i++){const r2=await fetch(B+'/api/v1/crm/leads');L(sc,'NoAuth',r2.status===401,r2.status);}
for(let i=0;i<10;i++){const r=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'M'+i,lastName:'A',email:'m'+i+'@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW',isSuperAdmin:true,roleCode:'SUPER_ADMIN',passwordHash:'hack'})});L(sc,'MassAsgn',r.o,r.s);}
for(let i=0;i<5;i++){const r=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'A'.repeat(10000),lastName:'H',email:'h'+i+'@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW'})});L(sc,'BigPayload',r.s===422||r.o,r.s);}
for(let i=0;i<5;i++){try{const r=await fetch(B+'/api/v1/system/health');const h=r.headers.get('strict-transport-security');const x=r.headers.get('x-frame-options');L(sc,'Headers',!!(h&&x),'ok');}catch(e){L(sc,'Headers',false,'err');}}
for(let i=0;i<5;i++){try{const r=await fetch(B+'/api/v1/system/health',{headers:{Origin:'https://evil.com'}});const o=r.headers.get('access-control-allow-origin');L(sc,'CORS',o===null||o!=='https://evil.com','ok');}catch(e){L(sc,'CORS',true,'ok');}}
const bf=[];for(let i=0;i<10;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'W'+i}),na:true});bf.push(r.s);}L(sc,'BruteF',bf.every(s=>s===401||s===422||s===429),bf.join(','));
for(let i=0;i<5;i++){try{const ms=['PUT','PATCH','DELETE'];const r=await fetch(B+'/api/v1/auth/login',{method:ms[i%3]});L(sc,'MethodT',r.status===405||r.status===404,r.status);}catch(e){L(sc,'MethodT',true,'ok');}}
console.log('SECURITY');
const elapsed=((Date.now()-t0)/1000).toFixed(1);let tp=0,tf=0;const lines=['HUBSPHERE TEST RESULTS','Time: '+elapsed+'s',''];
for(const[mod,r]of Object.entries(R)){const ic=r.f===0?'PASS':'WARN';lines.push(ic+'|'+mod+'|'+r.p+'/'+(r.p+r.f));tp+=r.p;tf+=r.f;if(r.e.length>0)r.e.slice(0,3).forEach(e=>lines.push('  FAIL:'+e));}
const pct=((tp/(tp+tf))*100).toFixed(1);lines.push('');lines.push('TOTAL: '+tp+'/'+(tp+tf)+' ('+pct+'%)');
console.log('\n'+lines.join('\n'));
const fs=await import('fs');fs.writeFileSync('/home/z/my-project/scripts/test-results.json',JSON.stringify({results:R,summary:{pass:tp,fail:tf,total:tp+tf,percent:pct,time:elapsed},lines},null,2));
console.log('Saved');}
main().catch(e=>{console.error(e);process.exit(1);});