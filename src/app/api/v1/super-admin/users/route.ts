import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthorizationError } from '@/lib/errors';
import { paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const search = searchParams.get('search') ?? '';

    const where = search
      ? {
          OR: [
            { email: { contains: search } },
            { name: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
            include: {
              tenant: {
                select: { id: true, name: true, status: true },
              },
            },
          },
        },
      }),
      db.user.count({ where }),
    ]);

    const data = users.map((u) => ({
      ...u,
      memberships: u.memberships.map((m) => ({
        id: m.id,
        roleCode: m.roleCode,
        status: m.status,
        tenant: m.tenant,
      })),
    }));

    return NextResponse.json(paginated(data, total, page, limit));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
