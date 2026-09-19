import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const patchProfileSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  avatarUrl: z.string().trim().max(1000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isSuperAdmin: true,
        status: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        twoFactorEnabled: true,
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            tenant: {
              select: { id: true, name: true, slug: true, status: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Get active sessions (non-revoked, non-expired refresh tokens)
    const sessions = await db.refreshToken.findMany({
      where: {
        userId: payload.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceType: true,
        deviceInfo: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      success({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          isSuperAdmin: user.isSuperAdmin,
          status: user.status,
          emailVerified: user.emailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          twoFactorEnabled: user.twoFactorEnabled,
        },
        memberships: user.memberships.map((m) => ({
          tenantId: m.tenantId,
          roleCode: m.roleCode,
          tenant: m.tenant,
        })),
        sessions: sessions.map((s) => ({
          id: s.id,
          deviceType: s.deviceType ?? 'WEB',
          deviceInfo: s.deviceInfo ?? 'Unknown',
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
        })),
      })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    const body = await request.json();
    const data = patchProfileSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

    const updated = await db.user.update({
      where: { id: payload.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'user.profile.update',
      targetType: 'User',
      targetId: payload.userId,
      metadata: { updatedFields: Object.keys(updateData) },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(updated, 'Profile updated successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
