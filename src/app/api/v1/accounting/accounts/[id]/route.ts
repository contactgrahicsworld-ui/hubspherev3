import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate, safeStringField } from '@/lib/validators';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateUuid(id: string): void { if (!UUID_RE.test(id)) throw new NotFoundError('Resource not found'); }

const updateAccountSchema = z.object({
  code: safeStringField(1, 50).optional(),
  name: safeStringField(1, 300).optional(),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
  category: safeStringField(undefined, 200).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  balance: z.number().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'accounting.view', payload.tenantId, payload.isSuperAdmin);
    const { id } = await params; validateUuid(id);
    const account = await db.account.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!account) throw new NotFoundError('Account not found');
    return NextResponse.json(success(account));
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
    const existing = await db.account.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!existing) throw new NotFoundError('Account not found');
    const body = await request.json(); const data = validate(updateAccountSchema, body);

    if (data.code && data.code !== existing.code) {
      const conflict = await db.account.findFirst({ where: { tenantId: payload.tenantId, code: data.code, id: { not: id } } });
      if (conflict) throw new ValidationError('An account with this code already exists');
    }

    const updateData: Record<string, unknown> = {};
    if (data.code !== undefined) updateData.code = data.code;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.category !== undefined) updateData.category = data.category ?? null;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.balance !== undefined) updateData.balance = data.balance;

    const account = await db.account.update({ where: { id }, data: updateData });
    await createAuditLog({
      actorId: payload.userId, tenantId: payload.tenantId,
      action: 'account.update', targetType: 'Account', targetId: id, metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(success(account, 'Account updated successfully'));
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
    await requirePermission(payload.roleCode ?? null, 'accounting.delete', payload.tenantId, payload.isSuperAdmin);
    const { id } = await params; validateUuid(id);
    const existing = await db.account.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!existing) throw new NotFoundError('Account not found');
    await db.account.delete({ where: { id } });
    await createAuditLog({
      actorId: payload.userId, tenantId: payload.tenantId,
      action: 'account.delete', targetType: 'Account', targetId: id,
      metadata: { code: existing.code, name: existing.name },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(success(null, 'Account deleted successfully'));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}
