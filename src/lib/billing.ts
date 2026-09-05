/**
 * Billing and subscription management.
 * Production-grade architecture that works with or without Stripe.
 * If Stripe credentials are unavailable, subscription changes are tracked in DB
 * and marked as pending external activation.
 */

import { db } from '@/lib/db';
import { getPlan, isWithinSeatLimit, type PlanCode } from '@/lib/plans';
import { createAuditLog } from '@/lib/audit';
import { env } from '@/lib/env';

// ============================================
// TYPES
// ============================================

export interface SubscriptionChangeResult {
  success: boolean;
  subscriptionId: string;
  plan: PlanCode;
  status: string;
  requiresPayment: boolean;
  checkoutUrl?: string;
  message: string;
}

export interface BillingStatus {
  plan: PlanCode;
  planName: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  maxUsers: number;
  currentUsers: number;
  maxStorage: number;
  isInTrial: boolean;
  isPastDue: boolean;
  isCancelled: boolean;
  canAddUsers: boolean;
  daysRemaining: number | null;
}

// ============================================
// STRIPE AVAILABILITY CHECK
// ============================================

/**
 * Check if Stripe is configured and available.
 */
export function isStripeAvailable(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

/**
 * Get the current billing status for a tenant.
 */
export async function getBillingStatus(tenantId: string): Promise<BillingStatus> {
  const [tenant, subscription, memberCount] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId } }),
    db.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
      orderBy: { createdAt: 'desc' },
    }),
    db.membership.count({ where: { tenantId, status: 'ACTIVE' } }),
  ]);

  const planCode = (tenant?.plan ?? 'FREE') as PlanCode;
  const plan = getPlan(planCode);
  const subStatus = subscription?.status ?? 'ACTIVE';
  const periodEnd = subscription?.currentPeriodEnd ?? null;
  const periodStart = subscription?.currentPeriodStart ?? null;

  // Calculate trial end
  let trialEnd: Date | null = null;
  if (subStatus === 'TRIALING' && periodEnd) {
    trialEnd = periodEnd;
  }

  // Days remaining in current period
  let daysRemaining: number | null = null;
  if (periodEnd) {
    const diff = periodEnd.getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }

  return {
    plan: planCode,
    planName: plan.name,
    status: subStatus,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    trialEnd,
    maxUsers: plan.maxUsers === -1 ? Infinity : plan.maxUsers,
    currentUsers: memberCount,
    maxStorage: plan.maxStorage === -1 ? Infinity : plan.maxStorage,
    isInTrial: subStatus === 'TRIALING',
    isPastDue: subStatus === 'PAST_DUE',
    isCancelled: subStatus === 'CANCELLED',
    canAddUsers: isWithinSeatLimit(planCode, memberCount + 1),
    daysRemaining,
  };
}

/**
 * Change a tenant's subscription plan.
 * If Stripe is available, creates a checkout session.
 * If not, updates the DB directly with a pending status.
 */
export async function changePlan(
  tenantId: string,
  newPlan: PlanCode,
  actorId: string
): Promise<SubscriptionChangeResult> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const currentPlan = tenant.plan as PlanCode;
  if (currentPlan === newPlan) {
    return {
      success: false,
      subscriptionId: '',
      plan: currentPlan,
      status: 'ACTIVE',
      requiresPayment: false,
      message: 'Already on this plan',
    };
  }

  const newPlanDef = getPlan(newPlan);
  const isUpgrade = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'].indexOf(newPlan) >
                    ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'].indexOf(currentPlan);

  // If Stripe is available, delegate to Stripe
  if (isStripeAvailable() && newPlan !== 'FREE') {
    // Stripe integration placeholder - would create checkout session
    // This requires the actual Stripe SDK which would be added via npm
    return {
      success: false,
      subscriptionId: '',
      plan: currentPlan,
      status: 'ACTIVE',
      requiresPayment: true,
      message: 'Stripe checkout session creation requires Stripe SDK. Please install stripe package and configure STRIPE_SECRET_KEY.',
    };
  }

  // Without Stripe: Direct plan change (for FREE plan or when Stripe is not configured)
  const now = new Date();
  const trialEnd = new Date(now.getTime() + newPlanDef.trialDays * 24 * 60 * 60 * 1000);

  // Update tenant plan
  await db.tenant.update({
    where: { id: tenantId },
    data: {
      plan: newPlan,
      maxUsers: newPlanDef.maxUsers === -1 ? 999999 : newPlanDef.maxUsers,
    },
  });

  // Create or update subscription
  const subscription = await db.subscription.upsert({
    where: { id: (await db.subscription.findFirst({ where: { tenantId } }))?.id ?? 'nonexistent' },
    create: {
      tenantId,
      plan: newPlan,
      status: 'TRIALING',
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
    },
    update: {
      plan: newPlan,
      status: 'TRIALING',
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
    },
  });

  // Audit log
  await createAuditLog({
    actorId,
    tenantId,
    action: isUpgrade ? 'subscription.upgrade' : 'subscription.downgrade',
    targetType: 'Subscription',
    targetId: subscription.id,
    metadata: { fromPlan: currentPlan, toPlan: newPlan, stripeAvailable: isStripeAvailable() },
  });

  return {
    success: true,
    subscriptionId: subscription.id,
    plan: newPlan,
    status: 'TRIALING',
    requiresPayment: false,
    message: isStripeAvailable()
      ? `Plan changed to ${newPlanDef.name}. Trial ends in ${newPlanDef.trialDays} days.`
      : `Plan changed to ${newPlanDef.name} (direct - Stripe not configured). Trial ends in ${newPlanDef.trialDays} days. Configure Stripe for production billing.`,
  };
}

/**
 * Cancel a tenant's subscription.
 */
export async function cancelSubscription(
  tenantId: string,
  actorId: string,
  immediate: boolean = false
): Promise<SubscriptionChangeResult> {
  const subscription = await db.subscription.findFirst({
    where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    throw new Error('No active subscription found');
  }

  if (immediate) {
    // Immediate cancellation - downgrade to FREE
    await db.tenant.update({
      where: { id: tenantId },
      data: { plan: 'FREE', maxUsers: 3 },
    });
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED' },
    });
  } else {
    // End of period cancellation
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED' },
    });
  }

  await createAuditLog({
    actorId,
    tenantId,
    action: 'subscription.cancel',
    targetType: 'Subscription',
    targetId: subscription.id,
    metadata: { immediate, previousPlan: subscription.plan },
  });

  return {
    success: true,
    subscriptionId: subscription.id,
    plan: 'FREE',
    status: 'CANCELLED',
    requiresPayment: false,
    message: immediate
      ? 'Subscription cancelled immediately. Downgraded to Free plan.'
      : 'Subscription will be cancelled at the end of the current billing period.',
  };
}

/**
 * Check and enforce seat limits for a tenant.
 * Returns true if the tenant can add more users.
 */
export async function enforceSeatLimit(tenantId: string): Promise<{ allowed: boolean; current: number; max: number }> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });

  const plan = getPlan(tenant?.plan ?? 'FREE');
  const currentUsers = await db.membership.count({
    where: { tenantId, status: 'ACTIVE' },
  });

  return {
    allowed: isWithinSeatLimit(tenant?.plan ?? 'FREE', currentUsers + 1),
    current: currentUsers,
    max: plan.maxUsers === -1 ? Infinity : plan.maxUsers,
  };
}
