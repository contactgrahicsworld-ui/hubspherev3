import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new NotFoundError('Resource not found');
  }
}

// ============================================
// SCHEMAS
// ============================================

const updateDealSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  value: z.number().min(0).optional(),
  currency: z.string().trim().max(10).optional(),
  stage: z.string().trim().max(50).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  contactId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  lostReason: z.string().max(2000).nullable().optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const dealSelect = {
  id: true,
  title: true,
  value: true,
  currency: true,
  stage: true,
  probability: true,
  expectedCloseDate: true,
  contactId: true,
  companyId: true,
  ownerId: true,
  notes: true,
  lostReason: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
  contact: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  company: {
    select: { id: true, name: true, industry: true },
  },
  owner: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
} as const;

function formatDeal(deal: any) {
  return {
    id: deal.id,
    title: deal.title,
    value: deal.value,
    currency: deal.currency,
    stage: deal.stage,
    probability: deal.probability,
    expectedCloseDate: deal.expectedCloseDate,
    contactId: deal.contactId,
    contact: deal.contact,
    companyId: deal.companyId,
    company: deal.company,
    ownerId: deal.ownerId,
    owner: deal.owner,
    notes: deal.notes,
    lostReason: deal.lostReason,
    archived: deal.archived,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
  };
}

// ============================================
// GET /api/v1/crm/deals/:id
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'deals.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;
    validateUuid(id);

    const deal = await db.deal.findFirst({
      where: {
        id,
        tenantId: payload.tenantId,
        archived: false,
      },
      select: dealSelect,
    });

    if (!deal) {
      throw new NotFoundError('Deal not found');
    }

    return NextResponse.json(success(formatDeal(deal as any)));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PUT /api/v1/crm/deals/:id
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'deals.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;
    validateUuid(id);

    const existing = await db.deal.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!existing) {
      throw new NotFoundError('Deal not found');
    }

    const body = await request.json();
    const data = validate(updateDealSchema, body);

    // Validate contact belongs to tenant if provided
    if (data.contactId) {
      const contact = await db.contact.findFirst({
        where: { id: data.contactId, tenantId: payload.tenantId, archived: false },
        select: { id: true },
      });
      if (!contact) {
        throw new ValidationError('Contact not found');
      }
    }

    // Validate company belongs to tenant if provided
    if (data.companyId) {
      const company = await db.company.findFirst({
        where: { id: data.companyId, tenantId: payload.tenantId, archived: false },
        select: { id: true },
      });
      if (!company) {
        throw new ValidationError('Company not found');
      }
    }

    // Validate owner belongs to the same tenant if provided
    if (data.ownerId) {
      const ownerExists = await db.membership.findFirst({
        where: { userId: data.ownerId, tenantId: payload.tenantId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!ownerExists) {
        throw new ValidationError('Owner not found');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.stage !== undefined) updateData.stage = data.stage;
    if (data.probability !== undefined) updateData.probability = data.probability;
    if (data.expectedCloseDate !== undefined) {
      updateData.expectedCloseDate = data.expectedCloseDate ? new Date(data.expectedCloseDate) : null;
    }
    if (data.contactId !== undefined) updateData.contactId = data.contactId;
    if (data.companyId !== undefined) updateData.companyId = data.companyId;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.lostReason !== undefined) updateData.lostReason = data.lostReason;

    // Track stage change in history within a transaction
    const deal = await db.$transaction(async (tx) => {
      const updated = await tx.deal.update({
        where: { id },
        data: updateData,
        select: dealSelect,
      });

      // If stage changed, record it in stage history
      if (data.stage !== undefined && data.stage !== existing.stage) {
        await tx.stageHistory.create({
          data: {
            dealId: id,
            fromStage: existing.stage,
            toStage: data.stage,
            movedBy: payload.userId,
          },
        });
      }

      return updated;
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'deal.update',
      targetType: 'Deal',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatDeal(deal as any), 'Deal updated successfully'),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/crm/deals/:id — Archive
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'deals.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;
    validateUuid(id);

    const existing = await db.deal.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!existing) {
      throw new NotFoundError('Deal not found');
    }

    await db.deal.update({
      where: { id },
      data: { archived: true },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'deal.archive',
      targetType: 'Deal',
      targetId: id,
      metadata: { title: existing.title, value: existing.value, stage: existing.stage },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Deal archived successfully'));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
