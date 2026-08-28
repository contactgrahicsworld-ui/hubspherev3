import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { signupSchema, validate } from '@/lib/validators';
import { handleApiError, ConflictError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { setAuthCookies } from '@/lib/api-auth';
import { runSeed } from '@/lib/seed';

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

    // Seed permissions and roles first
    const seedResults = await runSeed();

    // Create the super admin user
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name: name || 'Super Admin',
        isSuperAdmin: true,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });

    // Create SUPER_ADMIN membership (no tenant needed for platform-level role)
    // The super admin has platform-level access via isSuperAdmin flag
    // but we still create a membership for consistency

    // Generate tokens
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      isSuperAdmin: true,
      roleCode: 'SUPER_ADMIN',
    });

    const refreshToken = await generateRefreshToken();
    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    // Audit log
    await createAuditLog({
      actorId: user.id,
      action: 'auth.setup',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email, seedResults },
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
