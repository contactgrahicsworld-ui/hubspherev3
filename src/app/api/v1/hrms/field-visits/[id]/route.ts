import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// HELPERS
// ============================================

function isDbError(error: unknown) {
  return error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'));
}

function dbUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
    { status: 503 },
  );
}

// ============================================
// SCHEMAS
// ============================================

const updateFieldVisitSchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  purpose: z.string().max(5000).optional(),
  outcome: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
  status: z.string().trim().max(50).optional(),
  location: z.record(z.string(), z.unknown()).nullable().optional(),
  nextFollowUp: z.string().nullable().optional(),
});

// ============================================
// SHARED SELECT
// ============================================

const fieldVisitSelect = {
  id: true,
  tenantId: true,
  employeeId: true,
  leadId: true,
  contactId: true,
  date: true,
  startTime: true,
  endTime: true,
  purpose: true,
  outcome: true,
  notes: true,
  status: true,
  location: true,
  nextFollowUp: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
    },
  },
  lead: {
    select: { id: true, firstName: true, lastName: true, company: true },
  },
  contact: {
    select: { id: true, firstName: true, lastName: true, email: true, company: { select: { name: true } } },
  },
} as const;

// ============================================
// GET /api/v1/hrms/field-visits/:id
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

    await requirePermission(payload.roleCode ?? null, 'visits.view', payload.tenantId);

    const { id } = await params;

    const visit = await db.fieldVisit.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: fieldVisitSelect,
    });

    if (!visit) {
      throw new NotFoundError('Field visit not found');
    }

    return NextResponse.json(success(visit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PUT /api/v1/hrms/field-visits/:id
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'visits.edit', payload.tenantId);

    const { id } = await params;

    const existing = await db.fieldVisit.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Field visit not found');
    }

    const body = await request.json();
    const data = validate(updateFieldVisitSchema, body);

    const updateData: Record<string, unknown> = {};
    if (data.startTime !== undefined) updateData.startTime = data.startTime ? new Date(data.startTime) : null;
    if (data.endTime !== undefined) updateData.endTime = data.endTime ? new Date(data.endTime) : null;
    if (data.purpose !== undefined) updateData.purpose = data.purpose ?? null;
    if (data.outcome !== undefined) updateData.outcome = data.outcome ?? null;
    if (data.notes !== undefined) updateData.notes = data.notes ?? null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.nextFollowUp !== undefined) updateData.nextFollowUp = data.nextFollowUp ? new Date(data.nextFollowUp) : null;

    const visit = await db.fieldVisit.update({
      where: { id },
      data: updateData,
      select: fieldVisitSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'field_visit.update',
      targetType: 'FieldVisit',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(visit, 'Field visit updated successfully'),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
