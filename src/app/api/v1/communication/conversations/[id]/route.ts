import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const updateConversationSchema = z.object({
  assignedToId: z.string().uuid().nullable().optional(),
  status: z.string().trim().min(1).optional(),
  subject: z.string().trim().optional(),
  participantIds: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const conversationSelect = {
  id: true,
  channel: true,
  externalId: true,
  subject: true,
  participantIds: true,
  assignedToId: true,
  status: true,
  lastMessageAt: true,
  lastMessagePreview: true,
  unreadCount: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  _count: {
    select: { messages: true },
  },
} as const;

const messageSelect = {
  id: true,
  direction: true,
  channel: true,
  status: true,
  content: true,
  contentType: true,
  senderId: true,
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
  sender: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  attachments: {
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      fileUrl: true,
      thumbnailUrl: true,
    },
  },
} as const;

function formatConversation(c: any) {
  return {
    id: c.id,
    channel: c.channel,
    externalId: c.externalId,
    subject: c.subject,
    participantIds: c.participantIds,
    assignedToId: c.assignedToId,
    assignedTo: c.assignedTo,
    status: c.status,
    lastMessageAt: c.lastMessageAt,
    lastMessagePreview: c.lastMessagePreview,
    unreadCount: c.unreadCount,
    metadata: c.metadata,
    messageCount: c._count?.messages ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function formatMessage(m: any) {
  return {
    id: m.id,
    direction: m.direction,
    channel: m.channel,
    status: m.status,
    content: m.content,
    contentType: m.contentType,
    senderId: m.senderId,
    externalSenderId: m.externalSenderId,
    senderName: m.senderName,
    isInternal: m.isInternal,
    templateId: m.templateId,
    scheduledAt: m.scheduledAt,
    sentAt: m.sentAt,
    deliveredAt: m.deliveredAt,
    readAt: m.readAt,
    failedAt: m.failedAt,
    failureReason: m.failureReason,
    sender: m.sender,
    attachments: m.attachments,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

// ============================================
// GET /api/v1/communication/conversations/:id — Single with messages
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'conversations.view', payload.tenantId);

    const { id } = await params;

    const conversation = await db.conversation.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: conversationSelect,
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const { searchParams } = new URL(request.url);
    const messagesPaginationSchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    });
    const { page, limit } = validate(messagesPaginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '50',
    });

    const [messages, total] = await Promise.all([
      db.message.findMany({
        where: { conversationId: id, tenantId: payload.tenantId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: messageSelect,
      }),
      db.message.count({
        where: { conversationId: id, tenantId: payload.tenantId },
      }),
    ]);

    return NextResponse.json(
      success({
        ...formatConversation(conversation as any),
        messages: {
          data: messages.map(formatMessage),
          pagination: { page, limit, total },
        },
      }),
    );
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

// ============================================
// PATCH /api/v1/communication/conversations/:id — Update
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'conversations.edit', payload.tenantId);

    const { id } = await params;

    const existing = await db.conversation.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Conversation not found');
    }

    const body = await request.json();
    const data = validate(updateConversationSchema, body);

    const validStatuses = ['ACTIVE', 'CLOSED', 'ARCHIVED'];
    if (data.status && !validStatuses.includes(data.status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate assignee belongs to tenant if provided
    if (data.assignedToId) {
 const user = await db.user.findFirst({
        where: { id: data.assignedToId },
        select: { id: true },
      });
      if (!user) {
        throw new ValidationError('Assigned user not found');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.participantIds !== undefined) updateData.participantIds = data.participantIds as any;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as any;

    const conversation = await db.conversation.update({
      where: { id },
      data: updateData,
      select: conversationSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'conversation.update',
      targetType: 'Conversation',
      targetId: id,
      metadata: { changes: Object.keys(updateData) },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatConversation(conversation as any), 'Conversation updated successfully'),
    );
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

// ============================================
// DELETE /api/v1/communication/conversations/:id — Archive
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

    await requirePermission(payload.roleCode ?? null, 'conversations.delete', payload.tenantId);

    const { id } = await params;

    const existing = await db.conversation.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Conversation not found');
    }

    await db.conversation.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'conversation.archive',
      targetType: 'Conversation',
      targetId: id,
      metadata: { channel: existing.channel, subject: existing.subject },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Conversation archived successfully'));
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
