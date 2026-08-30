import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createRoleSchema, paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'roles.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '50',
    });

    // Get platform roles + tenant-specific roles
    const [platformRoles, tenantRoles, total] = await Promise.all([
      db.role.findMany({
        where: { tenantId: null },
        include: {
          permissions: {
            include: { permission: { select: { code: true } } },
          },
        },
        orderBy: { code: 'asc' },
      }),
      db.role.findMany({
        where: { tenantId: payload.tenantId },
        include: {
          permissions: {
            include: { permission: { select: { code: true } } },
          },
        },
        orderBy: { code: 'asc' },
      }),
      db.role.count({
        where: {
          OR: [
            { tenantId: null },
            { tenantId: payload.tenantId },
          ],
        },
      }),
    ]);

    const allRoles = [...platformRoles, ...tenantRoles];

    const data = allRoles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      isTenantScoped: r.tenantId !== null,
      permissions: r.permissions.map((rp) => rp.permission.code),
      createdAt: r.createdAt,
    }));

    return NextResponse.json(paginated(data, total, page, limit));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'roles.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createRoleSchema, body);

    // Check for duplicate code in tenant
    const existingRole = await db.role.findFirst({
      where: {
        code: data.code,
        tenantId: payload.tenantId,
      },
    });

    if (existingRole) {
      return NextResponse.json(
        { success: false, error: 'A role with this code already exists', code: 'CONFLICT' },
        { status: 409 }
      );
    }

    const role = await db.role.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        tenantId: payload.tenantId,
        isSystem: false,
      },
    });

    // Assign permissions if provided
    if (data.permissions && data.permissions.length > 0) {
      const permissions = await db.permission.findMany({
        where: { code: { in: data.permissions } },
      });

      for (const perm of permissions) {
        await db.rolePermission.create({
          data: {
            roleCode: role.code,
            permissionId: perm.id,
          },
        });
      }
    }

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'role.create',
      targetType: 'Role',
      targetId: role.id,
      metadata: { code: role.code, name: role.name, permissions: data.permissions },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissions: data.permissions ?? [],
      }, 'Role created successfully'),
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
