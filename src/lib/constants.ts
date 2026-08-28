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
  'attendance',
  'payroll',
  'automation',
  'ai',
  'subscriptions',
  'features',
  'settings',
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
