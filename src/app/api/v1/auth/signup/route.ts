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

/**
 * Generate a URL-safe slug from an email or name.
 * Appends a short random suffix to ensure uniqueness.
 */
function generateSlug(base: string): string {
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${slug}-${suffix}`;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 signups per hour per IP
    const { limited, retryAfterMs } = await rateLimit(getClientIp(request) + ':signup', 5, 60 * 60 * 1000);
    if (limited) {
      throw new RateLimitError('Too many signup attempts. Please try again later.', Math.ceil(retryAfterMs / 1000));
    }

    const body = await request.json();
    const { name, email, password, tenantName, inviteToken } = validate(signupSchema, body);

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

    // Check if this is the first user on the platform
    const userCount = await db.user.count();
    const isFirstUser = userCount === 0;

    const passwordHash = await hashPassword(password);

    let tenantId: string | undefined;
    let roleCode: string | undefined;

    // ─── CASE 1: First user on the platform → SUPER_ADMIN ───
    if (isFirstUser) {
      // Ensure system roles exist (needed for FK on membership.roleCode)
      await db.role.createMany({
        data: DEFAULT_ROLES.map(r => ({
          code: r.code, name: r.name, description: r.description, isSystem: true, tenantId: null,
        })),
        skipDuplicates: true,
      });

      // Create the first user as SUPER_ADMIN
      const user = await db.user.create({
        data: {
          email,
          passwordHash,
          name: name || null,
          isSuperAdmin: true,
          status: 'ACTIVE',
        },
      });

      // Create a default tenant for the first user
      const effectiveTenantName = tenantName || `${name || email.split('@')[0]}'s Organization`;
      const tenant = await db.tenant.create({
        data: {
          name: effectiveTenantName,
          slug: generateSlug(email.split('@')[0]),
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

      // Create a FREE subscription with 14-day trial for the new tenant
      await db.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: 'FREE',
          status: 'TRIALING',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

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
        metadata: { email: user.email, isSuperAdmin: true, tenantName: effectiveTenantName },
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
    }

    // ─── CASE 2: Invite token provided → join existing tenant ───
    if (inviteToken) {
      // Look up the pending membership by invite token (membership ID acting as token)
      const pendingMembership = await db.membership.findUnique({
        where: { id: inviteToken },
        include: { tenant: true },
      });

      if (!pendingMembership || pendingMembership.status !== 'PENDING' || pendingMembership.tenant.status !== 'ACTIVE') {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired invite token', code: 'INVALID_INVITE' },
          { status: 400 }
        );
      }

      // Create the user (NOT super admin)
      const user = await db.user.create({
        data: {
          email,
          passwordHash,
          name: name || null,
          status: 'ACTIVE',
        },
      });

      // Activate the pending membership for this user
      await db.membership.update({
        where: { id: pendingMembership.id },
        data: {
          userId: user.id,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });

      tenantId = pendingMembership.tenantId;
      roleCode = pendingMembership.roleCode ?? 'VIEWER';

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
        metadata: { email: user.email, invitedToTenant: pendingMembership.tenantId, viaInvite: true },
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
    }

    // ─── CASE 3: Normal self-service signup → create own tenant ───
    // Every new customer gets their OWN tenant (true SaaS multi-tenancy)

    // Ensure system roles exist (idempotent)
    await db.role.createMany({
      data: DEFAULT_ROLES.map(r => ({
        code: r.code, name: r.name, description: r.description, isSystem: true, tenantId: null,
      })),
      skipDuplicates: true,
    });

    // Create the user
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        status: 'ACTIVE',
      },
    });

    // Create a NEW tenant for this user
    const effectiveTenantName = tenantName || `${name || email.split('@')[0]}'s Organization`;
    const tenant = await db.tenant.create({
      data: {
        name: effectiveTenantName,
        slug: generateSlug(email.split('@')[0]),
        status: 'ACTIVE',
      },
    });
    tenantId = tenant.id;
    roleCode = 'TENANT_OWNER';

    // Create membership as TENANT_OWNER
    await db.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        roleCode: 'TENANT_OWNER',
        status: 'ACTIVE',
      },
    });

    // Create a FREE subscription with 14-day trial for the new tenant
    await db.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: 'FREE',
        status: 'TRIALING',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

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
      metadata: { email: user.email, tenantName: effectiveTenantName },
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
