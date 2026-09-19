/**
 * Recent Activity API — returns the user's recently-viewed items.
 * Sources from AuditLog where action like 'view%'.
 * Limited to 10 items.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';

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

// Map target types to navigation hrefs
function targetToHref(targetType: string | null, targetId: string | null): string | null {
  if (!targetType || !targetId) return null;
  const map: Record<string, string> = {
    Lead: `/crm/leads/${targetId}`,
    Contact: `/crm/contacts/${targetId}`,
    Company: `/crm/companies/${targetId}`,
    Deal: `/crm/deals/${targetId}`,
    Task: `/crm/tasks`,
    Employee: `/hrms/employees`,
    Invoice: `/accounting`,
    FieldVisit: `/hrms/field-sales`,
    Call: `/crm/calls`,
  };
  return map[targetType] ?? null;
}

// Friendly labels for target types
function targetToLabel(targetType: string | null, metadata: unknown): string {
  if (!targetType) return 'Unknown';
  const meta = metadata as Record<string, unknown> | null;
  const name = meta?.name ?? meta?.title ?? meta?.email ?? null;
  if (name && typeof name === 'string') return name;
  const labels: Record<string, string> = {
    Lead: 'Lead',
    Contact: 'Contact',
    Company: 'Company',
    Deal: 'Deal',
    Task: 'Task',
    Employee: 'Employee',
    Invoice: 'Invoice',
    FieldVisit: 'Field Visit',
    Call: 'Call',
  };
  return labels[targetType] ?? targetType;
}

// ============================================
// GET /api/v1/search/recent — Recent items
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    const tenantId = payload.tenantId;
    const userId = payload.userId;

    // Fetch the user's recent "view" actions from AuditLog
    const recentLogs = await db.auditLog.findMany({
      where: {
        tenantId,
        actorId: userId,
        action: { startsWith: 'view' },
        targetType: { not: null },
        targetId: { not: null },
      },
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Fetch more to deduplicate, then take 10
    });

    // Deduplicate by target (same entity viewed multiple times)
    const seen = new Set<string>();
    const recentItems: Array<{
      type: string;
      id: string;
      label: string;
      href: string | null;
      viewedAt: Date;
    }> = [];

    for (const log of recentLogs) {
      const key = `${log.targetType}:${log.targetId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const href = targetToHref(log.targetType, log.targetId);
      recentItems.push({
        type: log.targetType!,
        id: log.targetId!,
        label: targetToLabel(log.targetType, log.metadata),
        href,
        viewedAt: log.createdAt,
      });

      if (recentItems.length >= 10) break;
    }

    return NextResponse.json(
      success({
        items: recentItems,
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
