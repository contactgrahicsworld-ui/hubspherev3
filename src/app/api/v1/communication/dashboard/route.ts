import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';

// ============================================
// GET /api/v1/communication/dashboard — Aggregated stats
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'conversations.view', payload.tenantId, payload.isSuperAdmin);

    const tenantId = payload.tenantId;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const [
      totalConversations,
      activeConversations,
      unreadConversations,
      closedConversations,
      messagesByChannel,
      totalMessages,
      recentMessages,
      conversationsByChannel,
      providerConfigs,
      templateStats,
    ] = await Promise.all([
      // Total conversations
      db.conversation.count({
        where: { tenantId },
      }),

      // Active conversations
      db.conversation.count({
        where: { tenantId, status: 'ACTIVE' },
      }),

      // Conversations with unread messages
      db.conversation.count({
        where: { tenantId, status: 'ACTIVE', unreadCount: { gt: 0 } },
      }),

      // Closed conversations
      db.conversation.count({
        where: { tenantId, status: 'CLOSED' },
      }),

      // Messages by channel (last 30 days)
      db.message.groupBy({
        by: ['channel'],
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
        _count: true,
      }),

      // Total messages (last 30 days)
      db.message.count({
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      }),

      // Recent messages (last 7 days, last 10)
      db.message.findMany({
        where: { tenantId, createdAt: { gte: sevenDaysAgo } },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          direction: true,
          channel: true,
          status: true,
          createdAt: true,
          conversation: {
            select: { id: true, subject: true, channel: true },
          },
          sender: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      }),

      // Conversations by channel
      db.conversation.groupBy({
        by: ['channel'],
        where: { tenantId },
        _count: true,
      }),

      // Provider config status
      db.communicationProviderConfig.findMany({
        where: { tenantId },
        select: {
          id: true,
          channel: true,
          provider: true,
          isEnabled: true,
          name: true,
        },
      }),

      // Template stats
      db.communicationTemplate.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
    ]);

    // Format messages by channel
    const channelMessages: Record<string, number> = {};
    for (const mc of messagesByChannel) {
      channelMessages[mc.channel] = mc._count;
    }

    // Format conversations by channel
    const channelConversations: Record<string, number> = {};
    for (const cc of conversationsByChannel) {
      channelConversations[cc.channel] = cc._count;
    }

    // Format template stats
    const templateStatMap: Record<string, number> = {};
    for (const ts of templateStats) {
      templateStatMap[ts.status] = ts._count;
    }

    // Count enabled/disabled providers
    const enabledProviders = providerConfigs.filter((p) => p.isEnabled).length;
    const disabledProviders = providerConfigs.length - enabledProviders;

    return NextResponse.json(
      success({
        conversations: {
          total: totalConversations,
          active: activeConversations,
          unread: unreadConversations,
          closed: closedConversations,
          byChannel: channelConversations,
        },
        messages: {
          totalLast30Days: totalMessages,
          byChannel: channelMessages,
        },
        providers: {
          total: providerConfigs.length,
          enabled: enabledProviders,
          disabled: disabledProviders,
          configs: providerConfigs.map((p) => ({
            id: p.id,
            channel: p.channel,
            provider: p.provider,
            isEnabled: p.isEnabled,
            name: p.name,
          })),
        },
        templates: {
          byStatus: templateStatMap,
          total: Object.values(templateStatMap).reduce((a, b) => a + b, 0),
        },
        recentActivity: recentMessages.map((m) => ({
          id: m.id,
          content: m.content,
          direction: m.direction,
          channel: m.channel,
          status: m.status,
          createdAt: m.createdAt,
          conversation: m.conversation,
          sender: m.sender,
        })),
      }),
      { headers: { 'Cache-Control': 'private, no-store' } },
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
