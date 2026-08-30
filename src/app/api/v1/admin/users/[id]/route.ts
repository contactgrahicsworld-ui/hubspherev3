import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate, VALID_ASSIGNABLE_ROLES } from '@/lib/validators';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'users.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid user ID format');
    }

    const membership = await db.membership.findFirst({
      where: {
        userId: id,
        tenantId: payload.tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            status: true,
            emailVerified: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundError('User not found in this tenant');
    }

    return NextResponse.json(
      success({
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        avatarUrl: membership.user.avatarUrl,
        status: membership.user.status,
        emailVerified: membership.user.emailVerified,
        lastLoginAt: membership.user.lastLoginAt,
        roleCode: membership.roleCode,
        membershipStatus: membership.status,
        joinedAt: membership.joinedAt,
        createdAt: membership.user.createdAt,
      })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'users.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid user ID format');
    }

    const membership = await db.membership.findFirst({
      where: {
        userId: id,
        tenantId: payload.tenantId,
      },
    });

    if (!membership) {
      throw new NotFoundError('User not found in this tenant');
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.roleCode) {
      if (!(VALID_ASSIGNABLE_ROLES as readonly string[]).includes(body.roleCode)) {
        throw new ValidationError(`Invalid role code. Must be one of: ${VALID_ASSIGNABLE_ROLES.join(', ')}`);
      }
      updateData.roleCode = body.roleCode;
    }
    if (body.status) {
      const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
      if (!validStatuses.includes(body.status)) {
        throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      updateData.status = body.status;
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
      metadata: { userId: id, roleCode: updated.roleCode, status: updated.status },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({
        id: membership.id,
        userId: id,
        roleCode: updated.roleCode,
        status: updated.status,
      }, 'User updated successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'users.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid user ID format');
    }

    // Prevent removing yourself
    if (id === payload.userId) {
      throw new ValidationError('Cannot remove yourself from the tenant');
    }

    const membership = await db.membership.findFirst({
      where: {
        userId: id,
        tenantId: payload.tenantId,
      },
    });

    if (!membership) {
      throw new NotFoundError('User not found in this tenant');
    }

    await db.membership.delete({ where: { id: membership.id } });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'membership.delete',
      targetType: 'Membership',
      targetId: membership.id,
      metadata: { userId: id },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'User removed from tenant successfully'));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
