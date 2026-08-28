import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { resetPasswordSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = validate(resetPasswordSchema, body);

    // Find the reset token
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new ValidationError('Invalid reset token');
    }

    if (resetToken.usedAt) {
      throw new ValidationError('This reset token has already been used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new ValidationError('This reset token has expired');
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user password and mark token as used (in a transaction)
    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all refresh tokens for security
      db.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    // Audit log
    await createAuditLog({
      actorId: resetToken.userId,
      action: 'auth.reset_password',
      targetType: 'User',
      targetId: resetToken.userId,
      metadata: { email: resetToken.user.email },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(null, 'Password has been reset successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
