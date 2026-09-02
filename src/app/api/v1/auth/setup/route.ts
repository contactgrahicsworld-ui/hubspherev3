import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { signupSchema, validate } from '@/lib/validators';
import { handleApiError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { setAuthCookies } from '@/lib/api-auth';
// Seed is now called from the setup page frontend after user creation,
// to avoid Vercel function timeout during the setup transaction.

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
    const { name, email, password } = validate(signupSchema, body);

    // Hash password
    const passwordHash = await hashPassword(password);

    // Note: Permissions and roles are seeded by the frontend
    // calling /api/v1/system/seed after setup completes.

    // Create super admin + tenant + membership in a transaction
    const result = await db.$transaction(async (tx) => {
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
