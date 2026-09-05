import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getBillingStatus, changePlan, cancelSubscription } from '@/lib/billing';
import { requirePermission } from '@/lib/rbac';
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

    return NextResponse.json(success(billingStatus));
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

    return NextResponse.json(success(result));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
