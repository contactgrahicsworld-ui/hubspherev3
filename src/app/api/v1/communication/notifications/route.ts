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

const createNotificationSchema = z.object({
  recipientId: z.string().uuid().min(1, 'Recipient ID is required'),
  title: z.string().trim().min(1, 'Title is required').max(500),
  body: z.string().min(1, 'Body is required'),
  type: z.string().trim().optional(),
  category: z.string().trim().optional(),
  link: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const markNotificationSchema = z.object({
  id: z.string().uuid().optional(),
  markAllRead: z.boolean().optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const notificationSelect = {
  id: true,
  recipientId: true,
  title: true,
  body: true,
  type: true,
  category: true,
  link: true,
  isRead: true,
  readAt: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

function formatNotification(n: any) {
  return {
    id: n.id,
    recipientId: n.recipientId,
    title: n.title,
    body: n.body,
    type: n.type,
    category: n.category,
    link: n.link,
    isRead: n.isRead,
    readAt: n.readAt,
    metadata: n.metadata,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

// ============================================
// GET /api/v1/communication/notifications — List user's notifications
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'notifications.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const unreadOnly = searchParams.get('unread') === 'true';
    const category = searchParams.get('category');
    const includeUnreadCount = searchParams.get('includeUnreadCount') === 'true';

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
      recipientId: payload.userId,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    if (category) {
      where.category = category;
    }

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: notificationSelect,
      }),
      db.notification.count({ where }),
    ]);

    let unreadCount: number | undefined;
    if (includeUnreadCount) {
      unreadCount = await db.notification.count({
        where: {
          tenantId: payload.tenantId,
          recipientId: payload.userId,
          isRead: false,
        },
      });
    }

    const response: Record<string, unknown> = paginated(
      notifications.map(formatNotification),
      total,
      page,
      limit,
    );

    if (unreadCount !== undefined) {
      response.unreadCount = unreadCount;
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
// POST /api/v1/communication/notifications — Create notification
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'notifications.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createNotificationSchema, body);

    // Validate recipient belongs to tenant
    const recipient = await db.user.findFirst({
      where: { id: data.recipientId },
      select: { id: true },
    });
    if (!recipient) {
      throw new ValidationError('Recipient user not found');
    }

    const validTypes = ['INFO', 'WARNING', 'ERROR', 'SUCCESS', 'MENTION', 'ASSIGNMENT'];
    if (data.type && !validTypes.includes(data.type)) {
      throw new ValidationError(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const validCategories = ['GENERAL', 'CRM', 'HRMS', 'COMMUNICATION', 'SYSTEM'];
    if (data.category && !validCategories.includes(data.category)) {
      throw new ValidationError(
        `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      );
    }

    const notification = await db.notification.create({
      data: {
        tenantId: payload.tenantId,
        recipientId: data.recipientId,
        title: data.title,
        body: data.body,
        type: data.type ?? 'INFO',
        category: data.category ?? 'GENERAL',
        link: data.link ?? null,
        metadata: (data.metadata ?? {}) as any,
      },
      select: notificationSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'notification.create',
      targetType: 'Notification',
      targetId: notification.id,
      metadata: {
        recipientId: data.recipientId,
        title: data.title,
        type: data.type,
        category: data.category,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatNotification(notification as any), 'Notification created successfully'),
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

// ============================================
// PATCH /api/v1/communication/notifications — Mark read / mark all read
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'notifications.edit', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(markNotificationSchema, body);

    if (data.markAllRead) {
      // Mark all user's notifications as read
      const result = await db.notification.updateMany({
        where: {
          tenantId: payload.tenantId,
          recipientId: payload.userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json(
        success({ markedCount: result.count }, 'All notifications marked as read'),
      );
    }

    if (data.id) {
      // Mark a single notification as read
      const notification = await db.notification.findFirst({
        where: {
          id: data.id,
          tenantId: payload.tenantId,
          recipientId: payload.userId,
          isRead: false,
        },
        select: { id: true },
      });

      if (!notification) {
        throw new ValidationError('Unread notification not found');
      }

      await db.notification.update({
        where: { id: data.id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json(
        success({ id: data.id }, 'Notification marked as read'),
      );
    }

    throw new ValidationError('Provide either id or markAllRead to proceed');
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
