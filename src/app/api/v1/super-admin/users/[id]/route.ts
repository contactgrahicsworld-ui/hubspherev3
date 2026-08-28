import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createUserSchema, validate } from '@/lib/validators';
import { handleApiError, AuthorizationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isSuperAdmin: true,
        status: true,
        emailVerified: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          include: {
            tenant: {
              select: { id: true, name: true, slug: true, status: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return NextResponse.json(
      success({
        ...user,
        memberships: user.memberships.map((m) => ({
          id: m.id,
          roleCode: m.roleCode,
          status: m.status,
          tenant: m.tenant,
          joinedAt: m.joinedAt,
        })),
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

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    const { id } = await params;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    const body = await request.json();
    const data = validate(createUserSchema, body);

    // Check email uniqueness if changed
    if (data.email && data.email !== existing.email) {
      const emailTaken = await db.user.findUnique({ where: { email: data.email } });
      if (emailTaken) {
        return NextResponse.json(
          { success: false, error: 'A user with this email already exists', code: 'CONFLICT' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.email) updateData.email = data.email;
    if (data.name !== undefined) updateData.name = data.name;
    if (typeof body.isSuperAdmin === 'boolean') updateData.isSuperAdmin = body.isSuperAdmin;
    if (typeof body.status === 'string') updateData.status = body.status;

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isSuperAdmin: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      action: 'user.update',
      targetType: 'User',
      targetId: id,
      metadata: { email: user.email },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(user, 'User updated successfully'));
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

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    const { id } = await params;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    // Prevent self-deletion
    if (id === payload.userId) {
      throw new ValidationError('Cannot delete your own account');
    }

    await db.user.delete({ where: { id } });

    await createAuditLog({
      actorId: payload.userId,
      action: 'user.delete',
      targetType: 'User',
      targetId: id,
      metadata: { email: existing.email },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'User deleted successfully'));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
