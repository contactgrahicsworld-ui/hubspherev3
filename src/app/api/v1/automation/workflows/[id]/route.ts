import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { validate } from '@/lib/validators';

// ============================================
// SCHEMAS
// ============================================

const updateWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  triggerType: z.string().min(1).max(200).optional(),
  triggers: z.array(
    z.object({
      eventType: z.string().min(1),
      config: z.record(z.string(), z.unknown()).optional().default({}),
    })
  ).optional(),
  conditions: z.array(
    z.object({
      field: z.string().min(1),
      operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'empty', 'not_empty']),
      value: z.string().nullable().optional(),
      logic: z.enum(['AND', 'OR']).optional().default('AND'),
      sortOrder: z.number().int().min(0).optional().default(0),
    })
  ).optional(),
  actions: z.array(
    z.object({
      type: z.string().min(1),
      config: z.record(z.string(), z.unknown()).optional().default({}),
      sortOrder: z.number().int().min(0).optional().default(0),
      delayMs: z.number().int().min(0).optional().default(0),
    })
  ).optional(),
});

// ============================================
// HELPERS
// ============================================

function isDbError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
  );
}

const workflowFullInclude = {
  triggers: true,
  conditions: { orderBy: { sortOrder: 'asc' } },
  actions: { orderBy: { sortOrder: 'asc' } },
  executions: {
    take: 10,
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      status: true,
      triggerEvent: true,
      startedAt: true,
      completedAt: true,
    },
  },
  creator: {
    select: { id: true, name: true, email: true },
  },
  updater: {
    select: { id: true, name: true, email: true },
  },
} as const;

// ============================================
// GET /api/v1/automation/workflows/:id — Get workflow
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'automation.view', payload.tenantId);

    const { id } = await params;

    const workflow = await db.automationWorkflow.findFirst({
      where: { id, tenantId: payload.tenantId, status: { not: 'ARCHIVED' } },
      include: workflowFullInclude,
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    return NextResponse.json(success(workflow));
  } catch (error) {
    if (isDbError(error)) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PATCH /api/v1/automation/workflows/:id — Update workflow
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'automation.edit', payload.tenantId);

    const { id } = await params;
    const body = await request.json();
    const data = validate(updateWorkflowSchema, body);

    const existing = await db.automationWorkflow.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Workflow not found');
    }

    if (existing.status === 'ARCHIVED') {
      throw new ValidationError('Cannot update an archived workflow');
    }

    if (data.actions && data.actions.length > 10) {
      throw new ValidationError('A workflow cannot have more than 10 actions');
    }

    const workflow = await db.$transaction(async (tx) => {
      // Update workflow fields
      await tx.automationWorkflow.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.triggerType && { triggerType: data.triggerType }),
          updatedBy: payload.userId,
        },
      });

      // Replace triggers if provided
      if (data.triggers) {
        await tx.automationTrigger.deleteMany({ where: { workflowId: id } });
        if (data.triggers.length > 0) {
          await tx.automationTrigger.createMany({
            data: data.triggers.map((t) => ({
              tenantId: payload.tenantId!,
              workflowId: id,
              eventType: t.eventType,
              config: (t.config ?? {}) as any,
            })),
          });
        }
      }

      // Replace conditions if provided
      if (data.conditions) {
        await tx.automationCondition.deleteMany({ where: { workflowId: id } });
        if (data.conditions.length > 0) {
          await tx.automationCondition.createMany({
            data: data.conditions.map((c) => ({
              tenantId: payload.tenantId!,
              workflowId: id,
              field: c.field,
              operator: c.operator,
              value: c.value ?? null,
              logic: c.logic,
              sortOrder: c.sortOrder,
            })),
          });
        }
      }

      // Replace actions if provided
      if (data.actions) {
        await tx.automationAction.deleteMany({ where: { workflowId: id } });
        if (data.actions.length > 0) {
          await tx.automationAction.createMany({
            data: data.actions.map((a) => ({
              tenantId: payload.tenantId!,
              workflowId: id,
              type: a.type,
              config: (a.config ?? {}) as any,
              sortOrder: a.sortOrder,
              delayMs: a.delayMs,
            })),
          });
        }
      }

      return tx.automationWorkflow.findUnique({
        where: { id },
        include: workflowFullInclude,
      });
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'automation.workflow.update',
      targetType: 'AutomationWorkflow',
      targetId: id,
      metadata: {
        name: data.name,
        triggerType: data.triggerType,
        triggersCount: data.triggers?.length,
        conditionsCount: data.conditions?.length,
        actionsCount: data.actions?.length,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(workflow, 'Workflow updated successfully'));
  } catch (error) {
    if (error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/automation/workflows/:id — Archive workflow
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'automation.delete', payload.tenantId);

    const { id } = await params;

    const existing = await db.automationWorkflow.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Workflow not found');
    }

    if (existing.status === 'ARCHIVED') {
      throw new ValidationError('Workflow is already archived');
    }

    await db.automationWorkflow.update({
      where: { id },
      data: { status: 'ARCHIVED', updatedBy: payload.userId },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'automation.workflow.archive',
      targetType: 'AutomationWorkflow',
      targetId: id,
      metadata: { name: existing.name, previousStatus: existing.status },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Workflow archived successfully'));
  } catch (error) {
    if (error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
