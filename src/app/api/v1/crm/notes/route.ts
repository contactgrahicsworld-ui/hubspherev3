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

const createNoteSchema = z.object({
  content: z.string().trim().min(1, 'Content is required').max(10000),
  entityType: z.enum(['LEAD', 'CONTACT', 'COMPANY', 'DEAL']),
  entityId: z.string().uuid(),
});

// ============================================
// SHARED HELPERS
// ============================================

const noteSelect = {
  id: true,
  content: true,
  userId: true,
  leadId: true,
  contactId: true,
  companyId: true,
  dealId: true,
  createdAt: true,
  updatedAt: true,
  user: {
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

const entityTypeToField: Record<string, string> = {
  LEAD: 'leadId',
  CONTACT: 'contactId',
  COMPANY: 'companyId',
  DEAL: 'dealId',
};

// ============================================
// GET /api/v1/crm/notes — List notes (filtered by entity)
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'notes.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (entityType && entityId) {
      const field = entityTypeToField[entityType];
      if (field) {
        where[field] = entityId;
      }
    }

    const [notes, total] = await Promise.all([
      db.note.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: noteSelect,
      }),
      db.note.count({ where }),
    ]);

    return NextResponse.json(paginated(notes, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/crm/notes — Create note
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'notes.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createNoteSchema, body);

    const entityField = entityTypeToField[data.entityType];
    if (!entityField) {
      throw new ValidationError('Invalid entity type');
    }

    const note = await db.note.create({
      data: {
        tenantId: payload.tenantId,
        content: data.content,
        userId: payload.userId,
        [entityField]: data.entityId,
      },
      select: noteSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'note.create',
      targetType: 'Note',
      targetId: note.id,
      metadata: { entityType: data.entityType, entityId: data.entityId },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(note, 'Note created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
