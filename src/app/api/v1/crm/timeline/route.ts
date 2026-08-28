import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
import { paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';

// ============================================
// HELPERS
// ============================================

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

const VALID_ENTITY_TYPES = ['LEAD', 'CONTACT', 'COMPANY', 'DEAL'] as const;

const entityTypeFieldMap: Record<string, string> = {
  LEAD: 'leadId',
  CONTACT: 'contactId',
  COMPANY: 'companyId',
  DEAL: 'dealId',
};

// ============================================
// GET /api/v1/crm/timeline — Combined entity timeline
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'activities.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      throw new ValidationError('entityType and entityId are required');
    }

    if (!VALID_ENTITY_TYPES.includes(entityType as typeof VALID_ENTITY_TYPES[number])) {
      throw new ValidationError(
        `entityType must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
      );
    }

    const entityField = entityTypeFieldMap[entityType];

    // Fetch activities and notes in parallel
    const [activities, notes] = await Promise.all([
      db.activity.findMany({
        where: {
          tenantId: payload.tenantId,
          [entityField]: entityId,
        },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          createdAt: true,
          metadata: true,
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.note.findMany({
        where: {
          tenantId: payload.tenantId,
          [entityField]: entityId,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Combine into unified timeline items
    const timeline = [
      ...activities.map((a) => ({
        id: a.id,
        type: 'ACTIVITY' as const,
        activityType: a.type,
        title: a.title,
        description: a.description,
        metadata: a.metadata,
        user: a.user,
        createdAt: a.createdAt,
      })),
      ...notes.map((n) => ({
        id: n.id,
        type: 'NOTE' as const,
        activityType: 'NOTE',
        title: 'Note',
        description: n.content,
        metadata: null,
        user: n.user,
        createdAt: n.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = timeline.length;
    const start = (page - 1) * limit;
    const paged = timeline.slice(start, start + limit);

    return NextResponse.json(paginated(paged, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
