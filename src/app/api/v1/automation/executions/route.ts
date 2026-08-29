import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { z } from 'zod';

// ============================================
// GET /api/v1/automation/executions — List all executions
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'automation.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const status = searchParams.get('status');
    const workflowId = searchParams.get('workflowId');
    const triggerEvent = searchParams.get('triggerEvent');

    const where: Record<string, unknown> = { tenantId: payload.tenantId };
    if (status) where.status = status;
    if (workflowId) where.workflowId = workflowId;
    if (triggerEvent) where.triggerEvent = triggerEvent;

    const [executions, total] = await Promise.all([
      db.automationExecution.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          workflowId: true,
          status: true,
          triggerEvent: true,
          entityType: true,
          entityId: true,
          error: true,
          startedAt: true,
          completedAt: true,
          triggeredBy: {
            select: { id: true, name: true, email: true },
          },
          workflow: {
            select: { id: true, name: true, triggerType: true },
          },
          _count: {
            select: { logs: true },
          },
        },
      }),
      db.automationExecution.count({ where }),
    ]);

    return NextResponse.json(paginated(executions, total, page, limit));
  } catch (error) {
    if (error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
