const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Connecting to Supabase...');
  await client.connect();
  console.log('Connected!');

  const sql = require('fs').readFileSync('/home/z/my-project/scripts/schema.sql', 'utf8');
  
  console.log('Executing schema (' + sql.length + ' chars)...');
  await client.query(sql);
  console.log('Schema created successfully!');

  await client.end();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
