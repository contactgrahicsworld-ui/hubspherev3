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

const workflowListSchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  triggerType: z.string().optional(),
  search: z.string().optional(),
});

const triggerSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  config: z.record(z.string(), z.unknown()).optional().default({}),
});

const conditionSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'empty', 'not_empty']),
  value: z.string().nullable().optional(),
  logic: z.enum(['AND', 'OR']).optional().default('AND'),
  sortOrder: z.number().int().min(0).optional().default(0),
});

const actionSchema = z.object({
  type: z.string().min(1, 'Action type is required'),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  sortOrder: z.number().int().min(0).optional().default(0),
  delayMs: z.number().int().min(0).optional().default(0),
});

const createWorkflowSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED']).optional().default('DRAFT'),
  triggerType: z.string().min(1, 'Trigger type is required').max(200),
  triggers: z.array(triggerSchema).min(1, 'At least one trigger is required'),
  conditions: z.array(conditionSchema).optional().default([]),
  actions: z.array(actionSchema).min(1, 'At least one action is required'),
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

const workflowListSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  triggerType: true,
  executionCount: true,
  lastExecutedAt: true,
  createdAt: true,
  updatedAt: true,
  creator: {
    select: { id: true, name: true, email: true },
  },
  _count: {
    select: {
      triggers: true,
      conditions: true,
      actions: true,
      executions: true,
    },
  },
} as const;

// ============================================
// GET /api/v1/automation/workflows — List workflows
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'automation.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit, status, triggerType, search } = validate(workflowListSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
      status: searchParams.get('status') ?? undefined,
      triggerType: searchParams.get('triggerType') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    });

    const where: Record<string, unknown> = { tenantId: payload.tenantId };

    if (status) where.status = status;
    if (triggerType) where.triggerType = triggerType;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [workflows, total] = await Promise.all([
      db.automationWorkflow.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: workflowListSelect,
      }),
      db.automationWorkflow.count({ where }),
    ]);

    return NextResponse.json(paginated(workflows, total, page, limit));
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
// POST /api/v1/automation/workflows — Create workflow
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'automation.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createWorkflowSchema, body);

    if (data.actions.length > 10) {
      throw new ValidationError('A workflow cannot have more than 10 actions');
    }

    const workflow = await db.$transaction(async (tx) => {
      const wf = await tx.automationWorkflow.create({
        data: {
          tenantId: payload.tenantId!,
          name: data.name,
          description: data.description ?? null,
          status: data.status,
          triggerType: data.triggerType,
          createdBy: payload.userId,
        },
        include: {
          triggers: true,
          conditions: true,
          actions: true,
        },
      });

      await tx.automationTrigger.createMany({
        data: data.triggers.map((t) => ({
          tenantId: payload.tenantId!,
          workflowId: wf.id,
          eventType: t.eventType,
          config: (t.config ?? {}) as any,
        })),
      });

      if (data.conditions && data.conditions.length > 0) {
        await tx.automationCondition.createMany({
          data: data.conditions.map((c) => ({
            tenantId: payload.tenantId!,
            workflowId: wf.id,
            field: c.field,
            operator: c.operator,
            value: c.value ?? null,
            logic: c.logic,
            sortOrder: c.sortOrder,
          })),
        });
      }

      await tx.automationAction.createMany({
        data: data.actions.map((a) => ({
          tenantId: payload.tenantId!,
          workflowId: wf.id,
          type: a.type,
          config: (a.config ?? {}) as any,
          sortOrder: a.sortOrder,
          delayMs: a.delayMs,
        })),
      });

      return tx.automationWorkflow.findUnique({
        where: { id: wf.id },
        include: {
          triggers: true,
          conditions: { orderBy: { sortOrder: 'asc' } },
          actions: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'automation.workflow.create',
      targetType: 'AutomationWorkflow',
      targetId: workflow!.id,
      metadata: { name: data.name, status: data.status, triggerType: data.triggerType },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(workflow, 'Workflow created successfully'), { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
