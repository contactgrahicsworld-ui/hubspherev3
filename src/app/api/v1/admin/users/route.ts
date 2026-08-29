import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createUserSchema, paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';

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

    const search = searchParams.get('search') ?? '';

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (search) {
      where.user = {
        OR: [
          { email: { contains: search } },
          { name: { contains: search } },
        ],
      };
    }

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
              lastLoginAt: true,
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
      membershipStatus: m.status,
      lastLoginAt: m.user.lastLoginAt,
      joinedAt: m.joinedAt,
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

    await requirePermission(payload.roleCode ?? null, 'users.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createUserSchema, body);

    // Check if email is already used in THIS tenant
    const tenantMembership = await db.membership.findFirst({
      where: {
        user: { email: data.email },
        tenantId: payload.tenantId,
      },
      include: { user: true },
    });

    if (tenantMembership) {
      return NextResponse.json(
        { success: false, error: 'User is already a member of this tenant', code: 'CONFLICT' },
        { status: 409 }
      );
    }

    // Check if user exists globally (in another tenant) — no info leaked to client
    const existingUser = await db.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      // User exists in another tenant — add membership to this tenant
      const roleCode = data.roleCode;
      const membership = await db.membership.create({
        data: {
          userId: existingUser.id,
          tenantId: payload.tenantId,
          roleCode,
          status: 'ACTIVE',
          invitedBy: payload.userId,
        },
      });

      await createAuditLog({
        actorId: payload.userId,
        tenantId: payload.tenantId,
        action: 'membership.create',
        targetType: 'Membership',
        targetId: membership.id,
        metadata: { email: data.email, roleCode },
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });

      return NextResponse.json(
        success({
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          roleCode,
          membershipStatus: 'ACTIVE',
        }, 'User added to tenant successfully'),
        { status: 201 }
      );
    }

    // Create new user
    const passwordHash = data.password
      ? await hashPassword(data.password)
      : await hashPassword(`TempPass_${crypto.randomUUID().slice(0, 8)}!k9`);

    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name ?? null,
        status: 'ACTIVE',
      },
    });

    const roleCode = data.roleCode;
    const membership = await db.membership.create({
      data: {
        userId: user.id,
        tenantId: payload.tenantId,
        roleCode,
        status: 'ACTIVE',
        invitedBy: payload.userId,
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'user.create',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email, roleCode },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({
        id: user.id,
        email: user.email,
        name: user.name,
        roleCode,
        membershipStatus: 'ACTIVE',
      }, 'User created and added to tenant successfully'),
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
