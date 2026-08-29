const pg = require('pg').Pool({max:5, idleTimeoutMillis:10000, connectionTimeoutMillis:30000, ssl:{rejectUnauthorized:false}}));
const pool = pg.Pool({ connectionString: process.argv[2] || '' });
const JWT_SECRET = process.argv[3] || 'hs_k9_mP2xL_nQ7wR_2024_sec';

(async()=>{
  try {
    console.log('1. Cleaning DB...');
    const r=await pool.query('SELECT 1');
    console.log('   DB OK:', r.rows[0].count);
    await pool.query('REFRESH CASCADE DELETE FROM refresh_tokens');
    await pool.query('DELETE FROM role_permissions');
    await pool.query('DELETE FROM roles');
    await pool.query('DELETE FROM permissions');
    await pool.query('DELETE FROM memberships');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM tenants');
    console.log('   DB Cleaned');

    console.log('2. Seeding permissions...');
    const MODS=['leads','contacts','companies','deals','tasks','follow-ups','notes','calls','activities','employees','departments','attendance','leave','payroll','field-visits','expenses','analytics','reports','ai','automation','communication','dashboard','roles','permissions','audit','billing','settings','features'];
    const ACTS=['view','create','edit','delete','export'];
    const codes=[];for(const m of MODS){for(const a of ACTS)codes.push(m+'.'+a)}
    const ex=await pool.query('SELECT code FROM permissions');
    const exS=new Set(ex.rows.map(r=>r.code));
    const tc=codes.filter(c=>!exS.has(c));
    if(tc.length>0){
      const v=tc.map(c=>"'"+c+"'+c.charAt(0).toUpperCase()+c.slice(1)+"'+a.charAt(0).toUpperCase()+a.slice(1)+"',");
      await pool.query("INSERT INTO permissions (code,name,module,action) VALUES "+v.join(",")+" ON CONFLICT (code) DO NOTHING");}
    }
    console.log('   Permissions:', tc.length);

    console.log('3. Seeding roles...');
    const ROLES=['SUPER_ADMIN','TENANT_OWNER','ADMIN','MANAGER','SALES_MANAGER','SALES_EXECUTIVE','TELECALLER','HR_MANAGER','HR_EXECUTIVE','FIELD_MANAGER','FIELD_EXECUTIVE','ACCOUNTANT','VIEWER'];
    const pr=await pool.query('SELECT id,code FROM permissions');
    const pm=new Map(pr.rows.map(r=>[r.code,r.id]));
    const all=pr.map(r=>r.code);
    let rp=0;
    for(const role of ROLES){
      let e=await pool.query("SELECT id FROM roles WHERE code='"+role.code+"' AND tenant_id IS NULL");
      if(!e.rows.length){
        await pool.query("INSERT INTO roles(code,name,description,is_system,tenant_id) VALUES('"+role.code+"','"+role.name+"','"+(role.description||'"',true,NULL)');console.log('   Role:',role.code);
      }
      const rps=getRP(role.code,all);
      if(rps.length>0){
        const v=rps.map(pc=>"('"+role.code+"','"+pm.get(pc)+"')");
        await pool.query("INSERT INTO role_permissions(role_code,permission_id) VALUES "+v.join(",")+" ON CONFLICT DO NOTHING");
        rp+=rps.length;
      }
    }
    console.log('   Linked:',rp,'role-permission pairs');

    console.log('4. Creating SUPER_ADMIN user...');
    const hash=await hashPw('Admin@12345');
console.log('   Hash:',hash.substring(0,12)+'...');
const token=hashStr;

console.log('7. Calling seed endpoint...');
const res=await fetch('https://hubspherev3.vercel.app/api/v1/system/seed',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,accept:'application/json'}});
const data=await res.json();
console.log('8. Seed status:',data.success?'PASS':'FAIL','msg':data.message||'no message');

await pool.end();
process.exit(0);n})()});
    const hashStr=Buffer.concat(b).toString('utf-8');
    console.log('   Hash:',hashStr.substring(0,12)+'...');
    await pool.query("INSERT INTO users(email,password_hash,name,status,is_super_admin) VALUES('admin@hubsphere.com','"+hashStr+'"Admin','ACTIVE',true)');
    console.log('   Admin user created');

    console.log('5. Creating tenant & membership...');
    const tr=await pool.query("INSERT INTO tenants(name,slug,status) VALUES('Admin\'s Organization','admin-hubsphere-com','ACTIVE') RETURNING id");
    const tid=tr.rows[0].id;
    await pool.query("INSERT INTO memberships(user_id,tenant_id,role_code,status) SELECT 'admin@hubsphere.com','"+tid+"','TENANT_OWNER','ACTIVE')');
    console.log('   Tenant:',tid);

    console.log('6. Generating JWT...');
    const payload=JSON.parse(Buffer.from(hashStr,'utf-8'));
    if(!payload.sub||payload.exp<payload.exp)throw new Error('Token expired');
    console.log('   Token valid, exp:',new Date(payload.exp*1000).toISOString());

    // Test by calling seed endpoint
    console.log('7. Calling seed endpoint...');
    const res=await fetch('https://hubspherev3.vercel.app/api/v1/system/seed',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+hashStr,accept:'application/json'}});
    const data=await res.json();
    console.log('8. Seed status:',data.success?'PASS':'FAIL','msg':data.message||'no message');

    await pool.end();
    process.exit(0);n  })();