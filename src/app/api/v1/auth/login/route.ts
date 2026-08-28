import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { loginSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { setAuthCookies } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = validate(loginSchema, body);

    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            tenant: {
              select: { id: true, name: true, status: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check user status
    if (user.status === 'SUSPENDED') {
      throw new AuthenticationError('Account has been suspended');
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Resolve tenant context from first active membership
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
        role: roleCode ?? null,
        accessToken,
        refreshToken,
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
