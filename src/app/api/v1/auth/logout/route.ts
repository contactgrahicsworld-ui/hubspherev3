import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { getAuthUser, clearAuthCookies } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    // Revoke the refresh token from cookie if present
    const refreshTokenValue = request.cookies.get('hs-refresh-token')?.value;
    if (refreshTokenValue) {
      await db.refreshToken.updateMany({
        where: {
          token: refreshTokenValue,
          userId: payload.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    // Audit log
    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'auth.logout',
      targetType: 'User',
      targetId: payload.userId,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    const response = NextResponse.json(success(null, 'Logged out successfully'));
    clearAuthCookies(response);
    return response;
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
