import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError, ValidationError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { disable2FA } from '@/lib/two-factor';
import { z } from 'zod';

const disableSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
});

/**
 * POST /api/v1/auth/two-factor/disable
 * Disable 2FA. Requires current password confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    const body = await request.json();
    const { currentPassword } = disableSchema.parse(body);

    // Verify current password
    const { db } = await import('@/lib/db');
    const { verifyPassword } = await import('@/lib/auth');
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { passwordHash: true, twoFactorEnabled: true },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new ValidationError('Two-factor authentication is not enabled');
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      throw new ValidationError('Current password is incorrect');
    }

    await disable2FA(payload.userId);

    // Audit log
    const { createAuditLog } = await import('@/lib/audit');
    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'auth.2fa_disabled',
      targetType: 'User',
      targetId: payload.userId,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success({ enabled: false }, 'Two-factor authentication has been disabled'));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
