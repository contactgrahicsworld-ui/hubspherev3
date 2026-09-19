/**
 * Automation Dispatcher — HubSphere V3
 *
 * Convenience module that wraps the automation engine with domain-specific
 * trigger functions. Import and call these from your API route handlers
 * to trigger automation workflows when business events occur.
 *
 * All functions use triggerEventAsync (fire-and-forget) so they never
 * block the triggering operation.
 *
 * Usage in API routes:
 *
 *   import { onLeadCreated } from '@/lib/automation/dispatcher';
 *
 *   // After creating a lead:
 *   onLeadCreated(tenantId, lead);
 */

import { triggerEventAsync, type TriggerEventType } from './engine';

// ============================================
// TYPES — Entity shapes for dispatcher functions
// ============================================

interface LeadLike {
  id: string;
  tenantId: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  mobile?: string | null;
  company?: string | null;
  source?: string | null;
  status?: string | null;
  priority?: string | null;
  ownerId?: string | null;
  value?: number | null;
  [key: string]: unknown;
}

interface DealLike {
  id: string;
  tenantId: string;
  title: string;
  value?: number | null;
  currency?: string | null;
  stage?: string | null;
  probability?: number | null;
  contactId?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
  [key: string]: unknown;
}

interface CallLike {
  id: string;
  tenantId: string;
  leadId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  agentId?: string | null;
  direction?: string | null;
  duration?: number | null;
  callStatus?: string | null;
  [key: string]: unknown;
}

interface TaskLike {
  id: string;
  tenantId: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  ownerId?: string | null;
  dueDate?: Date | string | null;
  entityType?: string | null;
  entityId?: string | null;
  [key: string]: unknown;
}

interface FieldVisitLike {
  id: string;
  tenantId: string;
  employeeId?: string | null;
  leadId?: string | null;
  contactId?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

interface InvoiceLike {
  id: string;
  tenantId: string;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  dueDate?: Date | string | null;
  subscriptionId?: string | null;
  [key: string]: unknown;
}

interface LeaveRequestLike {
  id: string;
  tenantId: string;
  employeeId?: string | null;
  leaveTypeId?: string | null;
  status?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  [key: string]: unknown;
}

interface ContactLike {
  id: string;
  tenantId: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  mobile?: string | null;
  ownerId?: string | null;
  [key: string]: unknown;
}

// ============================================
// CRM TRIGGERS
// ============================================

/**
 * Fire when a new lead is created.
 * Call from: POST /api/v1/crm/leads
 */
export function onLeadCreated(tenantId: string, lead: LeadLike, triggeredBy?: string): void {
  triggerEventAsync({
    eventType: 'lead.created' as TriggerEventType,
    tenantId,
    data: {
      ...lead,
      entityId: lead.id,
      entityType: 'lead',
      triggeredBy,
    },
    entityId: lead.id,
    entityType: 'lead',
    triggeredBy,
  });
}

/**
 * Fire when a lead is updated.
 * Call from: PATCH /api/v1/crm/leads/[id]
 */
export function onLeadUpdated(
  tenantId: string,
  lead: LeadLike,
  changedFields: Record<string, unknown>,
  triggeredBy?: string,
): void {
  triggerEventAsync({
    eventType: 'lead.updated' as TriggerEventType,
    tenantId,
    data: {
      ...lead,
      changedFields,
      entityId: lead.id,
      entityType: 'lead',
      triggeredBy,
    },
    entityId: lead.id,
    entityType: 'lead',
    triggeredBy,
  });
}

/**
 * Fire when a lead's status changes.
 * Call from: PATCH /api/v1/crm/leads/[id] (when status field changes)
 */
export function onLeadStatusChanged(
  tenantId: string,
  lead: LeadLike,
  oldStatus: string,
  newStatus: string,
  triggeredBy?: string,
): void {
  triggerEventAsync({
    eventType: 'lead.status_changed' as TriggerEventType,
    tenantId,
    data: {
      ...lead,
      oldStatus,
      newStatus,
      entityId: lead.id,
      entityType: 'lead',
      triggeredBy,
    },
    entityId: lead.id,
    entityType: 'lead',
    triggeredBy,
  });
}

/**
 * Fire when a new deal is created.
 * Call from: POST /api/v1/crm/deals
 */
export function onDealCreated(tenantId: string, deal: DealLike, triggeredBy?: string): void {
  triggerEventAsync({
    eventType: 'deal.created' as TriggerEventType,
    tenantId,
    data: {
      ...deal,
      entityId: deal.id,
      entityType: 'deal',
      triggeredBy,
    },
    entityId: deal.id,
    entityType: 'deal',
    triggeredBy,
  });
}

/**
 * Fire when a deal's stage changes.
 * Also fires deal.won or deal.lost if the new stage is WON or LOST.
 * Call from: PATCH /api/v1/crm/deals/[id]/stage
 */
export function onDealStageChanged(
  tenantId: string,
  deal: DealLike,
  oldStage: string,
  newStage: string,
  triggeredBy?: string,
): void {
  const baseData = {
    ...deal,
    oldStage,
    newStage,
    entityId: deal.id,
    entityType: 'deal',
    triggeredBy,
  };

  // Always fire the generic stage_changed event
  triggerEventAsync({
    eventType: 'deal.stage_changed' as TriggerEventType,
    tenantId,
    data: baseData,
    entityId: deal.id,
    entityType: 'deal',
    triggeredBy,
  });

  // Additionally fire deal.won or deal.lost for pipeline terminal states
  if (newStage === 'WON') {
    triggerEventAsync({
      eventType: 'deal.won' as TriggerEventType,
      tenantId,
      data: baseData,
      entityId: deal.id,
      entityType: 'deal',
      triggeredBy,
    });
  } else if (newStage === 'LOST') {
    triggerEventAsync({
      eventType: 'deal.lost' as TriggerEventType,
      tenantId,
      data: baseData,
      entityId: deal.id,
      entityType: 'deal',
      triggeredBy,
    });
  }
}

/**
 * Fire when a deal is updated.
 * Call from: PATCH /api/v1/crm/deals/[id]
 */
export function onDealUpdated(
  tenantId: string,
  deal: DealLike,
  changedFields: Record<string, unknown>,
  triggeredBy?: string,
): void {
  triggerEventAsync({
    eventType: 'deal.updated' as TriggerEventType,
    tenantId,
    data: {
      ...deal,
      changedFields,
      entityId: deal.id,
      entityType: 'deal',
      triggeredBy,
    },
    entityId: deal.id,
    entityType: 'deal',
    triggeredBy,
  });
}

/**
 * Fire when a new contact is created.
 * Call from: POST /api/v1/crm/contacts
 */
export function onContactCreated(tenantId: string, contact: ContactLike, triggeredBy?: string): void {
  triggerEventAsync({
    eventType: 'contact.created' as TriggerEventType,
    tenantId,
    data: {
      ...contact,
      entityId: contact.id,
      entityType: 'contact',
      triggeredBy,
    },
    entityId: contact.id,
    entityType: 'contact',
    triggeredBy,
  });
}

/**
 * Fire when a contact is updated.
 * Call from: PATCH /api/v1/crm/contacts/[id]
 */
export function onContactUpdated(
  tenantId: string,
  contact: ContactLike,
  changedFields: Record<string, unknown>,
  triggeredBy?: string,
): void {
  triggerEventAsync({
    eventType: 'contact.updated' as TriggerEventType,
    tenantId,
    data: {
      ...contact,
      changedFields,
      entityId: contact.id,
      entityType: 'contact',
      triggeredBy,
    },
    entityId: contact.id,
    entityType: 'contact',
    triggeredBy,
  });
}

// ============================================
// TASK TRIGGERS
// ============================================

/**
 * Fire when a new task is created.
 * Call from: POST /api/v1/crm/tasks
 */
export function onTaskCreated(tenantId: string, task: TaskLike, triggeredBy?: string): void {
  triggerEventAsync({
    eventType: 'task.created' as TriggerEventType,
    tenantId,
    data: {
      ...task,
      entityId: task.id,
      entityType: 'task',
      triggeredBy,
    },
    entityId: task.id,
    entityType: 'task',
    triggeredBy,
  });
}

/**
 * Fire when a task is completed.
 * Call from: PATCH /api/v1/crm/tasks/[id] (when status becomes COMPLETED)
 */
export function onTaskCompleted(tenantId: string, task: TaskLike, triggeredBy?: string): void {
  triggerEventAsync({
    eventType: 'task.completed' as TriggerEventType,
    tenantId,
    data: {
      ...task,
      entityId: task.id,
      entityType: 'task',
      triggeredBy,
    },
    entityId: task.id,
    entityType: 'task',
    triggeredBy,
  });
}

/**
 * Fire when a task becomes overdue.
 * Call from: scheduled job / cron that checks for overdue tasks.
 */
export function onTaskOverdue(tenantId: string, task: TaskLike): void {
  triggerEventAsync({
    eventType: 'task.overdue' as TriggerEventType,
    tenantId,
    data: {
      ...task,
      entityId: task.id,
      entityType: 'task',
    },
    entityId: task.id,
    entityType: 'task',
  });
}

// ============================================
// CALL TRIGGERS
// ============================================

/**
 * Fire when a call is completed.
 * Call from: POST /api/v1/call-events (when call status becomes ENDED)
 */
export function onCallCompleted(tenantId: string, call: CallLike, triggeredBy?: string): void {
  triggerEventAsync({
    eventType: 'call.completed' as TriggerEventType,
    tenantId,
    data: {
      ...call,
      entityId: call.id,
      entityType: 'call',
      triggeredBy,
    },
    entityId: call.id,
    entityType: 'call',
    triggeredBy,
  });
}

/**
 * Fire when a call is missed.
 * Call from: POST /api/v1/call-events (when call status becomes MISSED)
 */
export function onCallMissed(tenantId: string, call: CallLike, triggeredBy?: string): void {
  triggerEventAsync({
    eventType: 'call.missed' as TriggerEventType,
    tenantId,
    data: {
      ...call,
      entityId: call.id,
      entityType: 'call',
      triggeredBy,
    },
    entityId: call.id,
    entityType: 'call',
    triggeredBy,
  });
}

// ============================================
// HRMS / FIELD SALES TRIGGERS
// ============================================

/**
 * Fire when a field visit is completed.
 * Call from: PATCH /api/v1/hrms/field-visits/[id] (when status becomes COMPLETED)
 */
export function onFieldVisitCompleted(tenantId: string, visit: FieldVisitLike, triggeredBy?: string): void {
  triggerEventAsync({
    eventType: 'field_visit.completed' as TriggerEventType,
    tenantId,
    data: {
      ...visit,
      entityId: visit.id,
      entityType: 'field_visit',
      triggeredBy,
    },
    entityId: visit.id,
    entityType: 'field_visit',
    triggeredBy,
  });
}

/**
 * Fire when a new employee is created.
 * Call from: POST /api/v1/hrms/employees
 */
export function onEmployeeCreated(
  tenantId: string,
  employee: { id: string; tenantId: string; [key: string]: unknown },
  triggeredBy?: string,
): void {
  triggerEventAsync({
    eventType: 'employee.created' as TriggerEventType,
    tenantId,
    data: {
      ...employee,
      entityId: employee.id,
      entityType: 'employee',
      triggeredBy,
    },
    entityId: employee.id,
    entityType: 'employee',
    triggeredBy,
  });
}

/**
 * Fire when a leave request is submitted.
 * Call from: POST /api/v1/hrms/leave-requests
 */
export function onLeaveRequested(tenantId: string, leaveRequest: LeaveRequestLike, triggeredBy?: string): void {
  triggerEventAsync({
    eventType: 'leave.requested' as TriggerEventType,
    tenantId,
    data: {
      ...leaveRequest,
      entityId: leaveRequest.id,
      entityType: 'leave_request',
      triggeredBy,
    },
    entityId: leaveRequest.id,
    entityType: 'leave_request',
    triggeredBy,
  });
}

/**
 * Fire when a leave request is approved.
 * Call from: PATCH /api/v1/hrms/leave-requests/[id] (when status becomes APPROVED)
 */
export function onLeaveApproved(tenantId: string, leaveRequest: LeaveRequestLike, triggeredBy?: string): void {
  triggerEventAsync({
    eventType: 'leave.approved' as TriggerEventType,
    tenantId,
    data: {
      ...leaveRequest,
      entityId: leaveRequest.id,
      entityType: 'leave_request',
      triggeredBy,
    },
    entityId: leaveRequest.id,
    entityType: 'leave_request',
    triggeredBy,
  });
}

// ============================================
// BILLING TRIGGERS
// ============================================

/**
 * Fire when an invoice becomes overdue.
 * Call from: scheduled job / cron that checks for overdue invoices.
 */
export function onInvoiceOverdue(tenantId: string, invoice: InvoiceLike): void {
  triggerEventAsync({
    eventType: 'invoice.overdue' as TriggerEventType,
    tenantId,
    data: {
      ...invoice,
      entityId: invoice.id,
      entityType: 'invoice',
    },
    entityId: invoice.id,
    entityType: 'invoice',
  });
}

/**
 * Fire when a payment is received.
 * Call from: billing webhook / POST payment processing
 */
export function onPaymentReceived(
  tenantId: string,
  payment: { id: string; amount: number; currency?: string; invoiceId?: string; [key: string]: unknown },
  triggeredBy?: string,
): void {
  triggerEventAsync({
    eventType: 'payment.received' as TriggerEventType,
    tenantId,
    data: {
      ...payment,
      entityId: payment.id,
      entityType: 'payment',
      triggeredBy,
    },
    entityId: payment.id,
    entityType: 'payment',
    triggeredBy,
  });
}

// ============================================
// CUSTOM EVENT
// ============================================

/**
 * Fire a custom automation event.
 * Use for any event not covered by the specific dispatcher functions.
 */
export function onCustomEvent(
  tenantId: string,
  eventName: string,
  data: Record<string, unknown>,
  entityId?: string,
  entityType?: string,
  triggeredBy?: string,
): void {
  triggerEventAsync({
    eventType: 'custom_event' as TriggerEventType,
    tenantId,
    data: {
      ...data,
      customEventName: eventName,
      entityId,
      entityType,
      triggeredBy,
    },
    entityId,
    entityType,
    triggeredBy,
  });
}
