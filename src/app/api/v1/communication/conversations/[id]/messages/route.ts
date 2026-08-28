import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
  contentType: z.string().trim().default('TEXT'),
  direction: z.string().trim().default('OUTBOUND'),
  externalSenderId: z.string().trim().optional(),
  senderName: z.string().trim().optional(),
  isInternal: z.boolean().default(false),
  templateId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

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
// GET /api/v1/communication/conversations/:id/messages — List messages
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

    await requirePermission(payload.roleCode ?? null, 'messages.view', payload.tenantId);

    const { id: conversationId } = await params;

    // Verify conversation belongs to tenant
    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, tenantId: payload.tenantId },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '50',
    });

    const where: Record<string, unknown> = {
      conversationId,
      tenantId: payload.tenantId,
    };

    const internalOnly = searchParams.get('internal') === 'true';
    if (internalOnly) {
      where.isInternal = true;
    }

    const [messages, total] = await Promise.all([
      db.message.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: messageSelect,
      }),
      db.message.count({ where }),
    ]);

    return NextResponse.json(paginated(messages.map(formatMessage), total, page, limit));
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
// POST /api/v1/communication/conversations/:id/messages — Send message
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

    await requirePermission(payload.roleCode ?? null, 'messages.create', payload.tenantId);

    const { id: conversationId } = await params;

    // Verify conversation belongs to tenant
    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, tenantId: payload.tenantId },
      select: { id: true, channel: true },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const body = await request.json();
    const data = validate(createMessageSchema, body);

    const validDirections = ['INBOUND', 'OUTBOUND', 'SYSTEM'];
    if (!validDirections.includes(data.direction)) {
      throw new ValidationError(
        `Invalid direction. Must be one of: ${validDirections.join(', ')}`,
      );
    }

    // Validate template belongs to tenant if provided
    if (data.templateId) {
      const template = await db.communicationTemplate.findFirst({
        where: { id: data.templateId, tenantId: payload.tenantId },
        select: { id: true },
      });
      if (!template) {
        throw new ValidationError('Template not found');
      }
    }

    // Determine sender: only set for OUTBOUND user messages
    let senderId: string | null = null;
    if (data.direction === 'OUTBOUND' && !data.isInternal) {
      senderId = payload.userId;
    } else if (data.isInternal) {
      senderId = payload.userId;
    }

    const message = await db.message.create({
      data: {
        tenantId: payload.tenantId,
        conversationId,
        direction: data.direction,
        channel: conversation.channel,
        content: data.content,
        contentType: data.contentType,
        senderId,
        externalSenderId: data.externalSenderId ?? null,
        senderName: data.senderName ?? null,
        isInternal: data.isInternal,
        templateId: data.templateId ?? null,
        status: 'QUEUED',
        metadata: (data.metadata ?? {}) as any,
      },
      select: messageSelect,
    });

    // Update conversation's last message info
    const preview = data.content.length > 200 ? data.content.slice(0, 200) + '...' : data.content;
    await db.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: preview,
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'message.create',
      targetType: 'Message',
      targetId: message.id,
      metadata: {
        conversationId,
        direction: data.direction,
        isInternal: data.isInternal,
        contentType: data.contentType,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatMessage(message as any), 'Message sent successfully'),
      { status: 201 },
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
