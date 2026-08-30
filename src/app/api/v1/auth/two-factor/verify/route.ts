import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError, ValidationError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { verifyTOTP, enable2FA, generateTOTPSecret, generateRecoveryCodes, generateTOTPUri, requires2FA } from '@/lib/two-factor';
import { z } from 'zod';

const verifySchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be numeric'),
  secret: z.string().min(1, 'Secret is required'),
  recoveryCodes: z.array(z.string()).length(10, 'Exactly 10 recovery codes required').optional(),
});

/**
 * POST /api/v1/auth/two-factor/verify
 * Step 2: Verify a TOTP code to confirm enrollment and activate 2FA.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    const body = await request.json();
    const { code, secret, recoveryCodes } = verifySchema.parse(body);

    // Verify the TOTP code
    const valid = await verifyTOTP(secret, code);
    if (!valid) {
      throw new ValidationError('Invalid verification code. Please try again.');
    }

    // Activate 2FA
    const codes = recoveryCodes || generateRecoveryCodes();
    await enable2FA(payload.userId, secret, codes);

    // Audit log
    const { createAuditLog } = await import('@/lib/audit');
    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'auth.2fa_enabled',
      targetType: 'User',
      targetId: payload.userId,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success({
      enabled: true,
      recoveryCodes: codes,
      message: 'Two-factor authentication has been enabled. Save your recovery codes securely.',
    }));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
