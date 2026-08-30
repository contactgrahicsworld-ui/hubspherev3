import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { z } from 'zod';

// ============================================
// GET /api/v1/automation/executions/:id — Get execution with logs
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'automation.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const execution = await db.automationExecution.findFirst({
      where: { id, tenantId: payload.tenantId },
      include: {
        workflow: {
          select: { id: true, name: true, triggerType: true },
        },
        triggeredBy: {
          select: { id: true, name: true, email: true },
        },
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!execution) {
      throw new NotFoundError('Execution not found');
    }

    return NextResponse.json(success(execution));
  } catch (error) {
    if (error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
