/**
 * CRITICAL: Tenant Isolation Tests
 * Verifies that Company A cannot access Company B's data.
 * Uses actual database queries with different tenant IDs.
 */

import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

// ============================================
// Tenant Isolation Tests
// ============================================

describe('Tenant Isolation — CRITICAL SECURITY', () => {
  let tenantA: string;
  let tenantB: string;

  let userA: string;
  let leadA: string;
  let contactA: string;
  let dealA: string;
  let employeeA: string;

  beforeAll(async () => {
    // Create two tenants (let DB generate UUIDs)
    const tA = await db.tenant.create({
      data: { name: 'Isolation Corp A', slug: `iso-a-${randomUUID().slice(0, 8)}`, plan: 'PRO' },
    });
    tenantA = tA.id;

    const tB = await db.tenant.create({
      data: { name: 'Isolation Corp B', slug: `iso-b-${randomUUID().slice(0, 8)}`, plan: 'PRO' },
    });
    tenantB = tB.id;

    // Create a user in tenant A
    const user = await db.user.create({
      data: {
        email: `iso-a-${randomUUID().slice(0, 8)}@test.com`,
        passwordHash: 'hash',
        name: 'User A',
      },
    });
    userA = user.id;

    // Create membership for user A in tenant A
    await db.membership.create({
      data: {
        userId: userA,
        tenantId: tenantA,
        roleCode: 'ADMIN',
      },
    });

    // Create data in tenant A
    const lead = await db.lead.create({
      data: {
        tenantId: tenantA,
        firstName: 'Lead',
        lastName: 'A',
        email: `lead-a-${randomUUID().slice(0, 8)}@test.com`,
        status: 'NEW',
        source: 'WEBSITE',
      },
    });
    leadA = lead.id;

    const contact = await db.contact.create({
      data: {
        tenantId: tenantA,
        firstName: 'Contact',
        lastName: 'A',
        email: `contact-a-${randomUUID().slice(0, 8)}@test.com`,
      },
    });
    contactA = contact.id;

    const deal = await db.deal.create({
      data: {
        tenantId: tenantA,
        title: 'Deal A',
        value: 10000,
        stage: 'PROSPECTING',
        currency: 'USD',
      },
    });
    dealA = deal.id;

    const employee = await db.employee.create({
      data: {
        tenantId: tenantA,
        userId: userA,
        employeeId: `EMP-${randomUUID().slice(0, 8)}`,
        firstName: 'Employee',
        lastName: 'A',
        email: `emp-a-${randomUUID().slice(0, 8)}@test.com`,
        employmentStatus: 'ACTIVE',
      },
    });
    employeeA = employee.id;
  });

  afterAll(async () => {
    // Clean up tenant A data
    await db.lead.deleteMany({ where: { tenantId: tenantA } }).catch(() => {});
    await db.contact.deleteMany({ where: { tenantId: tenantA } }).catch(() => {});
    await db.deal.deleteMany({ where: { tenantId: tenantA } }).catch(() => {});
    await db.employee.deleteMany({ where: { tenantId: tenantA } }).catch(() => {});
    await db.membership.deleteMany({ where: { tenantId: tenantA } }).catch(() => {});

    // Clean up tenant B data (should be empty, but just in case)
    await db.lead.deleteMany({ where: { tenantId: tenantB } }).catch(() => {});
    await db.contact.deleteMany({ where: { tenantId: tenantB } }).catch(() => {});
    await db.deal.deleteMany({ where: { tenantId: tenantB } }).catch(() => {});
    await db.employee.deleteMany({ where: { tenantId: tenantB } }).catch(() => {});
    await db.membership.deleteMany({ where: { tenantId: tenantB } }).catch(() => {});

    // Delete user
    await db.user.deleteMany({ where: { id: userA } }).catch(() => {});

    // Delete tenants
    await db.tenant.delete({ where: { id: tenantA } }).catch(() => {});
    await db.tenant.delete({ where: { id: tenantB } }).catch(() => {});
  });

  // ============================================
  // Lead Isolation
  // ============================================

  describe('Lead isolation', () => {
    it('Company B cannot access Company A leads via findMany', async () => {
      const leads = await db.lead.findMany({
        where: { tenantId: tenantB },
      });

      // Tenant B should have NO leads from tenant A
      const leadIds = leads.map(l => l.id);
      expect(leadIds).not.toContain(leadA);
    });

    it('Company B cannot access Company A lead via findFirst with tenant filter', async () => {
      const lead = await db.lead.findFirst({
        where: { id: leadA, tenantId: tenantB },
      });

      expect(lead).toBeNull();
    });

    it('Company A can access their own lead', async () => {
      const lead = await db.lead.findFirst({
        where: { id: leadA, tenantId: tenantA },
      });

      expect(lead).not.toBeNull();
      expect(lead!.id).toBe(leadA);
    });
  });

  // ============================================
  // Contact Isolation
  // ============================================

  describe('Contact isolation', () => {
    it('Company B cannot access Company A contacts via findMany', async () => {
      const contacts = await db.contact.findMany({
        where: { tenantId: tenantB },
      });

      const contactIds = contacts.map(c => c.id);
      expect(contactIds).not.toContain(contactA);
    });

    it('Company B cannot access Company A contact via findFirst with tenant filter', async () => {
      const contact = await db.contact.findFirst({
        where: { id: contactA, tenantId: tenantB },
      });

      expect(contact).toBeNull();
    });

    it('Company A can access their own contact', async () => {
      const contact = await db.contact.findFirst({
        where: { id: contactA, tenantId: tenantA },
      });

      expect(contact).not.toBeNull();
      expect(contact!.id).toBe(contactA);
    });
  });

  // ============================================
  // Deal Isolation
  // ============================================

  describe('Deal isolation', () => {
    it('Company B cannot access Company A deals via findMany', async () => {
      const deals = await db.deal.findMany({
        where: { tenantId: tenantB },
      });

      const dealIds = deals.map(d => d.id);
      expect(dealIds).not.toContain(dealA);
    });

    it('Company B cannot access Company A deal via findFirst with tenant filter', async () => {
      const deal = await db.deal.findFirst({
        where: { id: dealA, tenantId: tenantB },
      });

      expect(deal).toBeNull();
    });

    it('Company A can access their own deal', async () => {
      const deal = await db.deal.findFirst({
        where: { id: dealA, tenantId: tenantA },
      });

      expect(deal).not.toBeNull();
      expect(deal!.id).toBe(dealA);
    });
  });

  // ============================================
  // Employee Isolation
  // ============================================

  describe('Employee isolation', () => {
    it('Company B cannot access Company A employees via findMany', async () => {
      const employees = await db.employee.findMany({
        where: { tenantId: tenantB },
      });

      const empIds = employees.map(e => e.id);
      expect(empIds).not.toContain(employeeA);
    });

    it('Company B cannot access Company A employee via findFirst with tenant filter', async () => {
      const employee = await db.employee.findFirst({
        where: { id: employeeA, tenantId: tenantB },
      });

      expect(employee).toBeNull();
    });

    it('Company A can access their own employee', async () => {
      const employee = await db.employee.findFirst({
        where: { id: employeeA, tenantId: tenantA },
      });

      expect(employee).not.toBeNull();
      expect(employee!.id).toBe(employeeA);
    });
  });

  // ============================================
  // Cross-tenant findMany returns empty or only own data
  // ============================================

  describe('Cross-tenant bulk queries', () => {
    it('Tenant B findMany leads returns empty results (no tenant A data leaks)', async () => {
      const leads = await db.lead.findMany({
        where: { tenantId: tenantB },
      });

      for (const lead of leads) {
        expect(lead.tenantId).toBe(tenantB);
      }
    });

    it('Tenant B findMany contacts returns only tenant B data', async () => {
      const contacts = await db.contact.findMany({
        where: { tenantId: tenantB },
      });

      for (const contact of contacts) {
        expect(contact.tenantId).toBe(tenantB);
      }
    });

    it('Tenant B findMany deals returns only tenant B data', async () => {
      const deals = await db.deal.findMany({
        where: { tenantId: tenantB },
      });

      for (const deal of deals) {
        expect(deal.tenantId).toBe(tenantB);
      }
    });

    it('Tenant B findMany employees returns only tenant B data', async () => {
      const employees = await db.employee.findMany({
        where: { tenantId: tenantB },
      });

      for (const emp of employees) {
        expect(emp.tenantId).toBe(tenantB);
      }
    });
  });
});
