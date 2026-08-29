import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// POST /api/v1/automation/workflows/:id/activate
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
      include: {
        triggers: true,
        actions: true,
      },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    if (workflow.status === 'ARCHIVED') {
      throw new ValidationError('Cannot activate an archived workflow');
    }

    if (workflow.triggers.length === 0) {
      throw new ValidationError('Workflow must have at least one trigger to activate');
    }

    if (workflow.actions.length === 0) {
      throw new ValidationError('Workflow must have at least one action to activate');
    }

    const updated = await db.automationWorkflow.update({
      where: { id },
      data: { status: 'ACTIVE', updatedBy: payload.userId },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'automation.workflow.activate',
      targetType: 'AutomationWorkflow',
      targetId: id,
      metadata: { name: workflow.name, previousStatus: workflow.status },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(updated, 'Workflow activated successfully'));
  } catch (error) {
    if (error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
