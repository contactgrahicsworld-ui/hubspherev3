import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError } from '@/lib/errors';
import { success, cache } from '@/lib/api-response';
import { getBillingStatus, changePlan, cancelSubscription } from '@/lib/billing';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

/**
 * GET /api/v1/billing/subscription - Get current billing status
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'No tenant context' },
        { status: 400 }
      );
    }

    await requirePermission(auth.roleCode ?? null, 'subscriptions.view', auth.tenantId, auth.isSuperAdmin);

    const billingStatus = await getBillingStatus(auth.tenantId);

    return NextResponse.json(success(billingStatus), {
      headers: cache.private300,
    });
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

const changePlanSchema = z.object({
  plan: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']),
});

/**
 * PUT /api/v1/billing/subscription - Change plan
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'No tenant context' },
        { status: 400 }
      );
    }

    await requirePermission(auth.roleCode ?? null, 'subscriptions.manage', auth.tenantId, auth.isSuperAdmin);

    const body = await request.json();
    const { plan } = changePlanSchema.parse(body);

    const result = await changePlan(auth.tenantId, plan, auth.userId);

    await createAuditLog({
      actorId: auth.userId,
      tenantId: auth.tenantId,
      action: 'billing.change_plan',
      targetType: 'Subscription',
      targetId: auth.tenantId,
      metadata: { newPlan: plan },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(result));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * DELETE /api/v1/billing/subscription - Cancel subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'No tenant context' },
        { status: 400 }
      );
    }

    await requirePermission(auth.roleCode ?? null, 'subscriptions.manage', auth.tenantId, auth.isSuperAdmin);

    const result = await cancelSubscription(auth.tenantId, auth.userId);

    await createAuditLog({
      actorId: auth.userId,
      tenantId: auth.tenantId,
      action: 'billing.cancel_subscription',
      targetType: 'Subscription',
      targetId: auth.tenantId,
      metadata: { cancelledBy: auth.userId },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(result));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
