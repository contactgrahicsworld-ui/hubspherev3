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

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional(),
  entityType: z.enum(['LEAD', 'CONTACT', 'COMPANY', 'DEAL']).optional(),
  entityId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  entityType: true,
  entityId: true,
  ownerId: true,
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
// GET /api/v1/crm/tasks — List tasks
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'tasks.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const ownerId = searchParams.get('ownerId');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const dueDateFrom = searchParams.get('dueDateFrom');
    const dueDateTo = searchParams.get('dueDateTo');

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (ownerId) where.ownerId = ownerId;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    if (dueDateFrom || dueDateTo) {
      where.dueDate = {} as Record<string, unknown>;
      if (dueDateFrom) (where.dueDate as Record<string, unknown>).gte = new Date(dueDateFrom);
      if (dueDateTo) (where.dueDate as Record<string, unknown>).lte = new Date(dueDateTo);
    }

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: taskSelect,
      }),
      db.task.count({ where }),
    ]);

    return NextResponse.json(paginated(tasks, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/crm/tasks — Create task
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'tasks.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createTaskSchema, body);

    if (data.entityId && !data.entityType) {
      throw new ValidationError('entityType is required when entityId is provided');
    }

    const task = await db.task.create({
      data: {
        tenantId: payload.tenantId,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? 'TODO',
        priority: data.priority ?? 'MEDIUM',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        entityType: data.entityType ?? null,
        entityId: data.entityId ?? null,
        ownerId: data.ownerId ?? payload.userId,
      },
      select: taskSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'task.create',
      targetType: 'Task',
      targetId: task.id,
      metadata: { title: data.title, status: data.status, priority: data.priority },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(task, 'Task created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
