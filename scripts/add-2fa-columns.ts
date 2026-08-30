import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true' } }
});
async function migrate() {
  console.log('Adding 2FA columns...');
  try { await PrismaClient.prototype['$executeRawUnsafe'].call(db, "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false"); console.log('  OK: two_factor_enabled'); } catch(e:any){console.log('  SKIP two_factor_enabled:',e.message?.substring(0,80));}
  try { await PrismaClient.prototype['$executeRawUnsafe'].call(db, "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT"); console.log('  OK: two_factor_secret'); } catch(e:any){console.log('  SKIP two_factor_secret:',e.message?.substring(0,80));}
  try { await PrismaClient.prototype['$executeRawUnsafe'].call(db, "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_recovery_codes JSONB DEFAULT '[]'::jsonb"); console.log('  OK: two_factor_recovery_codes'); } catch(e:any){console.log('  SKIP two_factor_recovery_codes:',e.message?.substring(0,80));}
  console.log('Done');
  await db['$disconnect']();
}
migrate().catch(e=>{console.error(e);process.exit(1);});
