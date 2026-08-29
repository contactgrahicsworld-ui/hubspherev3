import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate, VALID_ASSIGNABLE_ROLES } from '@/lib/validators';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'users.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const where: Record<string, unknown> = { tenantId: payload.tenantId };

    const [memberships, total] = await Promise.all([
      db.membership.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { joinedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
              status: true,
            },
          },
        },
      }),
      db.membership.count({ where }),
    ]);

    const data = memberships.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      userStatus: m.user.status,
      roleCode: m.roleCode,
      status: m.status,
      invitedBy: m.invitedBy,
      joinedAt: m.joinedAt,
    }));

    return NextResponse.json(paginated(data, total, page, limit));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'users.edit', payload.tenantId);

    const body = await request.json();
    const { id, roleCode, status } = body as { id?: string; roleCode?: string; status?: string };

    if (!id) {
      throw new ValidationError('Membership id is required');
    }

    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid membership ID format');
    }

    const membership = await db.membership.findFirst({
      where: {
        id,
        tenantId: payload.tenantId,
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership not found');
    }

    const updateData: Record<string, unknown> = {};
    if (roleCode !== undefined && roleCode !== null && roleCode !== '') {
      if (!(VALID_ASSIGNABLE_ROLES as readonly string[]).includes(roleCode)) {
        throw new ValidationError(`Invalid role code. Must be one of: ${VALID_ASSIGNABLE_ROLES.join(', ')}`);
      }
      updateData.roleCode = roleCode;
    }
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
    if (status !== undefined && status !== null && status !== '') {
      if (!validStatuses.includes(status)) {
        throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      updateData.status = status;
    }

    const updated = await db.membership.update({
      where: { id: membership.id },
      data: updateData,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'membership.update',
      targetType: 'Membership',
      targetId: membership.id,
      metadata: { userId: membership.userId, roleCode: updated.roleCode, status: updated.status },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({
        id: updated.id,
        userId: updated.userId,
        roleCode: updated.roleCode,
        status: updated.status,
      }, 'Membership updated successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
