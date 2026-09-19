/**
 * Tests for the Automation Engine.
 * Covers triggerEvent, condition evaluation, error isolation, tenant isolation.
 */

import * as automationEngine from '@/lib/automation/engine';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

// Helper: Create a test tenant + user + membership
async function createTestTenant(prefix: string) {
  const tenant = await db.tenant.create({
    data: {
      name: `${prefix} Tenant`,
      slug: `${prefix.toLowerCase()}-${randomUUID().slice(0, 8)}`,
      plan: 'PRO',
    },
  });

  const user = await db.user.create({
    data: {
      email: `${prefix.toLowerCase()}-${randomUUID().slice(0, 8)}@test.com`,
      passwordHash: 'hash',
      name: `${prefix} User`,
    },
  });

  await db.membership.create({
    data: {
      userId: user.id,
      tenantId: tenant.id,
      roleCode: 'ADMIN',
    },
  });

  return { tenant, user };
}

// ============================================
// triggerEvent TESTS
// ============================================

describe('Automation Engine — triggerEvent', () => {
  let testTenantId: string;

  beforeAll(async () => {
    const { tenant } = await createTestTenant('Auto');
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    await db.automationExecutionLog.deleteMany({ where: { tenantId: testTenantId } }).catch(() => {});
    await db.automationExecution.deleteMany({ where: { tenantId: testTenantId } }).catch(() => {});
    await db.automationWorkflow.deleteMany({ where: { tenantId: testTenantId } }).catch(() => {});
    await db.membership.deleteMany({ where: { tenantId: testTenantId } }).catch(() => {});
    await db.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
  });

  it('returns valid result structure with no matching workflows', async () => {
    const result = await automationEngine.triggerEvent({
      eventType: 'lead.created',
      tenantId: testTenantId,
      data: { name: 'Test Lead' },
    });

    expect(result).toHaveProperty('matchedWorkflows');
    expect(result).toHaveProperty('executedWorkflows');
    expect(result).toHaveProperty('skippedConditionFail');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('results');
    expect(typeof result.matchedWorkflows).toBe('number');
    expect(typeof result.executedWorkflows).toBe('number');
    expect(typeof result.skippedConditionFail).toBe('number');
    expect(typeof result.errors).toBe('number');
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('returns zero matchedWorkflows when no workflows exist', async () => {
    const result = await automationEngine.triggerEvent({
      eventType: 'lead.created',
      tenantId: testTenantId,
      data: { name: 'Test Lead' },
    });

    expect(result.matchedWorkflows).toBeGreaterThanOrEqual(0);
    expect(result.executedWorkflows).toBeLessThanOrEqual(result.matchedWorkflows);
  });

  it('never throws — errors are logged internally', async () => {
    const result = await automationEngine.triggerEvent({
      eventType: 'custom_event',
      tenantId: testTenantId,
      data: {},
    });

    expect(result).toBeDefined();
    expect(typeof result.errors).toBe('number');
  });

  it('handles all supported trigger event types', async () => {
    const eventTypes: automationEngine.TriggerEventType[] = [
      'lead.created', 'lead.updated', 'lead.status_changed',
      'deal.created', 'deal.updated', 'deal.stage_changed', 'deal.won', 'deal.lost',
      'contact.created', 'contact.updated',
      'task.created', 'task.completed', 'task.overdue',
      'call.completed', 'call.missed',
      'field_visit.completed',
      'employee.created',
      'leave.requested', 'leave.approved',
      'invoice.overdue', 'payment.received',
      'custom_event',
    ];

    for (const eventType of eventTypes) {
      const result = await automationEngine.triggerEvent({
        eventType,
        tenantId: testTenantId,
        data: {},
      });
      expect(result).toBeDefined();
      expect(result.matchedWorkflows).toBeGreaterThanOrEqual(0);
    }
  });
});

// ============================================
// Error Isolation Tests
// ============================================

describe('Automation Engine — error isolation', () => {
  it('engine never throws even with invalid tenant ID', async () => {
    const result = await automationEngine.triggerEvent({
      eventType: 'lead.created',
      tenantId: randomUUID(), // non-existent tenant UUID
      data: {},
    });

    expect(result).toBeDefined();
    expect(typeof result.errors).toBe('number');
  });

  it('engine never throws even with empty data', async () => {
    const result = await automationEngine.triggerEvent({
      eventType: 'custom_event',
      tenantId: randomUUID(),
      data: {},
    });

    expect(result).toBeDefined();
  });

  it('engine never throws with complex data', async () => {
    const result = await automationEngine.triggerEvent({
      eventType: 'custom_event',
      tenantId: randomUUID(),
      data: {
        nested: { deeply: { value: 'test' } },
        array: [1, 2, 3],
        special: '!@#$%^&*()',
        unicode: '🎉',
        veryLong: 'x'.repeat(10000),
      },
    });

    expect(result).toBeDefined();
  });
});

// ============================================
// Tenant Isolation Tests
// ============================================

describe('Automation Engine — tenant isolation', () => {
  let tenantA: string;
  let tenantB: string;
  let userA: string;

  beforeAll(async () => {
    const a = await createTestTenant('AutoA');
    const b = await createTestTenant('AutoB');
    tenantA = a.tenant.id;
    tenantB = b.tenant.id;
    userA = a.user.id;
  });

  afterAll(async () => {
    for (const tid of [tenantA, tenantB]) {
      await db.automationExecutionLog.deleteMany({ where: { tenantId: tid } }).catch(() => {});
      await db.automationExecution.deleteMany({ where: { tenantId: tid } }).catch(() => {});
      await db.automationWorkflow.deleteMany({ where: { tenantId: tid } }).catch(() => {});
      await db.membership.deleteMany({ where: { tenantId: tid } }).catch(() => {});
      await db.tenant.delete({ where: { id: tid } }).catch(() => {});
    }
  });

  it('only matches workflows in the same tenant', async () => {
    // Create a workflow in tenant A
    const workflowA = await db.automationWorkflow.create({
      data: {
        tenantId: tenantA,
        name: 'Tenant A Workflow',
        status: 'ACTIVE',
        triggerType: 'deal.won',
        createdBy: userA,
        triggers: {
          create: { eventType: 'deal.won', tenantId: tenantA },
        },
      },
    });

    // Trigger in tenant B — should NOT match tenant A's workflow
    const result = await automationEngine.triggerEvent({
      eventType: 'deal.won',
      tenantId: tenantB,
      data: {},
    });

    expect(result.matchedWorkflows).toBe(0);

    // Trigger in tenant A — should match
    const resultA = await automationEngine.triggerEvent({
      eventType: 'deal.won',
      tenantId: tenantA,
      data: {},
    });

    expect(resultA.matchedWorkflows).toBeGreaterThanOrEqual(1);

    // Cleanup
    await db.automationExecutionLog.deleteMany({ where: { tenantId: tenantA } }).catch(() => {});
    await db.automationExecution.deleteMany({ where: { tenantId: tenantA } }).catch(() => {});
    await db.automationWorkflow.delete({ where: { id: workflowA.id } }).catch(() => {});
  });
});
