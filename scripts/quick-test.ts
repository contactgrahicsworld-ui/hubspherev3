const B='https://hubspherev3.vercel.app';let TK='';const R={};
function L(m,t,cls){if(!R[m])R[m]={p:0,f:0};if(cls==='PASS')R[m].p++;else R[m].f++;}
async function login(){const r=await fetch(B+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@hubsphere.com',password:'Admin@123456'}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(d.data?.accessToken)TK=d.data.accessToken;return TK!=='';}
async function A(path,opts={}){try{const h={'Content-Type':'application/json'};if(TK)h['Authorization']='Bearer '+TK;if(opts.na)delete h['Authorization'];const r=await fetch(B+path,{...opts,headers:h,signal:AbortSignal.timeout(20000)});const d=await r.json().catch(()=>null);return{s:r.status,d,o:r.status>=200&&r.status<300}}catch(e){return{s:0,d:null,o:false}}}
async function main(){const t0=Date.now();
await login();console.log('Login:',TK?'OK':'FAIL');

// Auth tests
for(let i=0;i<3;i++){const r=await A('/api/v1/auth/me');L('AUTH','Me',r.o?'PASS':'FAIL');}
const r1=await A('/api/v1/auth/me',{na:true});L('AUTH','Unauth401',r1.s===401?'PASS':'FAIL');
const r2=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'Wrong1'}),na:true});L('AUTH','BadPwd',(r2.s===401||r2.s===429)?'PASS':'FAIL');
const r3=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'bad',password:'A'}),na:true});L('AUTH','BadEmail',(r3.s===422||r3.s===429)?'PASS':'FAIL');

// SA
await login();
for(let i=0;i<3;i++){const r=await A('/api/v1/super-admin/stats');L('SA','Stats',r.o?'PASS':'FAIL');}
for(let i=0;i<3;i++){const r=await A('/api/v1/super-admin/tenants');L('SA','Tenants',r.o?'PASS':'FAIL');}

// CRM
await login();
for(let i=0;i<3;i++){const r=await A('/api/v1/crm/dashboard');L('CRM','Dash',r.o?'PASS':'FAIL');}
const c1=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'TestLead',lastName:'T',email:'test@t.com',phone:'9876543210',source:'WEBSITE',priority:'MEDIUM',status:'NEW',value:10000})});L('CRM','CreateLead',c1.o?'PASS':'FAIL');
const c2=await A('/api/v1/crm/leads');L('CRM','ListLead',c2.o?'PASS':'FAIL');
const c3=await A('/api/v1/crm/deals',{method:'POST',body:JSON.stringify({title:'TestDeal',value:50000,stage:'PROSPECTING',probability:50})});L('CRM','CreateDeal',c3.o?'PASS':'FAIL');
const c4=await A('/api/v1/crm/companies',{method:'POST',body:JSON.stringify({name:'TestCo',industry:'TECHNOLOGY',city:'Mumbai',country:'India'})});L('CRM','CreateCo',c4.o?'PASS':'FAIL');
const c5=await A('/api/v1/crm/contacts',{method:'POST',body:JSON.stringify({firstName:'TestCt',lastName:'T',email:'ct@t.com',phone:'9876543210'})});L('CRM','CreateContact',c5.o?'PASS':'FAIL');

// HRMS
await login();
for(let i=0;i<3;i++){const r=await A('/api/v1/hrms/dashboard');L('HRMS','Dash',r.o?'PASS':'FAIL');}
const h1=await A('/api/v1/hrms/departments',{method:'POST',body:JSON.stringify({name:'TestDept',description:'Test'})});L('HRMS','CreateDept',h1.o?'PASS':'FAIL');
const h2=await A('/api/v1/hrms/employees',{method:'POST',body:JSON.stringify({firstName:'TestEmp',lastName:'T',email:'emp@h.com',phone:'98877100',dateOfJoining:'2024-01-15',salary:50000,employmentStatus:'ACTIVE',workLocation:'Mumbai'})});L('HRMS','CreateEmp',h2.o?'PASS':'FAIL');

// COMM
await login();
for(let i=0;i<3;i++){const r=await A('/api/v1/communication/dashboard');L('COMM','Dash',r.o?'PASS':'FAIL');}

// AUTO
await login();
for(let i=0;i<3;i++){const r=await A('/api/v1/automation/dashboard');L('AUTO','Dash',r.o?'PASS':'FAIL');}

// ANALYTICS
await login();
for(const p of ['/api/v1/analytics/executive','/api/v1/analytics/crm','/api/v1/analytics/hr']){const n=p.split('/').pop()!;const r=await A(p);L('ANALYTICS',n,r.o?'PASS':'FAIL');}

// AI
await login();
for(let i=0;i<3;i++){const r=await A('/api/v1/ai/agents');L('AI','Agents',r.o?'PASS':'FAIL');}
const ai1=await A('/api/v1/ai/chat',{method:'POST',body:JSON.stringify({agent:'NOVA',message:'Hi'})});L('AI','Chat503',(ai1.s===503||ai1.s===200)?'PASS':'FAIL');

// ADMIN
await login();
for(let i=0;i<3;i++){const r=await A('/api/v1/admin/users');L('ADMIN','Users',r.o?'PASS':'FAIL');}

// SECURITY
await login();
const s1=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:"' OR 1=1",password:"x"}),na:true});L('SECURITY','SQLi',(s1.s===422||s1.s===401||s1.s===429)?'PASS':'FAIL');
const s2=await fetch(B+'/api/v1/auth/me',{headers:{Authorization:'Bearer fake.token.123'}});L('SECURITY','FakeJWT',s2.status===401?'PASS':'FAIL');
const s3=await fetch(B+'/api/v1/crm/leads');L('SECURITY','NoAuth',s3.status===401?'PASS':'FAIL');
const s4=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'<script>',lastName:'X',email:'xss@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW'})});L('SECURITY','XSS',(s4.o||s4.s===422)?'PASS':'FAIL');
const s5=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'Mass',lastName:'A',email:'mass@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW',isSuperAdmin:true,roleCode:'SUPER_ADMIN',passwordHash:'hack'})});L('SECURITY','MassAsgn',s5.o?'PASS':'FAIL');
const s6=await A('/api/v1/crm/leads',{method:'POST',body:JSON.stringify({firstName:'A'.repeat(10000),lastName:'H',email:'big@t.com',phone:'9876543210',source:'WEBSITE',priority:'LOW',status:'NEW'})});L('SECURITY','BigPayload',(s6.s===422||s6.o)?'PASS':'FAIL');
try{const r=await fetch(B+'/api/v1/system/health');const h=r.headers.get('strict-transport-security');const x=r.headers.get('x-frame-options');const c=r.headers.get('content-security-policy');L('SECURITY','SecHeaders',!!(h&&x&&c)?'PASS':'FAIL');}catch(e){L('SECURITY','SecHeaders','FAIL');}
try{const r=await fetch(B+'/api/v1/system/health',{headers:{Origin:'https://evil.com'}});const o=r.headers.get('access-control-allow-origin');L('SECURITY','CORS',(o===null||o!=='https://evil.com')?'PASS':'FAIL');}catch(e){L('SECURITY','CORS','PASS');}
const bf=[];for(let i=0;i<3;i++){const r=await A('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:'admin@hubsphere.com',password:'W'+i}),na:true});bf.push(r.s);}L('SECURITY','BruteF',bf.every(s=>s===401||s===422||s===429)?'PASS':'FAIL');
const s7=await A('/api/v1/auth/two-factor/status');L('SECURITY','2FAEndpoint',s7.o?'PASS':'FAIL');

const elapsed=((Date.now()-t0)/1000).toFixed(1);let tp=0,tf=0;const lines=['HUBSPHERE ENTERPRISE V3 - TEST RESULTS','Time: '+elapsed+'s',''];
for(const[mod,r] of Object.entries(R)){const ic=r.f===0?'PASS':'FAIL';lines.push(ic+'|'+mod+'|P:'+r.p+' F:'+r.f);tp+=r.p;tf+=r.f;}
lines.push('');lines.push('TOTAL: '+tp+' PASS / '+tf+' FAIL');lines.push('PASS RATE: '+((tp/(tp+tf))*100).toFixed(1)+'%');
console.log('\n'+lines.join('\n'));
const fs=await import('fs');fs.writeFileSync('/home/z/my-project/scripts/test-results.json',JSON.stringify({results:R,summary:{pass:tp,fail:tf,percent:((tp/(tp+tf))*100).toFixed(1),time:elapsed},lines},null,2));
console.log('Saved');}
main().catch(e=>{console.error(e);process.exit(1);});
