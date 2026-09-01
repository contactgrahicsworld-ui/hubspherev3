import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { z } from 'zod';

// ============================================
// GET /api/v1/automation/dashboard — Aggregated stats
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'automation.view', payload.tenantId, payload.isSuperAdmin);

    const tenantId = payload.tenantId;

    // Workflow counts by status
    const workflowStatusCounts = await db.automationWorkflow.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });

    const workflowCountsByStatus: Record<string, number> = {};
    for (const item of workflowStatusCounts) {
      workflowCountsByStatus[item.status] = item._count.id;
    }

    // Total workflows (non-archived)
    const totalWorkflows = await db.automationWorkflow.count({
      where: { tenantId, status: { not: 'ARCHIVED' } },
    });

    // Execution counts by status
    const executionStatusCounts = await db.automationExecution.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });

    const executionCountsByStatus: Record<string, number> = {};
    for (const item of executionStatusCounts) {
      executionCountsByStatus[item.status] = item._count.id;
    }

    const totalExecutions = await db.automationExecution.count({
      where: { tenantId },
    });

    const completedExecutions = executionCountsByStatus['COMPLETED'] ?? 0;
    const failedExecutions = executionCountsByStatus['FAILED'] ?? 0;
    const successRate = totalExecutions > 0
      ? Math.round((completedExecutions / totalExecutions) * 100)
      : 0;
    const failureRate = totalExecutions > 0
      ? Math.round((failedExecutions / totalExecutions) * 100)
      : 0;

    // Trigger distribution (event types)
    const triggerDistribution = await db.automationTrigger.groupBy({
      by: ['eventType'],
      where: { tenantId },
      _count: { id: true },
    });

    const triggerDistributionFormatted = triggerDistribution.map((item) => ({
      eventType: item.eventType,
      count: item._count.id,
    }));

    // Recent 24h execution count
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentExecutions = await db.automationExecution.count({
      where: {
        tenantId,
        startedAt: { gte: twentyFourHoursAgo },
      },
    });

    // Recent 24h failed execution count
    const recentFailedExecutions = await db.automationExecution.count({
      where: {
        tenantId,
        status: 'FAILED',
        startedAt: { gte: twentyFourHoursAgo },
      },
    });

    return NextResponse.json(
      success({
        workflows: {
          total: totalWorkflows,
          byStatus: workflowCountsByStatus,
        },
        executions: {
          total: totalExecutions,
          byStatus: executionCountsByStatus,
          successRate,
          failureRate,
          recent24h: recentExecutions,
          recent24hFailed: recentFailedExecutions,
        },
        triggers: {
          distribution: triggerDistributionFormatted,
        },
      }),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
