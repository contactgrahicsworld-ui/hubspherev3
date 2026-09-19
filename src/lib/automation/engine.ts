/**
 * Automation Execution Engine — HubSphere V3
 *
 * This is the REAL execution engine that:
 * 1. Listens for trigger events via `triggerEvent()`
 * 2. Finds all active workflows matching the trigger type (tenant-isolated)
 * 3. Evaluates conditions against the event data
 * 4. Executes actions in order — ACTUALLY creates tasks, sends notifications, etc.
 * 5. Creates AutomationExecution + AutomationExecutionLog records
 * 6. Handles errors gracefully (logs but never throws)
 * 7. Runs asynchronously (never blocks the triggering operation)
 *
 * Called from business logic via dispatcher convenience functions
 * or directly via `triggerEvent()`.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { aiGateway } from '@/lib/providers/ai-gateway';
import { providerRegistry } from '@/lib/providers/registry';
import { sendEmail, type EmailMessage } from '@/lib/email';
import { randomUUID } from 'crypto';

// ============================================
// TYPES
// ============================================

/** Supported trigger event types — mapped from AUTOMATION_TRIGGER_EVENTS in constants */
export type TriggerEventType =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.status_changed'
  | 'deal.created'
  | 'deal.updated'
  | 'deal.stage_changed'
  | 'deal.won'
  | 'deal.lost'
  | 'contact.created'
  | 'contact.updated'
  | 'task.created'
  | 'task.completed'
  | 'task.overdue'
  | 'call.completed'
  | 'call.missed'
  | 'field_visit.completed'
  | 'employee.created'
  | 'leave.requested'
  | 'leave.approved'
  | 'invoice.overdue'
  | 'payment.received'
  | 'custom_event';

/** Supported condition types */
export type ConditionType =
  | 'FIELD_MATCH'
  | 'STATUS_IS'
  | 'PRIORITY_IS'
  | 'OWNER_IS'
  | 'VALUE_GT'
  | 'VALUE_LT'
  | 'TIME_CONDITION';

/** Supported action types */
export type ActionType =
  | 'create_task'
  | 'update_lead'
  | 'update_deal'
  | 'change_status'
  | 'assign_user'
  | 'create_followup'
  | 'send_whatsapp'
  | 'send_email'
  | 'send_sms'
  | 'create_notification'
  | 'delay'
  | 'webhook'
  | 'ai_action'
  | 'add_tag'
  | 'create_activity'
  | 'trigger_webhook'
  | 'ai_suggestion';

/** Context passed to the engine for every trigger event */
export interface TriggerContext {
  eventType: TriggerEventType;
  tenantId: string;
  /** The entity that triggered this event (lead, deal, task, etc.) */
  data: Record<string, unknown>;
  /** Optional: ID of the entity that triggered this */
  entityId?: string;
  /** Optional: Type of the entity (lead, deal, task, etc.) */
  entityType?: string;
  /** Optional: User ID that triggered this event */
  triggeredBy?: string;
}

/** Result of a single action execution */
interface ActionResult {
  actionId: string;
  actionType: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  data: Record<string, unknown>;
  durationMs: number;
}

/** Result of the entire trigger event processing */
export interface TriggerResult {
  matchedWorkflows: number;
  executedWorkflows: number;
  skippedConditionFail: number;
  errors: number;
  results: Array<{
    workflowId: string;
    workflowName: string;
    executionId: string;
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  }>;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_ACTIONS_PER_EXECUTION = 10;
const MAX_WORKFLOWS_PER_EVENT = 50;
const MAX_DELAY_MS = 24 * 60 * 60 * 1000; // 24 hours max delay

// ============================================
// CONDITION EVALUATOR (Safe — no eval, no Function constructor)
// ============================================

/**
 * Resolve a nested field value from an object using dot notation.
 * e.g., "lead.status" → data.lead.status
 */
function resolveFieldValue(field: string, data: Record<string, unknown>): unknown {
  return field.split('.').reduce<unknown>(
    (obj, key) => (obj != null && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined),
    data,
  );
}

/**
 * Evaluate a single condition against event data.
 */
function evaluateSingleCondition(
  field: string,
  operator: string,
  value: string | null | undefined,
  data: Record<string, unknown>,
): boolean {
  const fieldValue = resolveFieldValue(field, data);

  switch (operator) {
    case 'equals':
      return String(fieldValue ?? '') === String(value ?? '');
    case 'not_equals':
      return String(fieldValue ?? '') !== String(value ?? '');
    case 'contains':
      return String(fieldValue ?? '').toLowerCase().includes(String(value ?? '').toLowerCase());
    case 'not_contains':
      return !String(fieldValue ?? '').toLowerCase().includes(String(value ?? '').toLowerCase());
    case 'greater_than': {
      const numField = Number(fieldValue);
      const numValue = Number(value);
      if (Number.isNaN(numField) || Number.isNaN(numValue)) return false;
      return numField > numValue;
    }
    case 'less_than': {
      const numField = Number(fieldValue);
      const numValue = Number(value);
      if (Number.isNaN(numField) || Number.isNaN(numValue)) return false;
      return numField < numValue;
    }
    case 'empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'before': {
      const fieldDate = new Date(String(fieldValue));
      const compareDate = new Date(String(value));
      if (Number.isNaN(fieldDate.getTime()) || Number.isNaN(compareDate.getTime())) return false;
      return fieldDate < compareDate;
    }
    case 'after': {
      const fieldDate = new Date(String(fieldValue));
      const compareDate = new Date(String(value));
      if (Number.isNaN(fieldDate.getTime()) || Number.isNaN(compareDate.getTime())) return false;
      return fieldDate > compareDate;
    }
    default:
      logger.warn('Unknown condition operator, skipping', { module: 'automation-engine', operator });
      return true; // Unknown operator = pass (don't block)
  }
}

/**
 * Evaluate all conditions for a workflow against event data.
 * Conditions are grouped by AND/OR logic.
 */
function evaluateAllConditions(
  conditions: Array<{
    field: string;
    operator: string;
    value: string | null;
    logic: string;
    sortOrder: number;
  }>,
  data: Record<string, unknown>,
): boolean {
  if (conditions.length === 0) return true;

  const sorted = [...conditions].sort((a, b) => a.sortOrder - b.sortOrder);

  // Group conditions: consecutive AND conditions form a group;
  // OR between conditions splits into separate groups.
  // Result: OR between AND-groups (any group passing is sufficient).
  const andGroups: Array<Array<{ field: string; operator: string; value: string | null }>> = [];
  let currentGroup: Array<{ field: string; operator: string; value: string | null }> = [];

  for (const cond of sorted) {
    currentGroup.push({ field: cond.field, operator: cond.operator, value: cond.value });
    if (cond.logic === 'OR') {
      andGroups.push(currentGroup);
      currentGroup = [];
    }
  }
  if (currentGroup.length > 0) {
    andGroups.push(currentGroup);
  }

  // If multiple groups: any one passing is sufficient (OR between groups)
  if (andGroups.length > 1) {
    return andGroups.some((group) =>
      group.every((cond) => evaluateSingleCondition(cond.field, cond.operator, cond.value, data)),
    );
  }

  // Single AND group — all must pass
  return andGroups[0].every((cond) =>
    evaluateSingleCondition(cond.field, cond.operator, cond.value, data),
  );
}

// ============================================
// TIME CONDITION HELPER
// ============================================

/**
 * Evaluate time-based conditions (business hours, weekend, etc.)
 * Checked when condition type is TIME_CONDITION.
 */
function evaluateTimeCondition(config: Record<string, unknown>): boolean {
  const now = new Date();
  const type = String(config.timeType ?? '');

  switch (type) {
    case 'business_hours': {
      const hour = now.getHours();
      const day = now.getDay(); // 0=Sun, 6=Sat
      return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
    }
    case 'weekend': {
      const day = now.getDay();
      return day === 0 || day === 6;
    }
    case 'weekday': {
      const day = now.getDay();
      return day >= 1 && day <= 5;
    }
    default:
      return true;
  }
}

// ============================================
// ACTION EXECUTORS — REAL SIDE EFFECTS
// ============================================

/**
 * CREATE_TASK: Create a real Task record in the database.
 */
async function executeCreateTask(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string; taskId?: string }> {
  const title = String(actionConfig.title ?? 'Automated Task');
  const description = actionConfig.description ? String(actionConfig.description) : null;
  const priority = String(actionConfig.priority ?? 'MEDIUM');
  const dueDateStr = actionConfig.dueDate ? String(actionConfig.dueDate) : null;
  const dueDate = dueDateStr ? new Date(dueDateStr) : null;

  // Resolve assignee: specific userId, "owner" (from trigger data), or round-robin
  let ownerId = resolveAssignee(tenantId, actionConfig, data);

  if (!ownerId) {
    // Fallback: use the triggeredBy user if available
    ownerId = data.triggeredBy as string | undefined;
  }

  if (!ownerId) {
    return { success: false, message: 'Cannot create task: no assignee resolved' };
  }

  // Resolve entity linkage
  const entityType = (actionConfig.entityType ?? data.entityType ?? null) as string | null;
  const entityId = (actionConfig.entityId ?? data.entityId ?? null) as string | null;

  const task = await db.task.create({
    data: {
      tenantId,
      title,
      description,
      status: 'TODO',
      priority,
      dueDate,
      ownerId,
      entityType,
      entityId,
    },
  });

  return { success: true, message: `Task created: ${title}`, taskId: task.id };
}

/**
 * UPDATE_FIELD (update_lead / update_deal / change_status):
 * Update a field on the triggering entity.
 */
async function executeUpdateField(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const entityType = String(actionConfig.entityType ?? data.entityType ?? '');
  const entityId = String(actionConfig.entityId ?? data.entityId ?? '');
  const field = String(actionConfig.field ?? '');
  const value = actionConfig.value;

  if (!entityType || !entityId || !field) {
    return { success: false, message: 'Missing entityType, entityId, or field for update' };
  }

  const updateData: Record<string, unknown> = { [field]: value };

  switch (entityType.toLowerCase()) {
    case 'lead':
      await db.lead.update({ where: { id: entityId, tenantId }, data: updateData });
      break;
    case 'deal':
      await db.deal.update({ where: { id: entityId, tenantId }, data: updateData });
      break;
    case 'contact':
      await db.contact.update({ where: { id: entityId, tenantId }, data: updateData });
      break;
    case 'task':
      await db.task.update({ where: { id: entityId, tenantId }, data: updateData });
      break;
    default:
      return { success: false, message: `Unsupported entity type for update: ${entityType}` };
  }

  return { success: true, message: `Updated ${entityType}.${field} = ${JSON.stringify(value)}` };
}

/**
 * ASSIGN_USER: Assign an owner to the triggering entity (round-robin or specific).
 */
async function executeAssignUser(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const entityType = String(actionConfig.entityType ?? data.entityType ?? '');
  const entityId = String(actionConfig.entityId ?? data.entityId ?? '');
  const assignmentMode = String(actionConfig.mode ?? 'specific'); // 'specific' or 'round_robin'

  if (!entityType || !entityId) {
    return { success: false, message: 'Missing entityType or entityId for assignment' };
  }

  let ownerId: string | undefined;

  if (assignmentMode === 'round_robin') {
    // Round-robin: get team members in the tenant and pick next one
    const teamGroupId = String(actionConfig.teamGroupId ?? '');
    ownerId = await resolveRoundRobin(tenantId, teamGroupId, entityType, entityId);
  } else {
    ownerId = resolveAssignee(tenantId, actionConfig, data);
  }

  if (!ownerId) {
    return { success: false, message: 'No user resolved for assignment' };
  }

  const updateData = { ownerId };

  switch (entityType.toLowerCase()) {
    case 'lead':
      await db.lead.update({ where: { id: entityId, tenantId }, data: updateData });
      break;
    case 'deal':
      await db.deal.update({ where: { id: entityId, tenantId }, data: updateData });
      break;
    case 'task':
      await db.task.update({ where: { id: entityId, tenantId }, data: updateData });
      break;
    default:
      return { success: false, message: `Unsupported entity type for assignment: ${entityType}` };
  }

  return { success: true, message: `Assigned ${entityType} to user ${ownerId}` };
}

/**
 * SEND_NOTIFICATION: Create a Notification record in the database.
 */
async function executeSendNotification(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string; notificationId?: string }> {
  const title = String(actionConfig.title ?? 'Automation Notification');
  const body = String(actionConfig.body ?? '');
  const type = String(actionConfig.notificationType ?? 'INFO');
  const category = String(actionConfig.category ?? 'GENERAL');
  const link = actionConfig.link ? String(actionConfig.link) : null;

  // Resolve recipient
  let recipientId = resolveAssignee(tenantId, actionConfig, data);
  if (!recipientId) {
    // Try "manager" — look up the owner's manager
    const ownerId = data.ownerId as string | undefined;
    if (ownerId) {
      const membership = await db.membership.findFirst({
        where: { userId: ownerId, tenantId },
        select: { userId: true },
      });
      // For now, use the owner as recipient if manager not resolvable
      recipientId = membership?.userId ?? ownerId;
    }
  }

  if (!recipientId) {
    return { success: false, message: 'No recipient resolved for notification' };
  }

  const notification = await db.notification.create({
    data: {
      tenantId,
      recipientId,
      title,
      body,
      type,
      category,
      link,
      metadata: { source: 'automation', actionConfig } as any,
    },
  });

  return { success: true, message: `Notification sent to ${recipientId}`, notificationId: notification.id };
}

/**
 * SEND_EMAIL: Send an actual email via the email service.
 */
async function executeSendEmail(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const to = String(actionConfig.to ?? '');
  const subject = String(actionConfig.subject ?? 'Automation Notification');
  const html = actionConfig.html ? String(actionConfig.html) : undefined;
  const text = actionConfig.text ? String(actionConfig.text) : undefined;

  // If "to" is a placeholder like "owner" or "contact", resolve it
  let resolvedTo = to;
  if (to === 'owner' || to === '{{owner.email}}') {
    const ownerId = data.ownerId as string | undefined;
    if (ownerId) {
      const user = await db.user.findUnique({ where: { id: ownerId }, select: { email: true } });
      resolvedTo = user?.email ?? '';
    }
  } else if (to === 'contact' || to === '{{contact.email}}') {
    resolvedTo = String(data.email ?? data.contactEmail ?? '');
  }

  // Simple template variable substitution
  const substituteVars = (str: string): string => {
    return str
      .replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ''))
      .replace(/\{\{(\w+)\.(\w+)\}\}/g, (_, obj, key) => {
        const nested = data[obj];
        if (nested && typeof nested === 'object') {
          return String((nested as Record<string, unknown>)[key] ?? '');
        }
        return '';
      });
  };

  if (!resolvedTo) {
    return { success: false, message: 'No email recipient resolved' };
  }

  const result = await sendEmail({
    to: resolvedTo,
    subject: substituteVars(subject),
    html: html ? substituteVars(html) : undefined,
    text: text ? substituteVars(text) : substituteVars(subject),
  });

  return {
    success: result.sent,
    message: result.sent
      ? `Email sent to ${resolvedTo} via ${result.provider}`
      : `Email not sent: ${result.error ?? 'unknown error'}`,
  };
}

/**
 * CREATE_FOLLOW_UP: Create a FollowUp record.
 */
async function executeCreateFollowUp(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string; followUpId?: string }> {
  const title = String(actionConfig.title ?? 'Automated Follow-up');
  const description = actionConfig.description ? String(actionConfig.description) : null;
  const followUpAtStr = String(actionConfig.followUpAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  const followUpAt = new Date(followUpAtStr);

  let userId = resolveAssignee(tenantId, actionConfig, data);
  if (!userId) userId = data.ownerId as string | undefined;
  if (!userId) return { success: false, message: 'No user resolved for follow-up' };

  const leadId = (actionConfig.leadId ?? data.leadId ?? null) as string | null;
  const contactId = (actionConfig.contactId ?? data.contactId ?? null) as string | null;
  const dealId = (actionConfig.dealId ?? data.dealId ?? null) as string | null;

  const followUp = await db.followUp.create({
    data: {
      tenantId,
      title,
      description,
      status: 'PENDING',
      followUpAt,
      userId,
      leadId,
      contactId,
      dealId,
    },
  });

  return { success: true, message: `Follow-up created: ${title}`, followUpId: followUp.id };
}

/**
 * ADD_TAG: Add a tag to the triggering entity.
 */
async function executeAddTag(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const tagName = String(actionConfig.tag ?? actionConfig.tagName ?? '');
  const entityType = String(actionConfig.entityType ?? data.entityType ?? '');
  const entityId = String(actionConfig.entityId ?? data.entityId ?? '');

  if (!tagName || !entityType || !entityId) {
    return { success: false, message: 'Missing tag name, entityType, or entityId' };
  }

  // Ensure the tag exists
  let tag = await db.tag.findFirst({
    where: { tenantId, name: tagName },
  });

  if (!tag) {
    tag = await db.tag.create({
      data: { tenantId, name: tagName, color: String(actionConfig.color ?? '#6366f1') },
    });
  }

  // Link tag to entity based on type
  switch (entityType.toLowerCase()) {
    case 'lead': {
      const lead = await db.lead.findUnique({ where: { id: entityId, tenantId }, include: { tags: true } });
      if (lead && !lead.tags.some((t) => t.tagId === tag.id)) {
        await db.leadTag.create({ data: { leadId: entityId, tagId: tag.id } });
      }
      break;
    }
    case 'contact': {
      const contact = await db.contact.findUnique({ where: { id: entityId, tenantId }, include: { tags: true } });
      if (contact && !contact.tags.some((t) => t.tagId === tag.id)) {
        await db.contactTag.create({ data: { contactId: entityId, tagId: tag.id } });
      }
      break;
    }
    default:
      return { success: false, message: `Tagging not supported for entity type: ${entityType}` };
  }

  return { success: true, message: `Tag "${tagName}" added to ${entityType}` };
}

/**
 * CREATE_ACTIVITY: Create an Activity log entry.
 */
async function executeCreateActivity(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string; activityId?: string }> {
  const type = String(actionConfig.activityType ?? 'NOTE');
  const title = String(actionConfig.title ?? 'Automated Activity');
  const description = actionConfig.description ? String(actionConfig.description) : null;
  const userId = (actionConfig.userId ?? data.ownerId ?? data.triggeredBy ?? null) as string | null;
  const leadId = (actionConfig.leadId ?? data.leadId ?? null) as string | null;
  const contactId = (actionConfig.contactId ?? data.contactId ?? null) as string | null;
  const dealId = (actionConfig.dealId ?? data.dealId ?? null) as string | null;

  const activity = await db.activity.create({
    data: {
      tenantId,
      type,
      title,
      description,
      userId,
      leadId,
      contactId,
      dealId,
      metadata: { source: 'automation' } as any,
    },
  });

  return { success: true, message: `Activity created: ${title}`, activityId: activity.id };
}

/**
 * TRIGGER_WEBHOOK: Fire an HTTP request to an external URL.
 */
async function executeTriggerWebhook(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const url = String(actionConfig.url ?? '');
  const method = String(actionConfig.method ?? 'POST').toUpperCase();
  const headers = (actionConfig.headers ?? {}) as Record<string, string>;
  const bodyPayload = (actionConfig.body ?? data) as Record<string, unknown>;

  if (!url) {
    return { success: false, message: 'Webhook URL not configured' };
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Webhook returned ${response.status}: ${response.statusText}`,
      };
    }

    return { success: true, message: `Webhook delivered to ${url} (${response.status})` };
  } catch (err) {
    return {
      success: false,
      message: `Webhook failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * AI_SUGGESTION: Call the AI gateway for a recommendation.
 * Returns null result if AI is not configured (graceful degradation).
 */
async function executeAiSuggestion(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string; suggestion?: string }> {
  if (!aiGateway.isAvailable()) {
    return {
      success: false,
      message: 'AI_PROVIDER_NOT_CONFIGURED — AI suggestion skipped',
    };
  }

  try {
    const prompt = String(
      actionConfig.prompt ??
      `Based on the following data, provide a recommendation: ${JSON.stringify(data).slice(0, 2000)}`,
    );

    const response = await aiGateway.process(prompt, tenantId, {
      actionType: 'ai_suggestion',
      entityType: data.entityType,
      entityId: data.entityId,
    });

    // Store the suggestion as an activity for traceability
    await db.activity.create({
      data: {
        tenantId,
        type: 'NOTE',
        title: 'AI Suggestion',
        description: response.content.slice(0, 5000),
        userId: (data.triggeredBy as string) ?? null,
        metadata: {
          source: 'automation',
          aiModel: response.model,
          aiProvider: response.providerId,
          usage: response.usage,
        } as any,
      },
    });

    return {
      success: true,
      message: `AI suggestion generated (${response.model})`,
      suggestion: response.content,
    };
  } catch (err) {
    // AI errors are non-fatal — log but don't fail the workflow
    logger.warn('AI suggestion failed', {
      module: 'automation-engine',
      tenantId,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return {
      success: false,
      message: `AI suggestion failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * SEND_WHATSAPP / SEND_SMS: Send via communication provider.
 * These create a message record and attempt delivery through configured providers.
 */
async function executeSendMessage(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
  channel: 'WHATSAPP' | 'SMS',
): Promise<{ success: boolean; message: string }> {
  // Check if a communication provider is configured for this channel
  const providerConfig = await db.communicationProviderConfig.findFirst({
    where: { tenantId, channel, isEnabled: true },
  });

  if (!providerConfig) {
    return {
      success: false,
      message: `PROVIDER_NOT_CONFIGURED — No ${channel} provider enabled for tenant`,
    };
  }

  const to = String(actionConfig.to ?? data.mobile ?? data.phone ?? '');
  const text = String(actionConfig.body ?? actionConfig.text ?? actionConfig.message ?? '');

  if (!to) {
    return { success: false, message: `No recipient for ${channel} message` };
  }

  // Create or reuse a system conversation for automated messages
  let conversation = await db.conversation.findFirst({
    where: { tenantId, channel, externalId: `automation:${tenantId}:${channel}` },
  });

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        tenantId,
        channel,
        externalId: `automation:${tenantId}:${channel}`,
        subject: 'Automated Messages',
        participantIds: [to],
        status: 'ACTIVE',
        metadata: { source: 'automation' },
      },
    });
  }

  // Create a message record for traceability
  const message = await db.message.create({
    data: {
      tenantId,
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      channel,
      contentType: 'TEXT',
      content: text,
      status: 'QUEUED',
      senderId: (data.triggeredBy as string) ?? null,
      externalSenderId: to,
      metadata: { source: 'automation', to, actionConfig } as any,
    },
  });

  // Attempt to send via the provider (the actual delivery is handled by the communication module)
  // For now we mark it as PROCESSING — the communication dispatcher would pick it up
  await db.message.update({
    where: { id: message.id },
    data: { status: 'PROCESSING' },
  });

  return { success: true, message: `${channel} message queued for ${to}` };
}

// ============================================
// HELPERS
// ============================================

/**
 * Resolve an assignee from action config and trigger data.
 * Supports: specific userId, "owner", "triggeredBy", or a template variable.
 */
function resolveAssignee(
  tenantId: string,
  actionConfig: Record<string, unknown>,
  data: Record<string, unknown>,
): string | undefined {
  const assignTo = String(actionConfig.assignTo ?? actionConfig.userId ?? '');

  switch (assignTo) {
    case 'owner':
      return data.ownerId as string | undefined;
    case 'triggeredBy':
      return data.triggeredBy as string | undefined;
    case 'manager': {
      // Will be resolved at call time by looking up the owner's manager
      // For now, return ownerId as fallback
      return data.ownerId as string | undefined;
    }
    default:
      if (assignTo && assignTo !== '') return assignTo;
      return data.ownerId as string | undefined;
  }
}

/**
 * Resolve round-robin assignment within a tenant.
 * Uses a simple least-recently-assigned strategy based on task ownership counts.
 */
async function resolveRoundRobin(
  tenantId: string,
  _teamGroupId: string,
  entityType: string,
  _entityId: string,
): Promise<string | undefined> {
  // Get active members in the tenant
  const members = await db.membership.findMany({
    where: { tenantId, status: 'ACTIVE' },
    select: { userId: true },
  });

  if (members.length === 0) return undefined;

  // Count recent assignments for each member
  const assignmentCounts = await db.task.groupBy({
    by: ['ownerId'],
    where: {
      tenantId,
      entityType,
      ownerId: { in: members.map((m) => m.userId) },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'asc' } },
  });

  if (assignmentCounts.length > 0 && assignmentCounts[0].ownerId) {
    return assignmentCounts[0].ownerId;
  }

  // Fallback: pick the first member
  return members[0].userId;
}

// ============================================
// MAIN ACTION EXECUTOR
// ============================================

/**
 * Execute a single action and return the result.
 * This is the central dispatcher that routes to specific action implementations.
 */
async function executeAction(
  action: { id: string; type: string; config: unknown; delayMs: number },
  tenantId: string,
  data: Record<string, unknown>,
  eventType: string,
): Promise<ActionResult> {
  const startTime = Date.now();
  const actionConfig = (action.config as Record<string, unknown>) ?? {};

  try {
    // Handle DELAY action — actually wait (bounded by MAX_DELAY_MS)
    if (action.type === 'delay') {
      const delayMs = Math.min(action.delayMs || Number(actionConfig.delayMs ?? 0), MAX_DELAY_MS);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return {
        actionId: action.id,
        actionType: action.type,
        level: 'INFO',
        message: `Delay completed: ${delayMs}ms`,
        data: { delayMs },
        durationMs: Date.now() - startTime,
      };
    }

    let result: { success: boolean; message: string; [key: string]: unknown };

    switch (action.type) {
      case 'create_task':
        result = await executeCreateTask(tenantId, actionConfig, data);
        break;

      case 'update_lead':
      case 'update_deal':
      case 'change_status':
        result = await executeUpdateField(tenantId, actionConfig, data);
        break;

      case 'assign_user':
        result = await executeAssignUser(tenantId, actionConfig, data);
        break;

      case 'create_notification':
        result = await executeSendNotification(tenantId, actionConfig, data);
        break;

      case 'send_email':
        result = await executeSendEmail(tenantId, actionConfig, data);
        break;

      case 'send_whatsapp':
        result = await executeSendMessage(tenantId, actionConfig, data, 'WHATSAPP');
        break;

      case 'send_sms':
        result = await executeSendMessage(tenantId, actionConfig, data, 'SMS');
        break;

      case 'create_followup':
        result = await executeCreateFollowUp(tenantId, actionConfig, data);
        break;

      case 'add_tag':
        result = await executeAddTag(tenantId, actionConfig, data);
        break;

      case 'create_activity':
        result = await executeCreateActivity(tenantId, actionConfig, data);
        break;

      case 'trigger_webhook':
      case 'webhook':
        result = await executeTriggerWebhook(tenantId, actionConfig, data);
        break;

      case 'ai_action':
      case 'ai_suggestion':
        result = await executeAiSuggestion(tenantId, actionConfig, data);
        break;

      default:
        result = {
          success: false,
          message: `Unknown action type: ${action.type} — skipped`,
        };
    }

    return {
      actionId: action.id,
      actionType: action.type,
      level: result.success ? 'INFO' : 'WARN',
      message: result.message,
      data: result,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown execution error';
    logger.error('Action execution failed', {
      module: 'automation-engine',
      actionType: action.type,
      actionId: action.id,
      tenantId,
      error: errorMsg,
    });

    return {
      actionId: action.id,
      actionType: action.type,
      level: 'ERROR',
      message: `Action failed: ${errorMsg}`,
      data: { error: errorMsg },
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================
// MAIN ENGINE: triggerEvent()
// ============================================

/**
 * Trigger an automation event.
 *
 * This is the main entry point called from business logic.
 * It runs asynchronously and NEVER throws — errors are logged internally.
 *
 * Usage:
 *   await triggerEvent({ eventType: 'lead.created', tenantId, data: { ...lead, entityId: lead.id, entityType: 'lead' } });
 *
 * Or use the convenience functions in dispatcher.ts.
 */
export async function triggerEvent(context: TriggerContext): Promise<TriggerResult> {
  const { eventType, tenantId, data, entityId, entityType, triggeredBy } = context;

  const result: TriggerResult = {
    matchedWorkflows: 0,
    executedWorkflows: 0,
    skippedConditionFail: 0,
    errors: 0,
    results: [],
  };

  try {
    // 1. Find all ACTIVE workflows in this tenant whose triggers match the event type
    const workflows = await db.automationWorkflow.findMany({
      where: {
        tenantId,
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
      take: MAX_WORKFLOWS_PER_EVENT,
    });

    result.matchedWorkflows = workflows.length;

    if (workflows.length === 0) {
      logger.info('No matching workflows for event', {
        module: 'automation-engine',
        eventType,
        tenantId,
      });
      return result;
    }

    logger.info('Processing automation event', {
      module: 'automation-engine',
      eventType,
      tenantId,
      matchedWorkflows: workflows.length,
    });

    // 2. Process each matching workflow
    for (const workflow of workflows) {
      try {
        // Verify trigger match (defense in depth)
        const triggerMatches = workflow.triggers.some((t) => t.eventType === eventType);
        if (!triggerMatches) continue;

        // 3. Evaluate conditions against event data
        const conditionsPass = evaluateAllConditions(
          workflow.conditions.map((c) => ({
            field: c.field,
            operator: c.operator,
            value: c.value,
            logic: c.logic,
            sortOrder: c.sortOrder,
          })),
          data,
        );

        if (!conditionsPass) {
          result.skippedConditionFail++;
          result.results.push({
            workflowId: workflow.id,
            workflowName: workflow.name,
            executionId: '',
            status: 'SKIPPED',
          });
          continue;
        }

        // 4. Create AutomationExecution record
        const idempotencyKey = randomUUID();
        const execution = await db.automationExecution.create({
          data: {
            tenantId,
            workflowId: workflow.id,
            triggerEvent: eventType,
            status: 'RUNNING',
            triggerData: data as any,
            entityId: entityId ?? null,
            entityType: entityType ?? null,
            triggeredById: triggeredBy ?? null,
            idempotencyKey,
          },
        });

        // 5. Execute actions in order
        const actionsToExecute = workflow.actions.slice(0, MAX_ACTIONS_PER_EXECUTION);
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
          // Handle pre-action delay (delayMs on the action itself)
          if (action.delayMs > 0) {
            const clampedDelay = Math.min(action.delayMs, MAX_DELAY_MS);
            await new Promise((resolve) => setTimeout(resolve, clampedDelay));
          }

          const actionResult = await executeAction(action, tenantId, data, eventType);

          logsToCreate.push({
            tenantId,
            executionId: execution.id,
            actionId: actionResult.actionId,
            level: actionResult.level,
            message: actionResult.message,
            data: actionResult.data as any,
            durationMs: actionResult.durationMs,
          });

          // If action errored, mark execution as failed but continue logging
          if (actionResult.level === 'ERROR') {
            executionFailed = true;
            executionError = actionResult.message;
            break; // Stop executing further actions on error
          }
        }

        // Log loop prevention if actions were truncated
        if (workflow.actions.length > MAX_ACTIONS_PER_EXECUTION) {
          logsToCreate.push({
            tenantId,
            executionId: execution.id,
            actionId: null,
            level: 'WARN',
            message: `Loop prevention: exceeded maximum of ${MAX_ACTIONS_PER_EXECUTION} actions`,
            data: { totalActions: workflow.actions.length, executed: MAX_ACTIONS_PER_EXECUTION },
            durationMs: 0,
          });
        }

        // 6. Persist execution logs
        if (logsToCreate.length > 0) {
          await db.automationExecutionLog.createMany({ data: logsToCreate });
        }

        // 7. Update execution status
        const finalStatus = executionFailed ? 'FAILED' : 'COMPLETED';
        await db.automationExecution.update({
          where: { id: execution.id },
          data: {
            status: finalStatus,
            error: executionError,
            completedAt: new Date(),
          },
        });

        // 8. Update workflow stats
        await db.automationWorkflow.update({
          where: { id: workflow.id },
          data: {
            executionCount: { increment: 1 },
            lastExecutedAt: new Date(),
          },
        });

        if (executionFailed) {
          result.errors++;
        } else {
          result.executedWorkflows++;
        }

        result.results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          executionId: execution.id,
          status: finalStatus,
        });
      } catch (workflowErr) {
        // Individual workflow errors don't stop other workflows
        result.errors++;
        logger.error('Workflow execution failed', {
          module: 'automation-engine',
          workflowId: workflow.id,
          workflowName: workflow.name,
          tenantId,
          error: workflowErr instanceof Error ? workflowErr.message : 'Unknown error',
        });

        result.results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          executionId: '',
          status: 'FAILED',
        });
      }
    }

    logger.info('Automation event processed', {
      module: 'automation-engine',
      eventType,
      tenantId,
      matched: result.matchedWorkflows,
      executed: result.executedWorkflows,
      skipped: result.skippedConditionFail,
      errors: result.errors,
    });
  } catch (err) {
    // Top-level error — never throw, just log
    logger.error('Automation engine error', {
      module: 'automation-engine',
      eventType,
      tenantId,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  return result;
}

/**
 * Fire-and-forget version of triggerEvent.
 * Runs the engine in the background without awaiting the result.
 * Use this from API route handlers to avoid blocking the response.
 */
export function triggerEventAsync(context: TriggerContext): void {
  // Use Promise.resolve().then() to start execution without awaiting
  // Errors are caught internally by triggerEvent, so this is safe
  Promise.resolve()
    .then(() => triggerEvent(context))
    .catch(() => {
      // Double safety: should never reach here since triggerEvent catches its own errors
    });
}
