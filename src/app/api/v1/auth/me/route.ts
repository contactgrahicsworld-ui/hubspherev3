import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { getUserPermissions } from '@/lib/rbac';

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
      return NextResponse.json(
        { success: false, error: 'User not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Resolve current tenant context
    let currentTenant: Record<string, unknown> | null = null;
    if (payload.tenantId) {
      const membership = user.memberships.find(
        (m) => m.tenantId === payload.tenantId
      );
      if (membership) {
        currentTenant = {
          ...membership.tenant,
          role: membership.roleCode,
        };
      }
    } else if (user.memberships.length > 0) {
      currentTenant = {
        ...user.memberships[0].tenant,
        role: user.memberships[0].roleCode,
      };
    }

    // Get permissions
    const permissions = await getUserPermissions(
      payload.roleCode ?? null,
      payload.tenantId
    );

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
        },
        currentTenant,
        permissions,
      })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
