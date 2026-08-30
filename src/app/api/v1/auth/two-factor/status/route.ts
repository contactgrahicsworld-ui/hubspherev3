import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { get2FAStatus, requires2FA } from '@/lib/two-factor';

/**
 * GET /api/v1/auth/two-factor/status
 * Get 2FA status for the current user.
 * Never exposes the TOTP secret.
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    const status = await get2FAStatus(payload.userId);
    const required = requires2FA(payload.roleCode);

    return NextResponse.json(success({
      enabled: status.enabled,
      recoveryCodesRemaining: status.recoveryCodesRemaining,
      required,
    }));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
