import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'marketing.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;
    if (!UUID_RE.test(id)) throw new NotFoundError('Resource not found');

    const campaign = await db.campaign.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!campaign) throw new NotFoundError('Campaign not found');

    if (campaign.status !== 'SCHEDULED' && campaign.status !== 'PAUSED' && campaign.status !== 'DRAFT') {
      const { ValidationError } = await import('@/lib/errors');
      throw new ValidationError(`Cannot launch campaign in ${campaign.status} status`);
    }

    const updated = await db.campaign.update({
      where: { id },
      data: { status: 'RUNNING', startDate: campaign.startDate ?? new Date() },
    });

    await createAuditLog({
      actorId: payload.userId, tenantId: payload.tenantId,
      action: 'campaign.launch', targetType: 'Campaign', targetId: id,
      metadata: { name: campaign.name, previousStatus: campaign.status },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(updated, 'Campaign launched successfully'));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}
