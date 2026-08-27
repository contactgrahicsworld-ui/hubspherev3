import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthorizationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    const roles = await db.role.findMany({
      where: { tenantId: null },
      include: {
        permissions: {
          include: {
            permission: {
              select: { id: true, code: true, name: true, module: true, action: true },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const permissions = await db.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    const data = roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map((rp) => rp.permission.code),
      createdAt: r.createdAt,
    }));

    return NextResponse.json(
      success({
        roles: data,
        permissions: permissions.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          module: p.module,
          action: p.action,
        })),
      })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
