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

const updateJournalEntrySchema = z.object({
  description: safeStringField(undefined, 2000).optional(),
  status: z.enum(['DRAFT', 'POSTED']).optional(),
  referenceType: safeStringField(undefined, 100).optional(),
  referenceId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'accounting.view', payload.tenantId, payload.isSuperAdmin);
    const { id } = await params; validateUuid(id);

    const entry = await db.journalEntry.findFirst({
      where: { id, tenantId: payload.tenantId },
      include: {
        lines: { include: { account: { select: { id: true, code: true, name: true } } } },
      },
    });
    if (!entry) throw new NotFoundError('Journal entry not found');
    return NextResponse.json(success(entry));
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
    await requirePermission(payload.roleCode ?? null, 'accounting.edit', payload.tenantId, payload.isSuperAdmin);
    const { id } = await params; validateUuid(id);

    const existing = await db.journalEntry.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!existing) throw new NotFoundError('Journal entry not found');

    const body = await request.json(); const data = validate(updateJournalEntrySchema, body);

    const updateData: Record<string, unknown> = {};
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.referenceType !== undefined) updateData.referenceType = data.referenceType ?? null;
    if (data.referenceId !== undefined) updateData.referenceId = data.referenceId;

    const entry = await db.journalEntry.update({ where: { id }, data: updateData, include: { lines: true } });
    await createAuditLog({
      actorId: payload.userId, tenantId: payload.tenantId,
      action: 'journalEntry.update', targetType: 'JournalEntry', targetId: id, metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(success(entry, 'Journal entry updated successfully'));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}
