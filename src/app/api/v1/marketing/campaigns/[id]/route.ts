import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate, safeStringField } from '@/lib/validators';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateUuid(id: string): void { if (!UUID_RE.test(id)) throw new NotFoundError('Resource not found'); }

const updateCampaignSchema = z.object({
  name: safeStringField(1, 300).optional(),
  type: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'MULTI_CHANNEL']).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED']).optional(),
  audience: z.record(z.string(), z.unknown()).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  schedule: z.record(z.string(), z.unknown()).optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'marketing.view', payload.tenantId, payload.isSuperAdmin);
    const { id } = await params; validateUuid(id);

    const campaign = await db.campaign.findFirst({
      where: { id, tenantId: payload.tenantId },
      // creator relation not in schema
    });
    if (!campaign) throw new NotFoundError('Campaign not found');
    return NextResponse.json(success(campaign));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'marketing.edit', payload.tenantId, payload.isSuperAdmin);
    const { id } = await params; validateUuid(id);

    const existing = await db.campaign.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!existing) throw new NotFoundError('Campaign not found');

    const body = await request.json(); const data = validate(updateCampaignSchema, body);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.audience !== undefined) updateData.audience = data.audience as any;
    if (data.content !== undefined) updateData.content = data.content as any;
    if (data.schedule !== undefined) updateData.schedule = data.schedule as any;
    if (data.metrics !== undefined) updateData.metrics = data.metrics as any;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);

    const campaign = await db.campaign.update({ where: { id }, data: updateData });
    await createAuditLog({
      actorId: payload.userId, tenantId: payload.tenantId,
      action: 'campaign.update', targetType: 'Campaign', targetId: id, metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(success(campaign, 'Campaign updated successfully'));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'marketing.delete', payload.tenantId, payload.isSuperAdmin);
    const { id } = await params; validateUuid(id);

    const existing = await db.campaign.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!existing) throw new NotFoundError('Campaign not found');

    await db.campaign.delete({ where: { id } });
    await createAuditLog({
      actorId: payload.userId, tenantId: payload.tenantId,
      action: 'campaign.delete', targetType: 'Campaign', targetId: id,
      metadata: { name: existing.name },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(success(null, 'Campaign deleted successfully'));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}
