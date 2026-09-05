import { NextRequest, NextResponse } from 'next/server';
import { success } from '@/lib/api-response';
import { PLANS, PLAN_HIERARCHY } from '@/lib/plans';

/**
 * GET /api/v1/billing/plans - Get all available plans
 * Public endpoint - no auth required
 */
export async function GET() {
  return NextResponse.json(success({
    plans: PLAN_HIERARCHY.map(code => PLANS[code]),
    currentPlan: null,
  }));
}
