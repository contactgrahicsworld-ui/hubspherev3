/**
 * Application-wide constants.
 * Single source of truth for roles, statuses, modules, and provider categories.
 */

// ============================================
// DEFAULT ROLES
// ============================================

export const DEFAULT_ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Platform administrator with full access to all tenants and settings', isSystem: true },
  { code: 'TENANT_OWNER', name: 'Tenant Owner', description: 'Tenant owner with full access within their organization', isSystem: true },
  { code: 'ADMIN', name: 'Admin', description: 'Organization administrator with broad access', isSystem: true },
  { code: 'MANAGER', name: 'Manager', description: 'Team manager with reporting and team management access', isSystem: true },
  { code: 'SALES_MANAGER', name: 'Sales Manager', description: 'Manages sales team, deals pipeline, and reports', isSystem: true },
  { code: 'SALES_EXECUTIVE', name: 'Sales Executive', description: 'Handles leads, contacts, and deal progression', isSystem: true },
  { code: 'TELECALLER', name: 'Telecaller', description: 'Makes and manages outbound/inbound calls', isSystem: true },
  { code: 'HR_MANAGER', name: 'HR Manager', description: 'Manages employees, attendance, and payroll', isSystem: true },
  { code: 'HR_EXECUTIVE', name: 'HR Executive', description: 'Handles day-to-day HR operations', isSystem: true },
  { code: 'FIELD_MANAGER', name: 'Field Manager', description: 'Manages field operations and field teams', isSystem: true },
  { code: 'FIELD_EXECUTIVE', name: 'Field Executive', description: 'Performs field activities and visits', isSystem: true },
  { code: 'ACCOUNTANT', name: 'Accountant', description: 'Manages financial records and payroll', isSystem: true },
  { code: 'VIEWER', name: 'Viewer', description: 'Read-only access across modules', isSystem: true },
] as const;

// ============================================
// PERMISSION MODULES
// ============================================

export const PERMISSION_MODULES = [
  'users',
  'roles',
  'tenants',
  'audit',
  'leads',
  'contacts',
  'companies',
  'deals',
  'calls',
  'recordings',
  'tasks',
  'followups',
  'employees',
  'departments',
  'designations',
  'attendance',
  'leave',
  'field',
  'visits',
  'expenses',
  'payroll',
  'conversations',
  'messages',
  'templates',
  'communication_settings',
  'notifications',
  'automation',
  'webhooks',
  'ai',
  'subscriptions',
  'features',
  'settings',
  'activities',
  'dashboard',
  'notes',
  'tags',
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

// ============================================
// PERMISSION ACTIONS
// ============================================

export const PERMISSION_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'manage',
  'export',
  'import',
  'execute',
  'approve',
  'reject',
  'update',
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

// ============================================
// CALL STATUSES
// ============================================

export const CALL_STATUSES = {
  RINGING: 'RINGING',
  CONNECTED: 'CONNECTED',
  ENDED: 'ENDED',
  FAILED: 'FAILED',
  MISSED: 'MISSED',
  QUEUED: 'QUEUED',
} as const;

// ============================================
// RECORDING STATUSES
// ============================================

export const RECORDING_STATUSES = {
  RECORDING: 'RECORDING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
} as const;

// ============================================
// TENANT STATUSES
// ============================================

export const TENANT_STATUSES = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  TRIAL: 'TRIAL',
} as const;

// ============================================
// SUBSCRIPTION STATUSES
// ============================================

export const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
  PAST_DUE: 'PAST_DUE',
  TRIALING: 'TRIALING',
} as const;

// ============================================
// USER STATUSES
// ============================================

export const USER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

// ============================================
// PROVIDER CATEGORIES
// ============================================

export const PROVIDER_CATEGORIES = [
  'AIProvider',
  'SpeechToTextProvider',
  'TextToSpeechProvider',
  'TranslationProvider',
  'TelephonyProvider',
  'CallRecordingProvider',
  'MessagingProvider',
  'StorageProvider',
  'NotificationProvider',
] as const;

export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

// ============================================
// LEAD STATUSES
// ============================================

export const LEAD_STATUSES = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  PROPOSAL: 'PROPOSAL',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
} as const;

export type LeadStatus = (typeof LEAD_STATUSES)[keyof typeof LEAD_STATUSES];

// ============================================
// LEAD SOURCES
// ============================================

export const LEAD_SOURCES = {
  WEBSITE: 'WEBSITE',
  REFERRAL: 'REFERRAL',
  LINKEDIN: 'LINKEDIN',
  COLD_CALL: 'COLD_CALL',
  EMAIL_CAMPAIGN: 'EMAIL_CAMPAIGN',
  ADVERTISEMENT: 'ADVERTISEMENT',
  TRADE_SHOW: 'TRADE_SHOW',
  SOCIAL_MEDIA: 'SOCIAL_MEDIA',
  OTHER: 'OTHER',
} as const;

// ============================================
// PRIORITY LEVELS
// ============================================

export const PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

// ============================================
// DEAL STAGES (Sales Pipeline)
// ============================================

export const DEAL_STAGES = [
  { key: 'NEW', label: 'New', color: '#6366f1' },
  { key: 'QUALIFIED', label: 'Qualified', color: '#3b82f6' },
  { key: 'PROPOSAL', label: 'Proposal', color: '#f59e0b' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: '#f97316' },
  { key: 'WON', label: 'Won', color: '#22c55e' },
  { key: 'LOST', label: 'Lost', color: '#ef4444' },
] as const;

// ============================================
// TASK STATUSES
// ============================================

export const TASK_STATUSES = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

// ============================================
// FOLLOW-UP STATUSES
// ============================================

export const FOLLOWUP_STATUSES = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  MISSED: 'MISSED',
  CANCELLED: 'CANCELLED',
} as const;

// ============================================
// ACTIVITY TYPES
// ============================================

export const ACTIVITY_TYPES = {
  CALL: 'CALL',
  EMAIL: 'EMAIL',
  MEETING: 'MEETING',
  NOTE: 'NOTE',
  TASK: 'TASK',
  DEAL_STAGE: 'DEAL_STAGE',
  LEAD_STATUS: 'LEAD_STATUS',
  LEAD_CREATED: 'LEAD_CREATED',
  CONTACT_CREATED: 'CONTACT_CREATED',
  DEAL_CREATED: 'DEAL_CREATED',
  FOLLOWUP: 'FOLLOWUP',
} as const;

// ============================================
// EMPLOYMENT STATUSES
// ============================================

export const EMPLOYMENT_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  RESIGNED: 'RESIGNED',
  TERMINATED: 'TERMINATED',
} as const;

// ============================================
// ATTENDANCE STATUSES
// ============================================

export const ATTENDANCE_STATUSES = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  HALF_DAY: 'HALF_DAY',
  LATE: 'LATE',
  ON_LEAVE: 'ON_LEAVE',
  HOLIDAY: 'HOLIDAY',
  WEEK_OFF: 'WEEK_OFF',
} as const;

// ============================================
// LEAVE REQUEST STATUSES
// ============================================

export const LEAVE_REQUEST_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

// ============================================
// LEAVE TYPE CODES
// ============================================

export const LEAVE_TYPE_CODES = {
  CASUAL: 'CASUAL',
  SICK: 'SICK',
  EARNED: 'EARNED',
  MATERNITY: 'MATERNITY',
  PATERNITY: 'PATERNITY',
  COMPENSATORY: 'COMPENSATORY',
  LOSS_OF_PAY: 'LOSS_OF_PAY',
} as const;

// ============================================
// FIELD VISIT STATUSES
// ============================================

export const FIELD_VISIT_STATUSES = {
  PLANNED: 'PLANNED',
  STARTED: 'STARTED',
  COMPLETED: 'COMPLETED',
  MISSED: 'MISSED',
  CANCELLED: 'CANCELLED',
} as const;

// ============================================
// EXPENSE STATUSES
// ============================================

export const EXPENSE_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
} as const;

// ============================================
// EXPENSE CATEGORIES
// ============================================

export const EXPENSE_CATEGORIES = {
  TRAVEL: 'TRAVEL',
  FOOD: 'FOOD',
  ACCOMMODATION: 'ACCOMMODATION',
  TRANSPORT: 'TRANSPORT',
  COMMUNICATION: 'COMMUNICATION',
  EQUIPMENT: 'EQUIPMENT',
  OTHER: 'OTHER',
} as const;

// ============================================
// PAYROLL STATUSES
// ============================================

export const PAYROLL_STATUSES = {
  DRAFT: 'DRAFT',
  PROCESSING: 'PROCESSING',
  FINALIZED: 'FINALIZED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;

// ============================================
// BANK TRANSFER STATUSES
// ============================================

export const BANK_TRANSFER_STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;

// ============================================
// DOCUMENT TYPES
// ============================================

export const DOCUMENT_TYPES = {
  RESUME: 'RESUME',
  ID_PROOF: 'ID_PROOF',
  ADDRESS_PROOF: 'ADDRESS_PROOF',
  OFFER_LETTER: 'OFFER_LETTER',
  CONTRACT: 'CONTRACT',
  OTHER: 'OTHER',
} as const;

// ============================================
// COMMUNICATION CHANNELS
// ============================================

export const COMMUNICATION_CHANNELS = {
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  IN_APP: 'IN_APP',
  PUSH: 'PUSH',
  SYSTEM: 'SYSTEM',
} as const;

export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[keyof typeof COMMUNICATION_CHANNELS];

// ============================================
// MESSAGE DIRECTIONS
// ============================================

export const MESSAGE_DIRECTIONS = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
  SYSTEM: 'SYSTEM',
} as const;

// ============================================
// MESSAGE STATUSES
// ============================================

export const MESSAGE_STATUSES = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

// ============================================
// MESSAGE CONTENT TYPES
// ============================================

export const MESSAGE_CONTENT_TYPES = {
  TEXT: 'TEXT',
  HTML: 'HTML',
  MARKDOWN: 'MARKDOWN',
  RICH_TEXT: 'RICH_TEXT',
} as const;

// ============================================
// CONVERSATION STATUSES
// ============================================

export const CONVERSATION_STATUSES = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
} as const;

// ============================================
// TEMPLATE CATEGORIES
// ============================================

export const TEMPLATE_CATEGORIES = {
  TRANSACTIONAL: 'TRANSACTIONAL',
  MARKETING: 'MARKETING',
  NOTIFICATION: 'NOTIFICATION',
  ALERT: 'ALERT',
} as const;

// ============================================
// TEMPLATE STATUSES
// ============================================

export const TEMPLATE_STATUSES = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

// ============================================
// DELIVERY ATTEMPT STATUSES
// ============================================

export const DELIVERY_ATTEMPT_STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;

// ============================================
// MESSAGE EVENT TYPES
// ============================================

export const MESSAGE_EVENT_TYPES = {
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  REPLIED: 'REPLIED',
  CLICKED: 'CLICKED',
} as const;

// ============================================
// AUTOMATION WORKFLOW STATUSES
// ============================================

export const AUTOMATION_WORKFLOW_STATUSES = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
} as const;

// ============================================
// AUTOMATION TRIGGER EVENT TYPES
// ============================================

export const AUTOMATION_TRIGGER_EVENTS = {
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_ASSIGNED: 'lead.assigned',
  LEAD_STATUS_CHANGED: 'lead.status_changed',
  DEAL_CREATED: 'deal.created',
  DEAL_STAGE_CHANGED: 'deal.stage_changed',
  DEAL_WON: 'deal.won',
  DEAL_LOST: 'deal.lost',
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  FOLLOWUP_DUE: 'followup.due',
  FOLLOWUP_OVERDUE: 'followup.overdue',
  CALL_COMPLETED: 'call.completed',
  EMPLOYEE_CREATED: 'employee.created',
  LEAVE_REQUESTED: 'leave.requested',
  LEAVE_APPROVED: 'leave.approved',
  ATTENDANCE_CHECKIN: 'attendance.checkin',
  ATTENDANCE_CHECKOUT: 'attendance.checkout',
  EXPENSE_SUBMITTED: 'expense.submitted',
  EXPENSE_APPROVED: 'expense.approved',
} as const;

export type AutomationTriggerEvent = (typeof AUTOMATION_TRIGGER_EVENTS)[keyof typeof AUTOMATION_TRIGGER_EVENTS];

// ============================================
// AUTOMATION CONDITION OPERATORS
// ============================================

export const AUTOMATION_CONDITION_OPERATORS = {
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  EMPTY: 'empty',
  NOT_EMPTY: 'not_empty',
  BEFORE: 'before',
  AFTER: 'after',
} as const;

// ============================================
// AUTOMATION ACTION TYPES
// ============================================

export const AUTOMATION_ACTION_TYPES = {
  CREATE_TASK: 'create_task',
  UPDATE_LEAD: 'update_lead',
  UPDATE_DEAL: 'update_deal',
  CHANGE_STATUS: 'change_status',
  ASSIGN_USER: 'assign_user',
  CREATE_FOLLOWUP: 'create_followup',
  SEND_WHATSAPP: 'send_whatsapp',
  SEND_EMAIL: 'send_email',
  SEND_SMS: 'send_sms',
  CREATE_NOTIFICATION: 'create_notification',
  DELAY: 'delay',
  WEBHOOK: 'webhook',
  AI_ACTION: 'ai_action',
} as const;

// ============================================
// AUTOMATION EXECUTION STATUSES
// ============================================

export const AUTOMATION_EXECUTION_STATUSES = {
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

// ============================================
// AUTOMATION LOG LEVELS
// ============================================

export const AUTOMATION_LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
} as const;

// ============================================
// TEMPLATE VARIABLES
// ============================================

export const TEMPLATE_VARIABLES = [
  'name',
  'company',
  'agent',
  'deal_value',
  'lead_name',
  'contact_name',
  'email',
  'phone',
  'date',
  'time',
  'task_title',
  'deal_name',
  'employee_name',
  'department',
  'leave_type',
  'leave_dates',
  'expense_amount',
] as const;
