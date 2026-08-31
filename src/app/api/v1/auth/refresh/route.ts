import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { setAuthCookies } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    let incomingToken: string | undefined;
    try {
      const body = await request.json();
      const parsed = z.object({ refreshToken: z.string().optional() }).safeParse(body);
      if (parsed.success) {
        incomingToken = parsed.data.refreshToken;
      }
    } catch {
      // No body or invalid JSON — will try cookie-only refresh
    }

    // Accept token from body or cookie
    const tokenValue = incomingToken || request.cookies.get('hs-refresh-token')?.value;

    if (!tokenValue) {
      throw new AuthenticationError('Refresh token is required');
    }

    // Find the refresh token
    const storedToken = await db.refreshToken.findUnique({
      where: { token: tokenValue },
      include: { user: true },
    });

    if (!storedToken) {
      throw new AuthenticationError('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      throw new AuthenticationError('Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new AuthenticationError('Refresh token has expired');
    }

    if (storedToken.user.status === 'SUSPENDED') {
      throw new AuthenticationError('Account has been suspended');
    }

    // Resolve tenant context
    let tenantId = storedToken.tenantId;
    let roleCode: string | undefined;

    if (tenantId) {
      const membership = await db.membership.findFirst({
        where: {
          userId: storedToken.userId,
          tenantId,
          status: 'ACTIVE',
        },
      });
      roleCode = membership?.roleCode ?? undefined;
    } else if (storedToken.user.isSuperAdmin) {
      roleCode = 'SUPER_ADMIN';
    }

    // Generate new tokens
    const accessToken = await generateAccessToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      isSuperAdmin: storedToken.user.isSuperAdmin,
      tenantId: tenantId ?? undefined,
      roleCode,
    });

    const newRefreshToken = await generateRefreshToken();

    // Atomic: revoke old + create new in a transaction to prevent token replay
    await db.$transaction([
      db.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      }),
      db.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: storedToken.user.id,
          tenantId,
          expiresAt: getRefreshTokenExpiry(),
        },
      }),
    ]);

    const response = NextResponse.json(
      success({ accessToken }, 'Token refreshed successfully')
    );

    setAuthCookies(response, accessToken, newRefreshToken);
    return response;
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
