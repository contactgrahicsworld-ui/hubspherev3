const { Client } = require('pg');
async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const r = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log('TABLES (' + r.rows.length + '):');
  r.rows.forEach(row => console.log('  ✅ ' + row.tablename));
  await client.end();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });