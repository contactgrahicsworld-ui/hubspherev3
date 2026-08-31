import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { validate } from '@/lib/validators';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// ============================================
// SCHEMAS
// ============================================

const eventSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  entityId: z.string().optional(),
  entityType: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional().default({}),
});

const MAX_ACTIONS_PER_EXECUTION = 10;

// ============================================
// CONDITION EVALUATOR (SAFE — no eval, no Function constructor)
// ============================================

function evaluateCondition(
  field: string,
  operator: string,
  value: string | null | undefined,
  entityData: Record<string, any>
): boolean {
  const fieldValue = field.split('.').reduce((obj, key) => obj?.[key], entityData as any);
  switch (operator) {
    case 'equals':
      return String(fieldValue) === String(value);
    case 'not_equals':
      return String(fieldValue) !== String(value);
    case 'contains':
      return String(fieldValue ?? '').includes(String(value ?? ''));
    case 'not_contains':
      return !String(fieldValue ?? '').includes(String(value ?? ''));
    case 'greater_than':
      return Number(fieldValue) > Number(value);
    case 'less_than':
      return Number(fieldValue) < Number(value);
    case 'empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    default:
      return true;
  }
}

function evaluateAllConditions(
  conditions: Array<{ field: string; operator: string; value: string | null; logic: string; sortOrder: number }>,
  entityData: Record<string, any>
): boolean {
  if (conditions.length === 0) return true;

  const sorted = [...conditions].sort((a, b) => a.sortOrder - b.sortOrder);

  // Group conditions by logic type (AND groups separated by OR)
  const andGroups: Array<Array<{ field: string; operator: string; value: string | null }>> = [];
  let currentAndGroup: Array<{ field: string; operator: string; value: string | null }> = [];

  for (const cond of sorted) {
    currentAndGroup.push({ field: cond.field, operator: cond.operator, value: cond.value });
    if (cond.logic === 'OR') {
      andGroups.push(currentAndGroup);
      currentAndGroup = [];
    }
  }
  if (currentAndGroup.length > 0) {
    andGroups.push(currentAndGroup);
  }

  // If there are multiple AND groups, any one being true is sufficient (OR between groups)
  if (andGroups.length > 1) {
    return andGroups.some((group) =>
      group.every((cond) =>
        evaluateCondition(cond.field, cond.operator, cond.value, entityData)
      )
    );
  }

  // Single AND group — all must pass
  return andGroups[0].every((cond) =>
    evaluateCondition(cond.field, cond.operator, cond.value, entityData)
  );
}

// ============================================
// ACTION EXECUTOR (logs only, never actually sends/calls)
// ============================================

type ActionLog = {
  actionId: string | null;
  level: string;
  message: string;
  data: Record<string, any>;
  durationMs: number;
};

async function executeAction(
  action: { id: string; type: string; config: any; delayMs: number },
  tenantId: string,
  entityData: Record<string, any>,
  triggerEvent: string,
): Promise<ActionLog> {
  const startTime = Date.now();
  const actionConfig = action.config as Record<string, any> ?? {};

  // Handle delay (simulate — we don't actually sleep in a sync context)
  if (action.delayMs > 0) {
    // Log the delay but don't actually block
  }

  // Check if this is an AI action
  if (action.type === 'ai_action' || action.type.startsWith('ai_')) {
    // Check if AI provider is configured (platform-level config)
    const aiProviderConfig = await db.providerConfig.findFirst({
      where: { category: 'AIProvider', enabled: true, configured: true },
    });

    if (!aiProviderConfig) {
      return {
        actionId: action.id,
        level: 'WARN',
        message: 'AI_PROVIDER_NOT_CONFIGURED',
        data: { actionType: action.type, config: actionConfig },
        durationMs: Date.now() - startTime,
      };
    }

    return {
      actionId: action.id,
      level: 'INFO',
      message: `Would execute AI action: ${action.type}`,
      data: { actionType: action.type, config: actionConfig },
      durationMs: Date.now() - startTime,
    };
  }

  // Check if this is a messaging action
  const messagingActionTypes = ['send_whatsapp', 'send_email', 'send_sms'];
  if (messagingActionTypes.includes(action.type)) {
    const channelMap: Record<string, string> = {
      send_whatsapp: 'WHATSAPP',
      send_email: 'EMAIL',
      send_sms: 'SMS',
    };
    const channel = channelMap[action.type];

    if (channel) {
      const providerConfig = await db.communicationProviderConfig.findFirst({
        where: { tenantId, channel, isEnabled: true },
      });

      if (!providerConfig) {
        return {
          actionId: action.id,
          level: 'WARN',
          message: 'PROVIDER_NOT_CONFIGURED',
          data: { actionType: action.type, channel, config: actionConfig },
          durationMs: Date.now() - startTime,
        };
      }
    }

    return {
      actionId: action.id,
      level: 'INFO',
      message: `Would send ${action.type.replace('send_', '')}: to ${actionConfig.to ?? actionConfig.recipient ?? 'unknown'}`,
      data: { actionType: action.type, channel, config: actionConfig },
      durationMs: Date.now() - startTime,
    };
  }

  // Generic action — just log what WOULD be done
  return {
    actionId: action.id,
    level: 'INFO',
    message: `Would execute action: ${action.type}`,
    data: { actionType: action.type, config: actionConfig, delayMs: action.delayMs },
    durationMs: Date.now() - startTime,
  };
}

// ============================================
// POST /api/v1/automation/events — Event ingest
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'automation.execute', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const { eventType, entityId, entityType, data } = validate(eventSchema, body);

    const entityData = (data as Record<string, any>) ?? {};

    // Find all ACTIVE workflows whose triggers match this event type
    const workflows = await db.automationWorkflow.findMany({
      where: {
        tenantId: payload.tenantId,
        status: 'ACTIVE',
        triggers: {
          some: { eventType },
        },
      },
      include: {
        triggers: true,
        conditions: { orderBy: { sortOrder: 'asc' } },
        actions: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (workflows.length === 0) {
      return NextResponse.json(success({ processed: 0, message: 'No matching workflows' }));
    }

    const results: Array<{ workflowId: string; workflowName: string; executionId: string; status: string }> = [];

    for (const workflow of workflows) {
      // Verify the trigger matches (double check)
      const triggerMatches = workflow.triggers.some((t) => t.eventType === eventType);
      if (!triggerMatches) continue;

      // Evaluate conditions
      const conditionsPass = evaluateAllConditions(
        workflow.conditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value,
          logic: c.logic,
          sortOrder: c.sortOrder,
        })),
        entityData,
      );

      if (!conditionsPass) {
        results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          executionId: '',
          status: 'SKIPPED_CONDITIONS',
        });
        continue;
      }

      // Enforce loop prevention
      const actionsToExecute = workflow.actions.slice(0, MAX_ACTIONS_PER_EXECUTION);

      const idempotencyKey = randomUUID();

      // Create execution
      const execution = await db.automationExecution.create({
        data: {
          tenantId: payload.tenantId,
          workflowId: workflow.id,
          triggerEvent: eventType,
          status: 'RUNNING',
          triggerData: body,
          entityId: entityId ?? null,
          entityType: entityType ?? null,
          triggeredById: payload.userId,
          idempotencyKey,
        },
      });

      // Execute actions and log results
      const logsToCreate: Array<{
        tenantId: string;
        executionId: string;
        actionId: string | null;
        level: string;
        message: string;
        data: any;
        durationMs: number;
      }> = [];

      let executionFailed = false;
      let executionError: string | null = null;

      for (const action of actionsToExecute) {
        try {
          const actionLog = await executeAction(action, payload.tenantId, entityData, eventType);

          logsToCreate.push({
            tenantId: payload.tenantId,
            executionId: execution.id,
            actionId: actionLog.actionId,
            level: actionLog.level,
            message: actionLog.message,
            data: actionLog.data,
            durationMs: actionLog.durationMs,
          });

          if (actionLog.level === 'ERROR') {
            executionFailed = true;
            executionError = actionLog.message;
            break;
          }
        } catch (actionError) {
          logsToCreate.push({
            tenantId: payload.tenantId,
            executionId: execution.id,
            actionId: action.id,
            level: 'ERROR',
            message: actionError instanceof Error ? actionError.message : 'Action execution failed',
            data: { actionType: action.type },
            durationMs: 0,
          });
          executionFailed = true;
          executionError = actionError instanceof Error ? actionError.message : 'Action execution failed';
          break;
        }
      }

      if (workflow.actions.length > MAX_ACTIONS_PER_EXECUTION) {
        logsToCreate.push({
          tenantId: payload.tenantId,
          executionId: execution.id,
          actionId: null,
          level: 'WARN',
          message: `Loop prevention: exceeded maximum of ${MAX_ACTIONS_PER_EXECUTION} actions`,
          data: { totalActions: workflow.actions.length, executed: MAX_ACTIONS_PER_EXECUTION },
          durationMs: 0,
        });
      }

      // Create execution logs
      if (logsToCreate.length > 0) {
        await db.automationExecutionLog.createMany({ data: logsToCreate });
      }

      // Update execution status
      const finalStatus = executionFailed ? 'FAILED' : 'COMPLETED';
      await db.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: finalStatus,
          error: executionError,
          completedAt: new Date(),
        },
      });

      // Update workflow stats
      await db.automationWorkflow.update({
        where: { id: workflow.id },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date(),
        },
      });

      results.push({
        workflowId: workflow.id,
        workflowName: workflow.name,
        executionId: execution.id,
        status: finalStatus,
      });
    }

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'automation.event.trigger',
      targetType: 'AutomationEvent',
      metadata: { eventType, entityId, entityType, workflowsTriggered: results.length },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success({ processed: results.length, results }));
  } catch (error) {
    if (error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
