/**
 * Call Requests API
 * GET  /api/v1/call-requests — List call requests for tenant (paginated, filterable)
 * POST /api/v1/call-requests — Create a call request
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, NotFoundError, ConflictError, ValidationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { sseManager } from '@/lib/telecalling/sse-manager';
import { z } from 'zod';
import crypto from 'crypto';

// ============================================
// SCHEMAS
// ============================================

const createCallRequestSchema = z.object({
  deviceId: z.string().uuid('Device ID must be a valid UUID'),
  phoneNumber: z.string().min(1, 'Phone number is required').max(30),
  contactName: z.string().max(200).optional(),
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  idempotencyKey: z.string().max(100).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  expiresInSeconds: z.number().int().min(60).max(3600).optional(), // Custom expiry
});

// ============================================
// SHARED HELPERS
// ============================================

const callRequestSelect = {
  id: true,
  tenantId: true,
  deviceId: true,
  requestedBy: true,
  leadId: true,
  contactId: true,
  dealId: true,
  phoneNumber: true,
  contactName: true,
  idempotencyKey: true,
  status: true,
  callId: true,
  priority: true,
  expiresAt: true,
  acceptedAt: true,
  completedAt: true,
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
// GET /api/v1/call-requests — List call requests
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'call_requests.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const status = searchParams.get('status');
    const deviceId = searchParams.get('deviceId');
    const requestedBy = searchParams.get('requestedBy');

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (status) where.status = status;
    if (deviceId) where.deviceId = deviceId;
    if (requestedBy) where.requestedBy = requestedBy;

    const [callRequests, total] = await Promise.all([
      db.callRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: callRequestSelect,
      }),
      db.callRequest.count({ where }),
    ]);

    return NextResponse.json(paginated(callRequests, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/call-requests — Create call request
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'call_requests.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createCallRequestSchema, body);

    // Verify the device exists and belongs to this tenant
    const device = await db.device.findFirst({
      where: { id: data.deviceId, tenantId: payload.tenantId },
      select: { id: true, status: true },
    });

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    if (device.status !== 'ACTIVE') {
      throw new ValidationError(`Device is not active (status: ${device.status}). Call requests can only be sent to active devices.`);
    }

    // Auto-generate idempotency key if not provided
    const idempotencyKey = data.idempotencyKey ?? crypto.randomBytes(16).toString('hex');

    // Check idempotency — if a request with this key already exists, return it
    const existing = await db.callRequest.findUnique({
      where: { idempotencyKey },
      select: callRequestSelect,
    });

    if (existing) {
      return NextResponse.json(success(existing, 'Call request already exists (idempotent)'));
    }

    // Default expiry: 5 minutes
    const expiresInSeconds = data.expiresInSeconds ?? 300;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    const callRequest = await db.callRequest.create({
      data: {
        tenantId: payload.tenantId,
        deviceId: data.deviceId,
        requestedBy: payload.userId,
        leadId: data.leadId ?? null,
        contactId: data.contactId ?? null,
        dealId: data.dealId ?? null,
        phoneNumber: data.phoneNumber,
        contactName: data.contactName ?? null,
        idempotencyKey,
        status: 'PENDING',
        priority: data.priority ?? 0,
        expiresAt,
        metadata: (data.metadata ?? {}) as any,
      },
      select: callRequestSelect,
    });

    // Broadcast new call request via SSE to the tenant
    sseManager.broadcastToTenant(payload.tenantId, 'call_request.created', {
      id: callRequest.id,
      deviceId: data.deviceId,
      phoneNumber: data.phoneNumber,
      status: 'PENDING',
      priority: callRequest.priority,
      expiresAt: callRequest.expiresAt,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'call_request.create',
      targetType: 'CallRequest',
      targetId: callRequest.id,
      metadata: { deviceId: data.deviceId, phoneNumber: data.phoneNumber, idempotencyKey },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(callRequest, 'Call request created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
