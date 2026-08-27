import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRefreshToken } from '@/lib/auth';
import { forgotPasswordSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = validate(forgotPasswordSchema, body);

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AuthenticationError('If an account with this email exists, a reset token has been created');
    }

    // Generate a random token for password reset
    const token = await generateRefreshToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Audit log
    await createAuditLog({
      actorId: user.id,
      action: 'auth.forgot_password',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    // Phase 1: No email sending. Just return success.
    // In production, you would send an email with the reset link.
    return NextResponse.json(
      success({
        message: 'If an account with this email exists, a reset token has been created',
        token, // Only returned in Phase 1 for testing
      }, 'Password reset token created')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
