/**
 * Call Request by ID API
 * GET    /api/v1/call-requests/:id — Get call request by ID
 * PATCH  /api/v1/call-requests/:id — Update call request status
 * DELETE /api/v1/call-requests/:id — Cancel a PENDING call request
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { sseManager } from '@/lib/telecalling/sse-manager';
import { validate } from '@/lib/validators';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const updateCallRequestSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'CANCELLED']),
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
// GET /api/v1/call-requests/:id
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

    await requirePermission(payload.roleCode ?? null, 'call_requests.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const callRequest = await db.callRequest.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: callRequestSelect,
    });

    if (!callRequest) {
      throw new NotFoundError('Call request not found');
    }

    return NextResponse.json(success(callRequest));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PATCH /api/v1/call-requests/:id — Update call request status
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

    await requirePermission(payload.roleCode ?? null, 'call_requests.update', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    // Verify call request exists and belongs to tenant
    const existing = await db.callRequest.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: { id: true, status: true, deviceId: true },
    });

    if (!existing) {
      throw new NotFoundError('Call request not found');
    }

    const body = await request.json();
    const data = validate(updateCallRequestSchema, body);

    // Validate status transition
    if (existing.status !== 'PENDING') {
      throw new ValidationError(`Call request cannot be updated (current status: ${existing.status}). Only PENDING requests can be updated.`);
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: data.status,
    };

    if (data.status === 'ACCEPTED') {
      updateData.acceptedAt = new Date();
    }

    if (data.status === 'CANCELLED') {
      updateData.completedAt = new Date();
    }

    const updated = await db.callRequest.update({
      where: { id },
      data: updateData,
      select: callRequestSelect,
    });

    // Broadcast status change via SSE
    sseManager.broadcastToTenant(payload.tenantId, 'call_request.status_change', {
      id,
      previousStatus: existing.status,
      newStatus: data.status,
      deviceId: existing.deviceId,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: `call_request.${data.status.toLowerCase()}`,
      targetType: 'CallRequest',
      targetId: id,
      metadata: { previousStatus: existing.status, newStatus: data.status },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(updated, `Call request ${data.status.toLowerCase()} successfully`));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/call-requests/:id — Cancel a PENDING call request
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

    await requirePermission(payload.roleCode ?? null, 'call_requests.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    // Verify call request exists, belongs to tenant, and is PENDING
    const existing = await db.callRequest.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: { id: true, status: true, deviceId: true },
    });

    if (!existing) {
      throw new NotFoundError('Call request not found');
    }

    if (existing.status !== 'PENDING') {
      throw new ValidationError(`Call request cannot be cancelled (current status: ${existing.status}). Only PENDING requests can be cancelled.`);
    }

    // Update status to CANCELLED
    const updated = await db.callRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
      select: callRequestSelect,
    });

    // Broadcast cancellation via SSE
    sseManager.broadcastToTenant(payload.tenantId, 'call_request.status_change', {
      id,
      previousStatus: 'PENDING',
      newStatus: 'CANCELLED',
      deviceId: existing.deviceId,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'call_request.cancel',
      targetType: 'CallRequest',
      targetId: id,
      metadata: { previousStatus: 'PENDING', newStatus: 'CANCELLED' },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(updated, 'Call request cancelled successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
