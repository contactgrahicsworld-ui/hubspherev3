import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { generateTOTPSecret, generateTOTPUri, generateRecoveryCodes } from '@/lib/two-factor';

/**
 * POST /api/v1/auth/two-factor/setup
 * Step 1: Generate TOTP secret and recovery codes for enrollment.
 * Returns the secret URI (for QR code) and recovery codes.
 * The user must then verify a code before 2FA is activated.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    // Generate new TOTP secret
    const secret = await generateTOTPSecret();
    const uri = generateTOTPUri(payload.email, secret);
    const recoveryCodes = generateRecoveryCodes();

    // Store the pending secret in a temporary 2FA setup record
    // (In production, use a separate TwoFactorSetup table or encrypted session)
    // For now, return the secret for the client to confirm
    return NextResponse.json(success({
      secret,
      uri,
      recoveryCodes,
      message: 'Scan the QR code with your authenticator app, then verify a code to activate 2FA.',
    }));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
