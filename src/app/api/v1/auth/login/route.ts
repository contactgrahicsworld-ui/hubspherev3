import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseConnected } from '@/lib/db';
import { verifyPassword, generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { loginSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, RateLimitError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { setAuthCookies } from '@/lib/api-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { verify2FADuringLogin, requires2FA } from '@/lib/two-factor';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 login attempts per 15 minutes per IP (async DB-backed)
    const { limited, retryAfterMs } = await rateLimit(getClientIp(request) + ':login', 10, 15 * 60 * 1000);
    if (limited) {
      throw new RateLimitError('Too many login attempts. Please try again later.', Math.ceil(retryAfterMs / 1000));
    }

    // Check database availability first
    const dbConnected = await isDatabaseConnected();
    if (!dbConnected) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Database is not available. Please ensure PostgreSQL is running and configured.',
            code: 'DATABASE_UNAVAILABLE',
          },
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { email, password } = validate(loginSchema, body);

    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true, email: true, name: true, isSuperAdmin: true, status: true,
        avatarUrl: true, passwordHash: true, twoFactorEnabled: true,
        memberships: {
          where: { status: 'ACTIVE' },
          include: { tenant: { select: { id: true, name: true, status: true } } },
        },
      },
    });

    if (!user) {
      try { logger.security('auth_failure', { module: 'auth', email, reason: 'user_not_found' }); } catch (e) { console.error('[Logger fallback]', e) }
      throw new AuthenticationError('Invalid email or password');
    }

    // Check user status
    if (user.status === 'SUSPENDED') {
      try { logger.security('auth_failure', { module: 'auth', email, userId: user.id, reason: 'account_suspended' }); } catch (e) { console.error('[Logger fallback]', e) }
      throw new AuthenticationError('Account has been suspended');
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      try { logger.security('auth_failure', { module: 'auth', email, userId: user.id, reason: 'invalid_password' }); } catch (e) { console.error('[Logger fallback]', e) }
      throw new AuthenticationError('Invalid email or password');
    }

    // Resolve tenant context from first active membership
    const membership = user.memberships[0];
    const tenantId = membership?.tenantId;
    const roleCode = membership?.roleCode;

    // 2FA check for privileged accounts
    if (user.twoFactorEnabled) {
      // Return a 2FA challenge instead of tokens
      return NextResponse.json(
        success({
          twoFactorRequired: true,
          userId: user.id,
          message: 'Two-factor authentication required',
        }, 'Enter your 2FA code'),
        { status: 200 }
      );
    }

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
      data: {
        token: refreshToken,
        userId: user.id,
        tenantId,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Audit log
    await createAuditLog({
      actorId: user.id,
      tenantId: tenantId ?? undefined,
      action: 'auth.login',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    const response = NextResponse.json(
      success({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin,
          status: user.status,
          avatarUrl: user.avatarUrl,
        },
        tenant: membership
          ? { id: membership.tenant.id, name: membership.tenant.name, status: membership.tenant.status }
          : null,
        role: user.isSuperAdmin ? 'SUPER_ADMIN' : (roleCode ?? null),
        accessToken,
        refreshToken,
      }),
      { status: 200 }
    );

    setAuthCookies(response, accessToken, refreshToken);
    try { logger.info('User login', { module: 'auth', userId: user.id, email: user.email, tenantId, roleCode }); } catch (e) { console.error('[Logger fallback]', e) }
    return response;
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
