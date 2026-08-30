import { NextRequest, NextResponse } from 'next/server';
import { validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { cancelPendingMessages } from '@/lib/communication/campaign-service';
import { db } from '@/lib/db';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const cancelMessagesSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1, 'At least one message ID is required').max(1000, 'Maximum 1000 message IDs per request'),
});

// ============================================
// HELPERS
// ============================================

function isDbError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
  );
}

function dbUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
    { status: 503 },
  );
}

// ============================================
// POST /api/v1/communication/cancel — Cancel pending messages
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'messages.update', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(cancelMessagesSchema, body);

    // Tenant isolation: only cancel messages belonging to this tenant
    const messages = await db.message.findMany({
      where: {
        id: { in: data.messageIds },
        tenantId: payload.tenantId,
      },
      select: { id: true },
    });

    const tenantMessageIds = messages.map((m) => m.id);

    if (tenantMessageIds.length === 0) {
      return NextResponse.json(
        success({
          cancelled: 0,
          skipped: data.messageIds.length,
          messageIds: [],
        }, 'No messages found to cancel'),
      );
    }

    const result = await cancelPendingMessages(tenantMessageIds);

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'message.cancel',
      targetType: 'Message',
      targetId: tenantMessageIds.join(','),
      metadata: {
        requestedIds: data.messageIds.length,
        cancelled: result.cancelled,
        skipped: result.skipped,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(
        {
          cancelled: result.cancelled,
          skipped: result.skipped,
          messageIds: result.messageIds,
        },
        `${result.cancelled} message(s) cancelled`,
      ),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

