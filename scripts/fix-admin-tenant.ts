import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true' } }
});
async function fix() {
  // Find super admin
  const admin = await db.user.findFirst({ where: { isSuperAdmin: true } });
  if (!admin) { console.log('No admin found'); return; }
  console.log('Found admin:', admin.email, admin.id);

  // Check existing memberships
  const existing = await db.membership.findMany({ where: { userId: admin.id } });
  console.log('Existing memberships:', existing.length);
  if (existing.length > 0) {
    console.log('Admin already has membership, tenantId:', existing[0].tenantId);
    return;
  }

  // Find or create default tenant
  let tenant = await db.tenant.findFirst({ where: { slug: 'hubsphere-enterprise' } });
  if (!tenant) {
    tenant = await db.tenant.create({
      data: {
        name: 'HubSphere Enterprise',
        slug: 'hubsphere-enterprise',
        status: 'ACTIVE',
        plan: 'ENTERPRISE',
        maxUsers: 1000,
        settings: {},
      },
    });
    console.log('Created tenant:', tenant.id);
  } else {
    console.log('Found existing tenant:', tenant.id);
  }

  // Create membership
  const membership = await db.membership.create({
    data: {
      userId: admin.id,
      tenantId: tenant.id,
      roleCode: 'TENANT_OWNER',
      status: 'ACTIVE',
    },
  });
  console.log('Created membership:', membership.id, 'tenantId:', tenant.id);

  // Verify
  const verify = await db.user.findUnique({
    where: { id: admin.id },
    include: { memberships: { include: { tenant: true } } },
  });
  console.log('Verified - memberships:', verify?.memberships.length);
  verify?.memberships.forEach(m => console.log('  ', m.roleCode, '->', m.tenant.name, m.tenantId));

  await db.$disconnect();
}
fix().catch(e => { console.error(e); process.exit(1); });
