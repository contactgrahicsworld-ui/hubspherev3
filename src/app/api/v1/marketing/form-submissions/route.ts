import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate, safeStringField } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const createSubmissionSchema = z.object({
  formId: z.string().uuid(),
  data: z.record(z.string(), z.unknown()),
  leadId: z.string().uuid().optional(),
  source: safeStringField(undefined, 200).optional(),
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

    const formId = searchParams.get('formId');
    const where: Record<string, unknown> = { tenantId: payload.tenantId };
    if (formId) where.formId = formId;

    const [submissions, total] = await Promise.all([
      db.formSubmission.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        // form relation not in schema
      }),
      db.formSubmission.count({ where }),
    ]);

    return NextResponse.json(paginated(submissions, total, page, limit));
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

    const body = await request.json(); const data = validate(createSubmissionSchema, body);

    const submission = await db.formSubmission.create({
      data: {
        tenantId: payload.tenantId, formId: data.formId,
        data: data.data as any, leadId: data.leadId ?? null, source: data.source ?? null,
      },
    });

    // Increment form submission count
    await db.leadCaptureForm.update({
      where: { id: data.formId },
      data: { submissionCount: { increment: 1 } },
    });

    await createAuditLog({
      actorId: payload.userId, tenantId: payload.tenantId,
      action: 'formSubmission.create', targetType: 'FormSubmission', targetId: submission.id,
      metadata: { formId: data.formId, source: data.source },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(submission, 'Submission recorded successfully'), { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}
