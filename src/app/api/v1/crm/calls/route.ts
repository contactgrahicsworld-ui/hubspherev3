import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createCallSchema = z.object({
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  callType: z.enum(['WEBRTC', 'VOIP', 'PSTN']).optional(),
  callStartTime: z.string().datetime().optional(),
  callEndTime: z.string().datetime().optional(),
  duration: z.number().int().min(0).optional(),
  callStatus: z.enum(['RINGING', 'CONNECTED', 'ENDED', 'FAILED', 'MISSED']).optional(),
  recordingStatus: z.enum(['RECORDING', 'PROCESSING', 'READY', 'FAILED', 'NOT_AVAILABLE']).optional(),
  recordingUrl: z.string().max(2000).optional(),
  recordingProvider: z.string().max(100).optional(),
  recordingSize: z.number().int().min(0).optional(),
  recordingMeta: z.record(z.string(), z.unknown()).optional(),
  failureReason: z.string().max(500).optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const callSelect = {
  id: true,
  tenantId: true,
  leadId: true,
  contactId: true,
  dealId: true,
  agentId: true,
  direction: true,
  callType: true,
  callStartTime: true,
  callEndTime: true,
  duration: true,
  callStatus: true,
  recordingStatus: true,
  recordingUrl: true,
  recordingProvider: true,
  recordingSize: true,
  recordingMeta: true,
  failureReason: true,
  retryCount: true,
  lastRetryAt: true,
  createdAt: true,
  updatedAt: true,
  recordings: {
    select: {
      id: true,
      status: true,
      recordingUrl: true,
      recordingSize: true,
      durationSeconds: true,
      provider: true,
      transcript: true,
      createdAt: true,
    },
  },
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
// GET /api/v1/crm/calls — List calls
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'calls.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const direction = searchParams.get('direction');
    const callStatus = searchParams.get('callStatus');
    const agentId = searchParams.get('agentId');
    const recordingStatus = searchParams.get('recordingStatus');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (direction) where.direction = direction;
    if (callStatus) where.callStatus = callStatus;
    if (agentId) where.agentId = agentId;
    if (recordingStatus) where.recordingStatus = recordingStatus;

    if (dateFrom || dateTo) {
      where.createdAt = {} as Record<string, unknown>;
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [calls, total] = await Promise.all([
      db.call.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: callSelect,
      }),
      db.call.count({ where }),
    ]);

    return NextResponse.json(paginated(calls, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/crm/calls — Create call record
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'calls.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createCallSchema, body);

    const call = await db.call.create({
      data: {
        tenantId: payload.tenantId,
        leadId: data.leadId ?? null,
        contactId: data.contactId ?? null,
        dealId: data.dealId ?? null,
        agentId: data.agentId ?? payload.userId,
        direction: data.direction ?? null,
        callType: data.callType ?? null,
        callStartTime: data.callStartTime ? new Date(data.callStartTime) : null,
        callEndTime: data.callEndTime ? new Date(data.callEndTime) : null,
        duration: data.duration ?? null,
        callStatus: data.callStatus ?? null,
        recordingStatus: data.recordingStatus ?? 'NOT_AVAILABLE',
        recordingUrl: data.recordingUrl ?? null,
        recordingProvider: data.recordingProvider ?? null,
        recordingSize: data.recordingSize ?? null,
        recordingMeta: data.recordingMeta as unknown as Prisma.InputJsonValue | undefined,
        failureReason: data.failureReason ?? null,
      },
      select: callSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'call.create',
      targetType: 'Call',
      targetId: call.id,
      metadata: { direction: data.direction, callStatus: data.callStatus, duration: data.duration },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(call, 'Call record created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
