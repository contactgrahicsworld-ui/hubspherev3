import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new NotFoundError('Resource not found');
  }
}

// ============================================
// SCHEMAS
// ============================================

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  entityType: z.enum(['LEAD', 'CONTACT', 'COMPANY', 'DEAL']).nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
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
// GET /api/v1/crm/tasks/:id
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'tasks.view', payload.tenantId);

    const { id } = await params;
    validateUuid(id);

    const task = await db.task.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: taskSelect,
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    return NextResponse.json(success(task));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PUT /api/v1/crm/tasks/:id
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'tasks.edit', payload.tenantId);

    const { id } = await params;
    validateUuid(id);

    const existing = await db.task.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Task not found');
    }

    const body = await request.json();
    const data = validate(updateTaskSchema, body);

    // Validate owner belongs to the same tenant if provided
    if (data.ownerId) {
      const ownerExists = await db.membership.findFirst({
        where: { userId: data.ownerId, tenantId: payload.tenantId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!ownerExists) {
        throw new ValidationError('Owner not found');
      }
    }

    // Validate entity belongs to the same tenant if provided
    const effectiveEntityType = data.entityType !== undefined ? data.entityType : existing.entityType;
    const effectiveEntityId = data.entityId !== undefined ? data.entityId : existing.entityId;
    if (effectiveEntityId && effectiveEntityType) {
      const entityModel: Record<string, { findFirst: (args: any) => any }> = {
        LEAD: db.lead as any,
        CONTACT: db.contact as any,
        COMPANY: db.company as any,
        DEAL: db.deal as any,
      };
      const model = entityModel[effectiveEntityType];
      if (model) {
        const entityExists = await model.findFirst({
          where: { id: effectiveEntityId, tenantId: payload.tenantId },
          select: { id: true },
        });
        if (!entityExists) {
          throw new ValidationError(`${effectiveEntityType} not found`);
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.entityType !== undefined) updateData.entityType = data.entityType;
    if (data.entityId !== undefined) updateData.entityId = data.entityId;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;

    const task = await db.task.update({
      where: { id },
      data: updateData,
      select: taskSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'task.update',
      targetType: 'Task',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(task, 'Task updated successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/crm/tasks/:id — Soft delete (archive)
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'tasks.delete', payload.tenantId);

    const { id } = await params;
    validateUuid(id);

    const existing = await db.task.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing || existing.status === 'CANCELLED') {
      throw new NotFoundError('Task not found');
    }

    // Tasks use status CANCELLED as soft delete
    await db.task.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'task.archive',
      targetType: 'Task',
      targetId: id,
      metadata: { title: existing.title },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Task archived successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
