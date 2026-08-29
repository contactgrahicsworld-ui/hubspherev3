import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { dispatchMessage } from '@/lib/communication/dispatcher';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const sendMessageSchema = z.object({
  channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']),
  recipient: z.string().trim().min(1, 'Recipient is required'),
  content: z.string().trim().optional(),
  templateId: z.string().uuid().optional(),
  subject: z.string().trim().optional(),
  conversationId: z.string().uuid().optional(),
  contentType: z.string().trim().default('TEXT'),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// HELPERS
// ============================================

const messageSelect = {
  id: true,
  direction: true,
  channel: true,
  status: true,
  content: true,
  contentType: true,
  senderId: true,
  externalMessageId: true,
  externalSenderId: true,
  senderName: true,
  isInternal: true,
  templateId: true,
  scheduledAt: true,
  sentAt: true,
  deliveredAt: true,
  readAt: true,
  failedAt: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
// POST /api/v1/communication/send — Send single message
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'messages.create', payload.tenantId);

    const body = await request.json();
    const data = validate(sendMessageSchema, body);

    // Must provide either content or templateId
    if (!data.content && !data.templateId) {
      throw new ValidationError('Either content or templateId is required');
    }

    // Resolve content from template if needed
    let resolvedContent = data.content;
    if (data.templateId && !data.content) {
      const template = await db.communicationTemplate.findFirst({
        where: { id: data.templateId, tenantId: payload.tenantId, status: 'ACTIVE' },
        select: { id: true, body: true, subject: true, channel: true },
      });
      if (!template) {
        throw new NotFoundError('Active template not found');
      }
      resolvedContent = template.body;
    }

    if (!resolvedContent) {
      throw new ValidationError('Message content could not be resolved');
    }

    // Get or create a conversation
    let conversationId = data.conversationId;

    if (!conversationId) {
      // Create a new conversation for this outbound message
      const conversation = await db.conversation.create({
        data: {
          tenantId: payload.tenantId,
          channel: data.channel,
          subject: data.subject ?? null,
          status: 'ACTIVE',
          metadata: {
            recipient: data.recipient,
            isDirectSend: true,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      conversationId = conversation.id;
    } else {
      // Verify the conversation belongs to this tenant
      const existing = await db.conversation.findFirst({
        where: { id: conversationId, tenantId: payload.tenantId },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundError('Conversation not found');
      }
    }

    // Create the message record with QUEUED status
    const message = await db.message.create({
      data: {
        tenantId: payload.tenantId,
        conversationId: conversationId as string,
        direction: 'OUTBOUND',
        channel: data.channel,
        content: resolvedContent,
        contentType: data.contentType,
        senderId: payload.userId,
        templateId: data.templateId ?? null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: 'QUEUED',
        metadata: {
          recipient: data.recipient,
          subject: data.subject ?? null,
        } as unknown as Prisma.InputJsonValue,
      },
      select: messageSelect,
    });

    // Update conversation's last message info
    const preview = resolvedContent.length > 200
      ? resolvedContent.slice(0, 200) + '...'
      : resolvedContent;
    await db.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: preview,
      },
    });

    // Dispatch the message
    const dispatchResult = await dispatchMessage(message.id, payload.tenantId);

    // Re-fetch the message to get the updated status after dispatch
    const updatedMessage = await db.message.findUnique({
      where: { id: message.id },
      select: messageSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'message.send',
      targetType: 'Message',
      targetId: message.id,
      metadata: {
        channel: data.channel,
        recipient: data.recipient,
        dispatchSuccess: dispatchResult.success,
        messageStatus: dispatchResult.messageStatus,
        failureReason: dispatchResult.failureReason,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(updatedMessage, 'Message processed'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
