import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createRoleSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'roles.view', payload.tenantId);

    const { code } = await params;

    // Look up role - could be platform or tenant-scoped
    const role = await db.role.findFirst({
      where: {
        code,
        OR: [
          { tenantId: null },
          { tenantId: payload.tenantId },
        ],
      },
      include: {
        permissions: {
          include: { permission: { select: { id: true, code: true, name: true, module: true, action: true } } },
        },
      },
    });

    if (!role) {
      throw new NotFoundError('Role not found');
    }

    return NextResponse.json(
      success({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isTenantScoped: role.tenantId !== null,
        permissions: role.permissions.map((rp) => rp.permission),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'roles.edit', payload.tenantId);

    const { code } = await params;

    const role = await db.role.findFirst({
      where: {
        code,
        tenantId: payload.tenantId,
      },
    });

    if (!role) {
      throw new NotFoundError('Role not found in this tenant');
    }

    if (role.isSystem) {
      throw new ValidationError('Cannot modify system roles');
    }

    const body = await request.json();
    const data = validate(createRoleSchema, body);

    // Delete existing permissions and reassign
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleCode: role.code } }),
      db.role.update({
        where: { id: role.id },
        data: {
          name: data.name,
          description: data.description,
        },
      }),
    ]);

    // Reassign permissions
    if (data.permissions && data.permissions.length > 0) {
      const permissions = await db.permission.findMany({
        where: { code: { in: data.permissions } },
      });

      for (const perm of permissions) {
        await db.rolePermission.create({
          data: { roleCode: role.code, permissionId: perm.id },
        });
      }
    }

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'role.update',
      targetType: 'Role',
      targetId: role.id,
      metadata: { code: role.code, name: data.name, permissions: data.permissions },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({
        id: role.id,
        code: role.code,
        name: data.name,
        description: data.description,
        permissions: data.permissions ?? [],
      }, 'Role updated successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'roles.delete', payload.tenantId);

    const { code } = await params;

    const role = await db.role.findFirst({
      where: {
        code,
        tenantId: payload.tenantId,
      },
      include: {
        _count: { select: { memberships: true } },
      },
    });

    if (!role) {
      throw new NotFoundError('Role not found in this tenant');
    }

    if (role.isSystem) {
      throw new ValidationError('Cannot delete system roles');
    }

    if (role._count.memberships > 0) {
      throw new ValidationError('Cannot delete a role that has members assigned');
    }

    await db.role.delete({ where: { id: role.id } });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'role.delete',
      targetType: 'Role',
      targetId: role.id,
      metadata: { code: role.code, name: role.name },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Role deleted successfully'));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
