const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true' } }
});
(async () => {
  const cols = await p.$queryRawUnsafe("SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'role_permissions' ORDER BY ordinal_position;");
  console.log(JSON.stringify(cols, null, 2));
  await p.$disconnect();
})();
