/**
 * Feature flag runtime enforcement.
 * Checks both plan-level features AND per-tenant feature flag overrides.
 */

import { db } from '@/lib/db';
import { getPlan, isFeatureInPlan } from '@/lib/plans';

// Feature flag keys that map to plan features
export const FEATURE_FLAG_KEYS = {
  CRM: 'crm',
  HRMS: 'hrms',
  AI: 'ai',
  AUTOMATION: 'automation',
  COMMUNICATION: 'communication',
  ANALYTICS: 'analytics',
  CUSTOM_ROLES: 'custom_roles',
  API: 'api_access',
  SSO: 'sso',
  AUDIT_LOG: 'audit_log',
  FILE_UPLOAD: 'file_upload',
  EXPORT_DATA: 'export_data',
  WHITE_LABEL: 'white_label',
  PRIORITY_SUPPORT: 'priority_support',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];

// Map feature flag keys to plan feature keys
const FLAG_TO_PLAN_FEATURE: Record<string, string> = {
  crm: 'crm',
  hrms: 'hrms',
  ai: 'ai',
  automation: 'automation',
  communication: 'communication',
  analytics: 'analytics',
  custom_roles: 'customRoles',
  api_access: 'api',
  sso: 'sso',
  audit_log: 'auditLog',
  file_upload: 'fileUpload',
  export_data: 'exportData',
  white_label: 'whiteLabel',
  priority_support: 'prioritySupport',
};

/**
 * Check if a feature is enabled for a tenant.
 * Priority: Tenant override > Plan-level default
 *
 * This is the PRIMARY function for feature gating at runtime.
 * Must be called on the SERVER SIDE for enforcement.
 */
export async function isFeatureEnabled(
  flagKey: string,
  tenantId: string,
  planCode?: string
): Promise<boolean> {
  // 1. Check tenant-level override first (highest priority)
  const tenantOverride = await db.tenantFeatureFlag.findFirst({
    where: {
      tenantId,
      featureFlag: { key: flagKey },
    },
    select: { enabled: true },
  });

  if (tenantOverride) {
    return tenantOverride.enabled;
  }

  // 2. Check plan-level feature
  // If planCode is provided, use it; otherwise fetch from tenant
  let plan = planCode;
  if (!plan) {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    plan = tenant?.plan ?? 'FREE';
  }

  const planFeatureKey = FLAG_TO_PLAN_FEATURE[flagKey];
  if (planFeatureKey) {
    return isFeatureInPlan(plan, planFeatureKey as any);
  }

  // 3. Check platform-level default
  const platformFlag = await db.featureFlag.findUnique({
    where: { key: flagKey },
    select: { enabled: true },
  });

  return platformFlag?.enabled ?? false;
}

/**
 * Require a feature to be enabled. Throws an error if disabled.
 */
export async function requireFeature(
  flagKey: string,
  tenantId: string,
  planCode?: string
): Promise<void> {
  const enabled = await isFeatureEnabled(flagKey, tenantId, planCode);
  if (!enabled) {
    throw new Error(`Feature '${flagKey}' is not available on your current plan. Please upgrade to access this feature.`);
  }
}

/**
 * Get all enabled features for a tenant.
 */
export async function getTenantFeatures(
  tenantId: string,
  planCode?: string
): Promise<Record<string, boolean>> {
  let plan = planCode;
  if (!plan) {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    plan = tenant?.plan ?? 'FREE';
  }

  const planDef = getPlan(plan);

  // Get tenant overrides
  const overrides = await db.tenantFeatureFlag.findMany({
    where: { tenantId },
    include: { featureFlag: { select: { key: true } } },
  });

  const result: Record<string, boolean> = {};

  // Start with plan-level features
  for (const [key, value] of Object.entries(FLAG_TO_PLAN_FEATURE)) {
    result[key] = planDef.features[value as keyof typeof planDef.features] ?? false;
  }

  // Apply tenant overrides
  for (const override of overrides) {
    result[override.featureFlag.key] = override.enabled;
  }

  return result;
}
