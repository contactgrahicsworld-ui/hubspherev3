import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { changePasswordSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { getAuthUser } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    const body = await request.json();
    const { currentPassword, newPassword } = validate(changePasswordSchema, body);

    // Get user with password hash
    const user = await db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Verify current password
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      throw new ValidationError('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and revoke all refresh tokens (in a transaction)
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
      db.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    // Audit log
    await createAuditLog({
      actorId: user.id,
      tenantId: payload.tenantId,
      action: 'auth.change_password',
      targetType: 'User',
      targetId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(null, 'Password changed successfully. Please log in again.')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
