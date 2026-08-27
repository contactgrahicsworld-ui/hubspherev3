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

    const [tenantCount, userCount, auditLogCount, suspendedTenantCount, activeUserCount] =
      await Promise.all([
        db.tenant.count(),
        db.user.count(),
        db.auditLog.count(),
        db.tenant.count({ where: { status: 'SUSPENDED' } }),
        db.user.count({ where: { status: 'ACTIVE' } }),
      ]);

    return NextResponse.json(
      success({
        tenants: {
          total: tenantCount,
          suspended: suspendedTenantCount,
        },
        users: {
          total: userCount,
          active: activeUserCount,
        },
        auditLogs: auditLogCount,
      })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
