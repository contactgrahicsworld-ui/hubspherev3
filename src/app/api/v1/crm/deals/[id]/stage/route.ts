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

// ============================================
// SCHEMA
// ============================================

const moveStageSchema = z.object({
  toStage: z.string().trim().min(1, 'Target stage is required').max(50),
});

// ============================================
// PUT /api/v1/crm/deals/:id/stage — Move deal to new stage
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

    const deal = await db.deal.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!deal) {
      throw new NotFoundError('Deal not found');
    }

    const body = await request.json();
    const data = validate(moveStageSchema, body);

    const fromStage = deal.stage;
    const toStage = data.toStage;

    if (fromStage === toStage) {
      throw new ValidationError('Deal is already in the target stage');
    }

    // Move the deal stage
    const updatedDeal = await db.deal.update({
      where: { id },
      data: { stage: toStage },
      select: {
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
      },
    });

    // Create stage history record
    const stageHistory = await db.stageHistory.create({
      data: {
        dealId: id,
        fromStage,
        toStage,
        movedBy: payload.userId,
      },
    });

    // Create activity record for the stage change
    await db.activity.create({
      data: {
        tenantId: payload.tenantId,
        type: 'DEAL_STAGE',
        title: `Deal moved from ${fromStage} to ${toStage}`,
        description: `"${deal.title}" moved from ${fromStage} to ${toStage}`,
        userId: payload.userId,
        dealId: id,
        metadata: {
          fromStage,
          toStage,
          stageHistoryId: stageHistory.id,
        },
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'deal.stage.move',
      targetType: 'Deal',
      targetId: id,
      metadata: { fromStage, toStage, dealTitle: deal.title },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({
        id: updatedDeal.id,
        title: updatedDeal.title,
        stage: updatedDeal.stage,
        fromStage,
        toStage,
        stageHistoryId: stageHistory.id,
      }, 'Deal stage updated successfully'),
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
