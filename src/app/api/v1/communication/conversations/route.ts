import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
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

const createConversationSchema = z.object({
  channel: z.string().trim().min(1, 'Channel is required'),
  externalId: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  participantIds: z.array(z.string()).optional(),
  assignedToId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type CreateConversationInput = z.infer<typeof createConversationSchema>;

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

// ============================================
// GET /api/v1/communication/conversations — List
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'conversations.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const search = searchParams.get('search') ?? '';
    const channel = searchParams.get('channel');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const includeUnreadCount = searchParams.get('includeUnread') === 'true';

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { lastMessagePreview: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (assignedTo) where.assignedToId = assignedTo;

    const [conversations, total] = await Promise.all([
      db.conversation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        select: conversationSelect,
      }),
      db.conversation.count({ where }),
    ]);

    let unreadCount: number | undefined;
    if (includeUnreadCount) {
      unreadCount = await db.conversation.count({
        where: {
          tenantId: payload.tenantId,
          status: 'ACTIVE',
          unreadCount: { gt: 0 },
        },
      });
    }

    const response: Record<string, unknown> = paginated(
      conversations.map(formatConversation),
      total,
      page,
      limit,
    );

    if (unreadCount !== undefined) {
      response.unreadConversationCount = unreadCount;
    }

    return NextResponse.json(response);
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
// POST /api/v1/communication/conversations — Create
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'conversations.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createConversationSchema, body);

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

    const validChannels = ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP', 'PUSH', 'SYSTEM'];
    if (!validChannels.includes(data.channel)) {
      throw new ValidationError(
        `Invalid channel. Must be one of: ${validChannels.join(', ')}`,
      );
    }

    const conversation = await db.conversation.create({
      data: {
        tenantId: payload.tenantId,
        channel: data.channel,
        externalId: data.externalId ?? null,
        subject: data.subject ?? null,
        participantIds: (data.participantIds ?? []) as any,
        assignedToId: data.assignedToId ?? null,
        metadata: (data.metadata ?? {}) as any,
      },
      select: conversationSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'conversation.create',
      targetType: 'Conversation',
      targetId: conversation.id,
      metadata: {
        channel: data.channel,
        subject: data.subject,
        assignedToId: data.assignedToId,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatConversation(conversation as any), 'Conversation created successfully'),
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
