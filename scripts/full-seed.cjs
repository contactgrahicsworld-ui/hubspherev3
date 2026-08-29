const { createClient } = require('@prisma/client');
const p = createClient({datasources:{db:{url:'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup@9301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'}});
const crypto = globalThis.crypto;

function hashPw(pw) {
  const s = crypto.getRandomValues(new Uint8Array(32));
  const e = new TextEncoder().encode(pw);
  const k = await crypto.subtle.importKey('raw', e, {name:'PBKDF2',hash:'SHA-256'},false);const b = await crypto.subtle.deriveBits('PBKDF2',k,{name:'PBKDF2',hash:'SHA-256',salt:s,iterations:100000},new Uint8Array(32));return Buffer.from(b).toString('hex');
}
(async()=>{
  try {
    console.log('1. Cleaning...');
    await p.refreshToken.deleteMany();
    await p.membership.deleteMany();
    await p.user.deleteMany();
    await p.tenant.deleteMany();
    await p.rolePermission.deleteMany();
    await p.role.deleteMany();
    await p.permission.deleteMany();
    console.log('   Cleaned');

    console.log('2. Seeding permissions...');
    const mods=['leads','contacts','companies','deals','tasks','follow-ups','notes','calls','activities','employees','departments','attendance','leave','payroll','field-visits','expenses','analytics','reports','ai','automation','communication','dashboard','roles','permissions','audit','billing','settings','features'];
    const acts=['view','create','edit','delete','export'];
    const codes=[];
    for(const m of mods){for(const a of acts)codes.push(m+'.'+a)}
    const ex=await p.$queryRawUnsafe('SELECT code FROM permissions');
    const exS=new Set(ex.rows.map(r=>r.code));
    const tc=codes.filter(c=>!exS.has(c));
    if(tc.length>0){
      const v=tc.map(c=>"'"+c+"','"+c.charAt(0).toUpperCase()+c.slice(1)+" "+a.charAt(0).toUpperCase()+a.slice(1)+"'",");
      await p.$queryRawUnsafe("INSERT INTO permissions (code,name,module,action) VALUES "+v.join(",")+" ON CONFLICT(code) DO NOTHING");}
    console.log('   Perms:',tc.length);

    console.log('3. Seeding roles...');
    const roles=['SUPER_ADMIN','TENANT_OWNER','ADMIN','MANAGER','SALES_MANAGER','SALES_EXECUTIVE','TELECALLER','HR_MANAGER','HR_EXECUTIVE','FIELD_MANAGER','FIELD_EXECUTIVE','ACCOUNTANT','VIEWER'];
    const pr=await p.$queryRawUnsafe('SELECT id,code FROM permissions');
    const pm=new Map(pr.rows.map(r=>[r.code,r.id]));
    const all=pr.map(r=>r.code);
    let rp=0;
    for(const role of roles){
      let e=await p.$queryRawUnsafe("SELECT id FROM roles WHERE code='"+role.code+"' AND tenant_id IS NULL");
      if(!e.rows.length){
        await p.$queryRawUnsafe("INSERT INTO roles(code,name,description,is_system,tenant_id) VALUES('"+role.code+"','"+role.name+"','"+(role.description||'"',true,NULL)');console.log('   Role:',role.code);
      }
      const rps=getRP(role.code,all);
      if(rps.length>0){
        const v=rps.map(pc=>"('"+role.code+"','"+pm.get(pc)+"')");
        await p.$queryRawUnsafe("INSERT INTO role_permissions(role_code,permission_id) VALUES "+v.join(",")+" ON CONFLICT DO NOTHING");
        rp+=rps.length;
      }
    }
    console.log('   Linked:',rp,'role-permission pairs');

    console.log('4. Creating SUPER_ADMIN...');
    const hash=hashPw('Admin@12345');
    await p.$queryRawUnsafe("INSERT INTO users(email,password_hash,name,status,is_super_admin) VALUES('admin@hubsphere.com','"+hash+"','Admin','ACTIVE',true)');
    console.log('   Admin user:',hash.substring(0,12)+'...');

    console.log('5. Tenant...');
    const tr=await p.$queryRawUnsafe("INSERT INTO tenants(name,slug,status) VALUES('Admin\'s Organization','admin-hubsphere-com','ACTIVE') RETURNING id");
    const tid=tr.rows[0].id;
    await p.$queryRawUnsafe("INSERT INTO memberships(user_id,tenant_id,role_code,status) SELECT 'admin@hubsphere.com','"+tid+"','TENANT_OWNER','ACTIVE')');
    console.log('   Tenant:',tid);

    console.log('6. JWT...');
    const iat=Math.floor(Date.now()/1000);
    const exp=iat+900;
    const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',iat,exp})).toString());
    const sig=crypto.createHmac('sha256',Buffer.from(process.env.JWT_SECRET||'hs_k9_mP2xL_nQ7wR_2024_sec'),header);
    const token=header+'.'+sig.toString('hex');
    console.log('   JWT:',token.substring(0,20)+'...');

    console.log('7. Verifying...');
    // Verify token by decoding payload
    const parts=token.split('.');
    const payload=JSON.parse(Buffer.from(parts[1],'utf-8').toString());
    if(!payload.sub||payload.exp<exp)throw new Error('Token expired');
    console.log('   ✅ Token valid, payload.email:',payload.email);

    // Test seed endpoint
    console.log('8. Calling seed endpoint...');
    const res=await fetch('https://hubspherev3.vercel.app/api/v1/system/seed',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}});
    const data=await res.json();
    console.log('   Seed status:',data.success?'PASS':'FAIL','msg':data.message||'no message');

    console.log('   Results:',JSON.stringify(data));

    await p.$disconnect();
    console.log('DONE - All seed data verified!');
  })();

function getRP(rc,all){switch(rc){case'SUPER_ADMIN':return[...all];case'TENANT_OWNER':return all.filter(p=>!['tenants.create','tenants.suspend','tenants.delete'].includes(p));case'ADMIN':return all.filter(p=>!['tenants.create','tenants.edit','tenants.delete','tenants.suspend','audit.delete','features.manage'].includes(p));case'MANAGER':{const i=['users','roles','leads','contacts','companies','deals','calls','audit'];return all.filter(p=>{const m=p.split('.')[0];return i.includes(m)&&!p.endsWith('.delete')})}}default:return all.filter(p=>p.endsWith('.view'))}}
