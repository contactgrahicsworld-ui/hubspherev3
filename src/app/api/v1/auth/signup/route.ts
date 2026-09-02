import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { signupSchema, validate } from '@/lib/validators';
import { handleApiError, RateLimitError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { setAuthCookies } from '@/lib/api-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { DEFAULT_ROLES } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 signups per hour per IP
    const { limited, retryAfterMs } = await rateLimit(getClientIp(request) + ':signup', 5, 60 * 60 * 1000);
    if (limited) {
      throw new RateLimitError('Too many signup attempts. Please try again later.', Math.ceil(retryAfterMs / 1000));
    }

    const body = await request.json();
    const { name, email, password } = validate(signupSchema, body);

    // Check if email is already taken
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists', code: 'CONFLICT' },
        { status: 409 }
      );
    }

    // Check if this is the first user (they get a default tenant)
    const userCount = await db.user.count();
    const isFirstUser = userCount === 0;

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        status: 'ACTIVE',
      },
    });

    let tenantId: string | undefined;
    let roleCode: string | undefined;

    if (isFirstUser) {
      // Ensure system roles exist (needed for FK on membership.roleCode)
      await db.role.createMany({
        data: DEFAULT_ROLES.map(r => ({
          code: r.code, name: r.name, description: r.description, isSystem: true, tenantId: null,
        })),
        skipDuplicates: true,
      });

      // Create a default tenant for the first user
      const tenant = await db.tenant.create({
        data: {
          name: `${name || email.split('@')[0]}'s Organization`,
          slug: email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
          status: 'ACTIVE',
        },
      });
      tenantId = tenant.id;
      roleCode = 'TENANT_OWNER';

      await db.membership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleCode: 'TENANT_OWNER',
          status: 'ACTIVE',
        },
      });
    }

    // Generate tokens
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      tenantId,
      roleCode,
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

    // Audit log
    await createAuditLog({
      actorId: user.id,
      tenantId,
      action: 'auth.signup',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    const response = NextResponse.json(
      success(
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isSuperAdmin: user.isSuperAdmin,
            status: user.status,
          },
          role: roleCode ?? null,
          accessToken,
          refreshToken,
        },
        'Account created successfully'
      ),
      { status: 201 }
    );

    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
