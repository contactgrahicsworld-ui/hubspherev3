import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';

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
// GET /api/v1/crm/calls/:id
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

    await requirePermission(payload.roleCode ?? null, 'calls.view', payload.tenantId);

    const { id } = await params;

    const call = await db.call.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: callSelect,
    });

    if (!call) {
      throw new NotFoundError('Call not found');
    }

    return NextResponse.json(success(call));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
