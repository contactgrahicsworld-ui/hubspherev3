#!/usr/bin/env node
/**
 * Tenant Isolation Verification Script for HubSphere V3
 * 
 * Checks:
 * 1. Counts tenants, users, memberships
 * 2. Verifies each user's data is scoped to their tenant via memberships
 * 3. Detects cross-tenant references (records whose ownerId points to a user
 *    with no membership in that record's tenant)
 */

const { PrismaClient } = require("@prisma/client");

// Use direct connection (port 5432) for full Prisma support
const DIRECT_URL =
  "postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";

const prisma = new PrismaClient({
  datasources: { db: { url: DIRECT_URL } },
});

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";
const WARN = "⚠️  WARN";

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  HubSphere V3 — Tenant Isolation Verification");
  console.log("═══════════════════════════════════════════════════\n");

  const results = { pass: 0, fail: 0, warn: 0 };

  // ─── 1. COUNTS ───────────────────────────────────────
  console.log("── 1. Record Counts ──────────────────────────────\n");

  const [tenants, users, memberships] = await Promise.all([
    prisma.tenant.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, isSuperAdmin: true },
    }),
    prisma.membership.findMany({
      select: { id: true, userId: true, tenantId: true, roleCode: true, status: true },
    }),
  ]);

  console.log(`  Tenants     : ${tenants.length}`);
  console.log(`  Users       : ${users.length}`);
  console.log(`  Memberships : ${memberships.length}`);

  // Build lookup maps
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  // userId → Set<tenantId>  (from memberships)
  const userTenants = new Map();
  for (const m of memberships) {
    if (!userTenants.has(m.userId)) userTenants.set(m.userId, new Set());
    userTenants.get(m.userId).add(m.tenantId);
  }

  console.log("");

  // ─── 2. MEMBERSHIP INTEGRITY ────────────────────────
  console.log("── 2. Membership Integrity ───────────────────────\n");

  // 2a. Every membership.userId should point to a real user
  const orphanUserMemberships = memberships.filter((m) => !userMap.has(m.userId));
  if (orphanUserMemberships.length === 0) {
    console.log(`  ${PASS} All memberships reference valid users`);
    results.pass++;
  } else {
    console.log(`  ${FAIL} ${orphanUserMemberships.length} memberships reference non-existent users`);
    for (const m of orphanUserMemberships.slice(0, 5))
      console.log(`      userId=${m.userId} tenantId=${m.tenantId}`);
    results.fail++;
  }

  // 2b. Every membership.tenantId should point to a real tenant
  const orphanTenantMemberships = memberships.filter((m) => !tenantMap.has(m.tenantId));
  if (orphanTenantMemberships.length === 0) {
    console.log(`  ${PASS} All memberships reference valid tenants`);
    results.pass++;
  } else {
    console.log(`  ${FAIL} ${orphanTenantMemberships.length} memberships reference non-existent tenants`);
    for (const m of orphanTenantMemberships.slice(0, 5))
      console.log(`      userId=${m.userId} tenantId=${m.tenantId}`);
    results.fail++;
  }

  // 2c. Users with NO memberships (potentially stranded)
  const usersWithNoMembership = users.filter((u) => !userTenants.has(u.id));
  if (usersWithNoMembership.length === 0) {
    console.log(`  ${PASS} Every user has at least one membership`);
    results.pass++;
  } else {
    console.log(
      `  ${WARN} ${usersWithNoMembership.length} users have no membership (may be super-admins or stranded)`
    );
    for (const u of usersWithNoMembership.slice(0, 5))
      console.log(`      ${u.email} (superAdmin=${u.isSuperAdmin})`);
    results.warn++;
  }

  console.log("");

  // ─── 3. CROSS-TENANT REFERENCE CHECKS ───────────────
  console.log("── 3. Cross-Tenant Reference Checks ──────────────\n");

  /**
   * Generic check: for a tenant-scoped model that has an owner/user FK,
   * verify the owner belongs to the same tenant.
   */
  async function checkCrossTenant(modelName, tenantIdField, ownerIdField, ownerLabel) {
    // Use raw SQL for flexibility — we don't know the exact column names at runtime
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, ${tenantIdField} AS "tenantId", ${ownerIdField} AS "ownerId"
      FROM "${modelName}"
      WHERE ${tenantIdField} IS NOT NULL AND ${ownerIdField} IS NOT NULL
    `);

    const violations = [];
    for (const row of rows) {
      const allowedTenants = userTenants.get(row.ownerId);
      if (!allowedTenants || !allowedTenants.has(row.tenantId)) {
        const owner = userMap.get(row.ownerId);
        violations.push({
          recordId: row.id,
          tenantId: row.tenantId,
          ownerId: row.ownerId,
          ownerEmail: owner?.email || "UNKNOWN",
        });
      }
    }

    if (violations.length === 0) {
      console.log(`  ${PASS} ${modelName}: all ${ownerLabel}s belong to the record's tenant (${rows.length} records checked)`);
      results.pass++;
    } else {
      console.log(`  ${FAIL} ${modelName}: ${violations.length} cross-tenant ${ownerLabel} reference(s) found`);
      for (const v of violations.slice(0, 5))
        console.log(`      record=${v.recordId} tenantId=${v.tenantId} owner=${v.ownerEmail}`);
      if (violations.length > 5) console.log(`      ... and ${violations.length - 5} more`);
      results.fail++;
    }
  }

  // Check CRM entities with ownerUserId
  await checkCrossTenant("leads", "tenant_id", "owner_id", "owner");
  await checkCrossTenant("contacts", "tenant_id", "owner_id", "owner");
  await checkCrossTenant("companies", "tenant_id", "owner_id", "owner");
  await checkCrossTenant("deals", "tenant_id", "owner_id", "owner");
  await checkCrossTenant("tasks", "tenant_id", "owner_id", "owner");
  await checkCrossTenant("follow_ups", "tenant_id", "user_id", "owner");

  // Check HRMS: employee → userId should be in same tenant
  await checkCrossTenant("employees", "tenant_id", "user_id", "user");

  // Check audit_logs: actorId should be in same tenant
  await checkCrossTenant("audit_logs", "tenant_id", "actor_id", "actor");

  console.log("");

  // ─── 4. TENANT DATA ISOLATION SUMMARY ───────────────
  console.log("── 4. Per-Tenant Data Isolation Summary ──────────\n");

  for (const tenant of tenants) {
    const memberCount = memberships.filter((m) => m.tenantId === tenant.id).length;
    const memberUserIds = new Set(
      memberships.filter((m) => m.tenantId === tenant.id).map((m) => m.userId)
    );

    // Count CRM records per tenant via raw SQL
    const counts = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT count(*) FROM leads WHERE tenant_id = '${tenant.id}')        AS leads,
        (SELECT count(*) FROM contacts WHERE tenant_id = '${tenant.id}')     AS contacts,
        (SELECT count(*) FROM companies WHERE tenant_id = '${tenant.id}')    AS companies,
        (SELECT count(*) FROM deals WHERE tenant_id = '${tenant.id}')        AS deals,
        (SELECT count(*) FROM tasks WHERE tenant_id = '${tenant.id}')        AS tasks,
        (SELECT count(*) FROM employees WHERE tenant_id = '${tenant.id}')    AS employees
    `);

    const c = counts[0];
    console.log(
      `  Tenant "${tenant.name}" (${tenant.slug}): ${memberCount} members, ` +
      `${Number(c.leads)} leads, ${Number(c.contacts)} contacts, ${Number(c.companies)} companies, ` +
      `${Number(c.deals)} deals, ${Number(c.tasks)} tasks, ${Number(c.employees)} employees`
    );

    // Spot-check: sample a few leads, verify their owner belongs to this tenant
    const sampleLeadsOwners = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT owner_id FROM leads
      WHERE tenant_id = '${tenant.id}' AND owner_id IS NOT NULL
      LIMIT 20
    `);

    let tenantLeakFound = false;
    for (const row of sampleLeadsOwners) {
      if (!memberUserIds.has(row.owner_id)) {
        const owner = userMap.get(row.owner_id);
        console.log(
          `    ${FAIL} Lead owner ${owner?.email || row.owner_id} is NOT a member of tenant "${tenant.name}"`
        );
        tenantLeakFound = true;
      }
    }
    if (!tenantLeakFound && sampleLeadsOwners.length > 0) {
      console.log(`    ${PASS} Sampled lead owners all belong to this tenant`);
      results.pass++;
    }
  }

  console.log("");

  // ─── 5. RLS POLICY CHECK (Postgres) ─────────────────
  console.log("── 5. Row-Level Security Policy Check ────────────\n");

  const rlsTables = await prisma.$queryRawUnsafe(`
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `);

  if (rlsTables.length === 0) {
    console.log(`  ${WARN} No RLS policies found in the public schema`);
    console.log("      Tenant isolation relies solely on application-level filtering.");
    results.warn++;
  } else {
    console.log(`  ${PASS} ${rlsTables.length} RLS policies found in public schema`);
    const tablesWithRLS = new Set(rlsTables.map((r) => r.tablename));
    console.log(`      Tables with RLS: ${[...tablesWithRLS].join(", ")}`);

    // Check if RLS is actually ENABLED (not just policies existing)
    const rlsEnabled = await prisma.$queryRawUnsafe(`
      SELECT relname AS tablename, relrowsecurity AS rls_enabled
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relrowsecurity = true
      ORDER BY relname
    `);
    if (rlsEnabled.length > 0) {
      console.log(
        `      RLS enforced on: ${rlsEnabled.map((r) => r.tablename).join(", ")}`
      );
      results.pass++;
    } else {
      console.log(`  ${WARN} RLS policies exist but enforcement (ALTER TABLE ... ENABLE ROW LEVEL SECURITY) may not be active`);
      results.warn++;
    }
  }

  console.log("");

  // ─── FINAL SUMMARY ──────────────────────────────────
  console.log("═══════════════════════════════════════════════════");
  console.log(`  RESULTS:  ${results.pass} passed  |  ${results.fail} failed  |  ${results.warn} warnings`);
  console.log("═══════════════════════════════════════════════════\n");

  if (results.fail === 0) {
    console.log("  🏁 TENANT ISOLATION VERIFIED — No cross-tenant leaks detected.\n");
  } else {
    console.log("  🚨 TENANT ISOLATION BREACH — Cross-tenant references found!\n");
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  prisma.$disconnect();
  process.exit(1);
});
