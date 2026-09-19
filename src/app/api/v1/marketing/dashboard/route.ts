import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'marketing.view', payload.tenantId, payload.isSuperAdmin);

    const tenantId = payload.tenantId;

    const [
      totalCampaigns,
      activeCampaigns,
      totalForms,
      totalSubmissions,
      totalLists,
      recentCampaigns,
      recentSubmissions,
    ] = await Promise.all([
      db.campaign.count({ where: { tenantId } }),
      db.campaign.count({ where: { tenantId, status: 'RUNNING' } }),
      db.leadCaptureForm.count({ where: { tenantId, isActive: true } }),
      db.formSubmission.count({ where: { tenantId } }),
      db.marketingList.count({ where: { tenantId } }),
      db.campaign.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        // creator relation not in schema
      }),
      db.formSubmission.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        // form relation not in schema
      }),
    ]);

    // Campaign metrics aggregation
    const campaigns = await db.campaign.findMany({
      where: { tenantId, status: { in: ['RUNNING', 'COMPLETED'] } },
      select: { metrics: true },
    });

    const aggregateMetrics = {
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
    };

    for (const c of campaigns) {
      const m = c.metrics as Record<string, number> | null;
      if (m) {
        aggregateMetrics.totalSent += m.sent ?? 0;
        aggregateMetrics.totalDelivered += m.delivered ?? 0;
        aggregateMetrics.totalOpened += m.opened ?? 0;
        aggregateMetrics.totalClicked += m.clicked ?? 0;
      }
    }

    return NextResponse.json(success({
      totalCampaigns,
      activeCampaigns,
      totalForms,
      totalSubmissions,
      totalLists,
      aggregateMetrics,
      recentCampaigns,
      recentSubmissions,
    }));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}
