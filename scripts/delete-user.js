const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true' } }
});
(async () => {
  try {
    const uid = '31c85450-759a-4585-b780-64b92f4bc143';

    // Delete related records
    await p.$executeRawUnsafe(`DELETE FROM refresh_tokens WHERE user_id = $1::uuid;`, uid);
    console.log('RefreshTokens deleted');

    await p.$executeRawUnsafe(`DELETE FROM audit_logs WHERE actor_id = $1::uuid;`, uid);
    console.log('AuditLogs deleted');

    await p.$executeRawUnsafe(`DELETE FROM password_reset_tokens WHERE user_id = $1::uuid;`, uid);
    console.log('PasswordResetTokens deleted');

    await p.$executeRawUnsafe(`DELETE FROM email_verification_tokens WHERE user_id = $1::uuid;`, uid);
    console.log('EmailVerificationTokens deleted');

    await p.$executeRawUnsafe(`DELETE FROM memberships WHERE user_id = $1::uuid;`, uid);
    console.log('Memberships deleted');

    // Delete the user
    await p.$executeRawUnsafe(`DELETE FROM users WHERE id = $1::uuid;`, uid);
    console.log('User deleted successfully');

    // Verify
    const remaining = await p.$queryRawUnsafe(`SELECT id, email FROM users;`);
    console.log('Remaining users:', JSON.stringify(remaining));
  } catch(e) { console.error('Error:', e.message); }
  await p.$disconnect();
})();
