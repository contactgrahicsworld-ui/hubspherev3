import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const updateFollowUpSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  followUpAt: z.string().datetime().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'MISSED', 'CANCELLED']).optional(),
  complete: z.boolean().optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const followUpSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  followUpAt: true,
  completedAt: true,
  userId: true,
  leadId: true,
  contactId: true,
  dealId: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
} as const;

function isDbError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
  );
}

function dbUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
    { status: 503 },
  );
}

// ============================================
// GET /api/v1/crm/follow-ups/:id
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

    await requirePermission(payload.roleCode ?? null, 'followups.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const followUp = await db.followUp.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: followUpSelect,
    });

    if (!followUp) {
      throw new NotFoundError('Follow-up not found');
    }

    return NextResponse.json(success(followUp));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PUT /api/v1/crm/follow-ups/:id (with complete logic)
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

    await requirePermission(payload.roleCode ?? null, 'followups.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.followUp.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Follow-up not found');
    }

    if (existing.status === 'COMPLETED') {
      throw new ValidationError('This follow-up is already completed');
    }

    const body = await request.json();
    const data = validate(updateFollowUpSchema, body);

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.followUpAt !== undefined) updateData.followUpAt = new Date(data.followUpAt);
    if (data.status !== undefined) updateData.status = data.status;

    // Complete logic: sets completedAt and status=COMPLETED
    if (data.complete === true) {
      updateData.status = 'COMPLETED';
      updateData.completedAt = new Date();
    }

    const followUp = await db.followUp.update({
      where: { id },
      data: updateData,
      select: followUpSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'followup.update',
      targetType: 'FollowUp',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(followUp, 'Follow-up updated successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/crm/follow-ups/:id — Soft delete
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

    await requirePermission(payload.roleCode ?? null, 'followups.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.followUp.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Follow-up not found');
    }

    await db.followUp.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'followup.archive',
      targetType: 'FollowUp',
      targetId: id,
      metadata: { title: existing.title },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Follow-up archived successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
