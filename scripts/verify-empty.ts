import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
    }
  }
});
async function check() {
  const models = ['tenant','user','role','permission','lead','contact','deal','company','employee','department','refreshToken','auditLog'];
  for (const m of models) {
    // @ts-expect-error dynamic model access
    const c = await db[m].count();
    console.log(m + ': ' + c);
  }
  await db.$disconnect();
}
check();
