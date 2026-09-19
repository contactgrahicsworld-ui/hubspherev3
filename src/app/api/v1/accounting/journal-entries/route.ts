import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate, safeStringField } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const createJournalEntrySchema = z.object({
  entryNumber: safeStringField(1, 100).optional(),
  date: z.string().datetime(),
  description: safeStringField(undefined, 2000).optional(),
  status: z.enum(['DRAFT', 'POSTED']).optional().default('DRAFT'),
  referenceType: safeStringField(undefined, 100).optional(),
  referenceId: z.string().uuid().optional(),
  lines: z.array(z.object({
    accountId: z.string().uuid(),
    debit: z.number().min(0).optional().default(0),
    credit: z.number().min(0).optional().default(0),
    description: safeStringField(undefined, 1000).optional(),
  })).min(2, 'At least 2 lines are required'),
});

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'accounting.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const status = searchParams.get('status');
    const where: Record<string, unknown> = { tenantId: payload.tenantId };
    if (status) where.status = status;

    const [entries, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          lines: { include: { account: { select: { id: true, code: true, name: true } } } },
        },
      }),
      db.journalEntry.count({ where }),
    ]);

    return NextResponse.json(paginated(entries, total, page, limit));
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
    await requirePermission(payload.roleCode ?? null, 'accounting.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createJournalEntrySchema, body);

    // Validate that debits equal credits
    const totalDebit = data.lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      const { ValidationError } = await import('@/lib/errors');
      throw new ValidationError('Debits must equal credits');
    }

    // Generate entry number if not provided
    const entryNumber = data.entryNumber ?? `JE-${Date.now()}`;

    const entry = await db.journalEntry.create({
      data: {
        tenantId: payload.tenantId,
        entryNumber,
        date: new Date(data.date),
        description: data.description ?? null,
        status: data.status,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
        createdBy: payload.userId,
        lines: {
          create: data.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            description: l.description ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    await createAuditLog({
      actorId: payload.userId, tenantId: payload.tenantId,
      action: 'journalEntry.create', targetType: 'JournalEntry', targetId: entry.id,
      metadata: { entryNumber, totalDebit, totalCredit },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(entry, 'Journal entry created successfully'), { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}
