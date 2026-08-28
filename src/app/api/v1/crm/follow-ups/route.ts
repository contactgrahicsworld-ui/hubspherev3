import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createFollowUpSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  followUpAt: z.string().datetime('Invalid follow-up date format'),
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const followUpSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  followUpAt: true,
  completedAt: true,
  userId: true,
  leadId: true,
  contactId: true,
  dealId: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
} as const;

function isDbError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
  );
}

function dbUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
    { status: 503 },
  );
}

// ============================================
// GET /api/v1/crm/follow-ups — List follow-ups
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'followups.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const status = searchParams.get('status');
    const ownerId = searchParams.get('ownerId');
    const followUpFrom = searchParams.get('followUpFrom');
    const followUpTo = searchParams.get('followUpTo');

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (status) where.status = status;
    if (ownerId) where.userId = ownerId;

    if (followUpFrom || followUpTo) {
      where.followUpAt = {} as Record<string, unknown>;
      if (followUpFrom) (where.followUpAt as Record<string, unknown>).gte = new Date(followUpFrom);
      if (followUpTo) (where.followUpAt as Record<string, unknown>).lte = new Date(followUpTo);
    }

    const [followUps, total] = await Promise.all([
      db.followUp.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { followUpAt: 'asc' },
        select: followUpSelect,
      }),
      db.followUp.count({ where }),
    ]);

    return NextResponse.json(paginated(followUps, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/crm/follow-ups — Create follow-up
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'followups.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createFollowUpSchema, body);

    const entityCount = [data.leadId, data.contactId, data.dealId].filter(Boolean).length;
    if (entityCount === 0) {
      throw new ValidationError('At least one of leadId, contactId, or dealId is required');
    }

    const followUp = await db.followUp.create({
      data: {
        tenantId: payload.tenantId,
        title: data.title,
        description: data.description ?? null,
        followUpAt: new Date(data.followUpAt),
        userId: payload.userId,
        leadId: data.leadId ?? null,
        contactId: data.contactId ?? null,
        dealId: data.dealId ?? null,
      },
      select: followUpSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'followup.create',
      targetType: 'FollowUp',
      targetId: followUp.id,
      metadata: { title: data.title, followUpAt: data.followUpAt },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(followUp, 'Follow-up created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
