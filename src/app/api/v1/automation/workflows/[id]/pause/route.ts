import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// POST /api/v1/automation/workflows/:id/pause
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'automation.edit', payload.tenantId);

    const { id } = await params;

    const workflow = await db.automationWorkflow.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    if (workflow.status === 'ARCHIVED') {
      throw new ValidationError('Cannot pause an archived workflow');
    }

    if (workflow.status !== 'ACTIVE') {
      throw new ValidationError('Only active workflows can be paused');
    }

    const updated = await db.automationWorkflow.update({
      where: { id },
      data: { status: 'PAUSED', updatedBy: payload.userId },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'automation.workflow.pause',
      targetType: 'AutomationWorkflow',
      targetId: id,
      metadata: { name: workflow.name, previousStatus: workflow.status },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(updated, 'Workflow paused successfully'));
  } catch (error) {
    if (error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
