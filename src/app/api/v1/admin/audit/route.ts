import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
import { paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'audit.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const action = searchParams.get('action') ?? undefined;
    const actorId = searchParams.get('actorId') ?? undefined;

    const where: Record<string, unknown> = { tenantId: payload.tenantId };
    if (action) where.action = action;
    if (actorId) {
      if (!z.string().uuid().safeParse(actorId).success) {
        throw new ValidationError('Invalid actorId format');
      }
      where.actorId = actorId;
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    const data = logs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actor: log.actor ? { id: log.actor.id, email: log.actor.email, name: log.actor.name } : null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: log.metadata ?? null,
      createdAt: log.createdAt,
    }));

    return NextResponse.json(paginated(data, total, page, limit));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
