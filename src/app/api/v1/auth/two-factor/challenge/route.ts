import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, ValidationError, RateLimitError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { verify2FADuringLogin } from '@/lib/two-factor';
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { setAuthCookies } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { z } from 'zod';

const challengeSchema = z.object({
  userId: z.string().uuid(),
  code: z.string().min(1, 'Code is required'),
});

/**
 * POST /api/v1/auth/two-factor/challenge
 * Complete 2FA challenge after login. Issues tokens if code is valid.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit 2FA attempts
    const { limited, retryAfterMs } = await rateLimit(getClientIp(request) + ':2fa', 20, 15 * 60 * 1000);
    if (limited) {
      throw new RateLimitError('Too many 2FA attempts. Please try again later.', Math.ceil(retryAfterMs / 1000));
    }

    const body = await request.json();
    const { userId, code } = challengeSchema.parse(body);

    // Verify 2FA code (TOTP or recovery code)
    const { verified, usedRecoveryCode } = await verify2FADuringLogin(userId, code);
    if (!verified) {
      throw new AuthenticationError('Invalid 2FA code');
    }

    // Look up user with memberships
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { tenant: { select: { id: true, name: true, status: true } } },
        },
      },
    });

    if (!user) throw new AuthenticationError('User not found');

    const membership = user.memberships[0];
    const tenantId = membership?.tenantId;
    const roleCode = membership?.roleCode;

    // Generate tokens
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      tenantId: tenantId ?? undefined,
      roleCode: roleCode ?? undefined,
    });

    const refreshToken = await generateRefreshToken();
    await db.refreshToken.create({
      data: { token: refreshToken, userId: user.id, tenantId, expiresAt: getRefreshTokenExpiry() },
    });

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    await createAuditLog({
      actorId: user.id,
      tenantId: tenantId ?? undefined,
      action: usedRecoveryCode ? 'auth.login_recovery_code' : 'auth.login_2fa',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    const response = NextResponse.json(
      success({
        user: { id: user.id, email: user.email, name: user.name, isSuperAdmin: user.isSuperAdmin, status: user.status, avatarUrl: user.avatarUrl },
        tenant: membership ? { id: membership.tenant.id, name: membership.tenant.name, status: membership.tenant.status } : null,
        role: roleCode ?? null,
        accessToken,
      }),
      { status: 200 }
    );

    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
