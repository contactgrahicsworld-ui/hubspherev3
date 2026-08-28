import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

// ============================================
// DELETE /api/v1/communication/notifications/:id — Archive
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'notifications.delete', payload.tenantId);

    const { id } = await params;

    const existing = await db.notification.findFirst({
      where: {
        id,
        tenantId: payload.tenantId,
        recipientId: payload.userId,
      },
      select: { id: true, title: true },
    });

    if (!existing) {
      throw new NotFoundError('Notification not found');
    }

    await db.notification.delete({
      where: { id },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'notification.delete',
      targetType: 'Notification',
      targetId: id,
      metadata: { title: existing.title },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Notification deleted successfully'));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
