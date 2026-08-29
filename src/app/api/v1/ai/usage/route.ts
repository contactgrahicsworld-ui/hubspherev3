import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { requirePermission } from '@/lib/rbac';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ============================================
// GET /api/v1/ai/usage — AI usage stats
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'ai.view', payload.tenantId);

    const where: Prisma.AiUsageLogWhereInput = {
      tenantId: payload.tenantId,
    };

    // Aggregate overall stats
    const [totalCount, successCount, failedCount, byAgent, byModel, latencyStats] =
      await Promise.all([
        db.aiUsageLog.count({ where }),
        db.aiUsageLog.count({ where: { ...where, status: 'SUCCESS' } }),
        db.aiUsageLog.count({ where: { ...where, status: 'FAILED' } }),

        // Group by agent
        db.aiUsageLog.groupBy({
          by: ['agentName'],
          where,
          _count: { id: true },
          _sum: { inputTokens: true, outputTokens: true, durationMs: true },
          orderBy: { _count: { id: 'desc' } },
        }),

        // Group by model
        db.aiUsageLog.groupBy({
          by: ['model'],
          where,
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),

        // Latency stats (only for successful requests with durationMs)
        db.aiUsageLog.findMany({
          where: { ...where, status: 'SUCCESS', durationMs: { not: null } },
          select: { durationMs: true },
          orderBy: { durationMs: 'asc' },
        }),
      ]);

    // Calculate percentile latencies
    const durations = latencyStats
      .map((l) => l.durationMs)
      .filter((d): d is number => d !== null);

    function percentile(arr: number[], p: number): number | null {
      if (arr.length === 0) return null;
      if (arr.length === 1) return arr[0];
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.min(idx, arr.length - 1)];
    }

    const stats = {
      totalRequests: totalCount,
      successCount,
      failedCount,
      successRate: totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0.0',
      byAgent: byAgent.map((a) => ({
        agentName: a.agentName ?? 'UNKNOWN',
        count: a._count.id,
        totalInputTokens: a._sum.inputTokens ?? 0,
        totalOutputTokens: a._sum.outputTokens ?? 0,
        avgDurationMs: a._sum.durationMs && a._count.id > 0
          ? Math.round((a._sum.durationMs) / a._count.id)
          : null,
      })),
      byModel: byModel.map((m) => ({
        model: m.model ?? 'UNKNOWN',
        count: m._count.id,
      })),
      latency: {
        p50: percentile(durations, 50),
        p99: percentile(durations, 99),
        min: durations[0] ?? null,
        max: durations[durations.length - 1] ?? null,
        avg: durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null,
      },
    };

    return NextResponse.json(success(stats));
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
