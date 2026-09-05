/**
 * Plan definitions and limits for HubSphere V3.
 * Each plan defines feature availability, seat limits, and storage quotas.
 */

export type PlanCode = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  price: number; // Monthly price in USD
  yearlyPrice: number; // Yearly price in USD (with discount)
  maxUsers: number; // -1 = unlimited
  maxStorage: number; // In MB, -1 = unlimited
  trialDays: number;
  features: {
    crm: boolean;
    hrms: boolean;
    ai: boolean;
    automation: boolean;
    communication: boolean;
    analytics: boolean;
    customRoles: boolean;
    api: boolean;
    sso: boolean;
    auditLog: boolean;
    fileUpload: boolean;
    exportData: boolean;
    whiteLabel: boolean;
    prioritySupport: boolean;
  };
}

export const PLANS: Record<PlanCode, PlanDefinition> = {
  FREE: {
    code: 'FREE',
    name: 'Free',
    price: 0,
    yearlyPrice: 0,
    maxUsers: 3,
    maxStorage: 100, // 100MB
    trialDays: 14,
    features: {
      crm: true,
      hrms: false,
      ai: false,
      automation: false,
      communication: false,
      analytics: false,
      customRoles: false,
      api: false,
      sso: false,
      auditLog: false,
      fileUpload: false,
      exportData: false,
      whiteLabel: false,
      prioritySupport: false,
    },
  },
  STARTER: {
    code: 'STARTER',
    name: 'Starter',
    price: 29,
    yearlyPrice: 290,
    maxUsers: 10,
    maxStorage: 1024, // 1GB
    trialDays: 14,
    features: {
      crm: true,
      hrms: true,
      ai: false,
      automation: false,
      communication: true,
      analytics: true,
      customRoles: false,
      api: false,
      sso: false,
      auditLog: true,
      fileUpload: true,
      exportData: true,
      whiteLabel: false,
      prioritySupport: false,
    },
  },
  PRO: {
    code: 'PRO',
    name: 'Pro',
    price: 79,
    yearlyPrice: 790,
    maxUsers: 50,
    maxStorage: 10240, // 10GB
    trialDays: 14,
    features: {
      crm: true,
      hrms: true,
      ai: true,
      automation: true,
      communication: true,
      analytics: true,
      customRoles: true,
      api: true,
      sso: false,
      auditLog: true,
      fileUpload: true,
      exportData: true,
      whiteLabel: false,
      prioritySupport: true,
    },
  },
  ENTERPRISE: {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    price: 199,
    yearlyPrice: 1990,
    maxUsers: -1, // unlimited
    maxStorage: -1, // unlimited
    trialDays: 30,
    features: {
      crm: true,
      hrms: true,
      ai: true,
      automation: true,
      communication: true,
      analytics: true,
      customRoles: true,
      api: true,
      sso: true,
      auditLog: true,
      fileUpload: true,
      exportData: true,
      whiteLabel: true,
      prioritySupport: true,
    },
  },
};

export const PLAN_HIERARCHY: PlanCode[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

/**
 * Get a plan definition by code.
 */
export function getPlan(code: string): PlanDefinition {
  return PLANS[(code as PlanCode) ?? 'FREE'] ?? PLANS.FREE;
}

/**
 * Check if a feature is enabled for a given plan.
 */
export function isFeatureInPlan(planCode: string, feature: keyof PlanDefinition['features']): boolean {
  const plan = getPlan(planCode);
  return plan.features[feature] ?? false;
}

/**
 * Check if a plan allows a given number of users.
 */
export function isWithinSeatLimit(planCode: string, currentUsers: number): boolean {
  const plan = getPlan(planCode);
  if (plan.maxUsers === -1) return true; // unlimited
  return currentUsers <= plan.maxUsers;
}

/**
 * Get the next plan up from the current plan.
 */
export function getNextPlan(currentPlan: PlanCode): PlanDefinition | null {
  const idx = PLAN_HIERARCHY.indexOf(currentPlan);
  if (idx === -1 || idx === PLAN_HIERARCHY.length - 1) return null;
  return PLANS[PLAN_HIERARCHY[idx + 1]];
}

/**
 * Check if plan A is >= plan B in the hierarchy.
 */
export function isPlanAtLeast(planA: string, planB: PlanCode): boolean {
  const idxA = PLAN_HIERARCHY.indexOf(planA as PlanCode);
  const idxB = PLAN_HIERARCHY.indexOf(planB);
  return idxA >= idxB;
}
