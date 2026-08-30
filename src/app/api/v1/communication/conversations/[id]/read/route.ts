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

// ============================================
// POST /api/v1/communication/conversations/:id/read — Mark as read
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'conversations.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const conversation = await db.conversation.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: { id: true, unreadCount: true },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Reset unread count
    await db.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });

    // Mark all unread messages in conversation as read
    await db.message.updateMany({
      where: {
        conversationId: id,
        tenantId: payload.tenantId,
        direction: 'INBOUND',
        status: { in: ['DELIVERED', 'SENT'] },
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    return NextResponse.json(success(null, 'Conversation marked as read'));
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
