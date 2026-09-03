import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { setupSchema, validate } from '@/lib/validators';
import { handleApiError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { setAuthCookies } from '@/lib/api-auth';
import { DEFAULT_ROLES } from '@/lib/constants';
import { runSeed } from '@/lib/seed';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Check if a super admin already exists
    const existingSuperAdmin = await db.user.findFirst({
      where: { isSuperAdmin: true },
    });

    if (existingSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Setup has already been completed', code: 'SETUP_DONE' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, password } = validate(setupSchema, body);

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create super admin + tenant + roles + membership in a transaction
    const result = await db.$transaction(async (tx) => {
      // Ensure system roles exist (needed for FK on membership.roleCode)
      await tx.role.createMany({
        data: DEFAULT_ROLES.map(r => ({
          code: r.code,
          name: r.name,
          description: r.description,
          isSystem: true,
          tenantId: null,
        })),
        skipDuplicates: true,
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: name || 'Super Admin',
          isSuperAdmin: true,
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      const defaultTenant = await tx.tenant.create({
        data: {
          name: 'HubSphere Enterprise',
          slug: 'hubsphere-enterprise',
          status: 'ACTIVE',
          plan: 'ENTERPRISE',
          maxUsers: 1000,
          settings: {},
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          tenantId: defaultTenant.id,
          roleCode: 'TENANT_OWNER',
          status: 'ACTIVE',
        },
      });

      return { user, tenant: defaultTenant };
    });

    const { user, tenant } = result;

    // Generate tokens
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      isSuperAdmin: true,
      tenantId: tenant.id,
      roleCode: 'SUPER_ADMIN',
    });

    const refreshToken = await generateRefreshToken();
    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        tenantId: tenant.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    // Audit log
    await createAuditLog({
      actorId: user.id,
      tenantId: tenant.id,
      action: 'auth.setup',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    // Seed permissions & role assignments (optimized raw SQL, runs in < 3s)
    try {
      await runSeed();
    } catch {
      // Non-blocking: seed failure shouldn't break setup
    }

    const response = NextResponse.json(
      success({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin,
          status: user.status,
        },
        role: 'SUPER_ADMIN',
        accessToken,
        refreshToken,
      }, 'Setup completed successfully'),
      { status: 201 }
    );

    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
