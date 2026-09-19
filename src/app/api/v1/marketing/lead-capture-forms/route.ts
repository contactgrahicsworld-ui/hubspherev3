import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate, safeStringField } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const createFormSchema = z.object({
  name: safeStringField(1, 300),
  fields: z.array(z.record(z.string(), z.unknown())).min(1, 'At least one field is required'),
  settings: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'marketing.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const where = { tenantId: payload.tenantId };
    const [forms, total] = await Promise.all([
      db.leadCaptureForm.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      db.leadCaptureForm.count({ where }),
    ]);

    return NextResponse.json(paginated(forms, total, page, limit));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'marketing.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json(); const data = validate(createFormSchema, body);

    const form = await db.leadCaptureForm.create({
      data: {
        tenantId: payload.tenantId, name: data.name, fields: data.fields as any,
        settings: (data.settings as any) ?? undefined, isActive: data.isActive,
      },
    });

    await createAuditLog({
      actorId: payload.userId, tenantId: payload.tenantId,
      action: 'leadCaptureForm.create', targetType: 'LeadCaptureForm', targetId: form.id,
      metadata: { name: data.name },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(form, 'Form created successfully'), { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}
