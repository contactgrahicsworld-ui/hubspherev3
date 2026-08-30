import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
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

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'CANCEL']),
  rejectionReason: z.string().max(5000).optional(),
});

// ============================================
// SHARED SELECT
// ============================================

const leaveRequestSelect = {
  id: true,
  tenantId: true,
  employeeId: true,
  leaveTypeId: true,
  startDate: true,
  endDate: true,
  totalDays: true,
  reason: true,
  status: true,
  approvedBy: true,
  approvedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      designation: { select: { title: true } },
    },
  },
  leaveType: {
    select: { id: true, name: true, code: true, paid: true },
  },
  approver: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
} as const;

// ============================================
// PUT /api/v1/hrms/leave-requests/:id — Approve/Reject/Cancel
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

    const body = await request.json();
    const data = validate(actionSchema, body);

    // Check permissions based on action
    if (data.action === 'APPROVE') {
      await requirePermission(payload.roleCode ?? null, 'leave.approve', payload.tenantId, payload.isSuperAdmin);
    } else if (data.action === 'REJECT') {
      await requirePermission(payload.roleCode ?? null, 'leave.reject', payload.tenantId, payload.isSuperAdmin);
    } else {
      await requirePermission(payload.roleCode ?? null, 'leave.create', payload.tenantId, payload.isSuperAdmin);
    }

    const { id } = await params;

    const existing = await db.leaveRequest.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Leave request not found');
    }

    let updateData: Record<string, unknown> = {};
    let auditAction: string;

    switch (data.action) {
      case 'APPROVE':
        if (existing.status !== 'PENDING') {
          throw new ValidationError('Can only approve pending leave requests');
        }
        updateData = {
          status: 'APPROVED',
          approvedBy: payload.userId,
          approvedAt: new Date(),
        };
        auditAction = 'leave_request.approve';
        break;

      case 'REJECT':
        if (existing.status !== 'PENDING') {
          throw new ValidationError('Can only reject pending leave requests');
        }
        updateData = {
          status: 'REJECTED',
          approvedBy: payload.userId,
          approvedAt: new Date(),
          rejectionReason: data.rejectionReason ?? null,
        };
        auditAction = 'leave_request.reject';
        break;

      case 'CANCEL':
        if (existing.status !== 'PENDING') {
          throw new ValidationError('Can only cancel pending leave requests');
        }
        updateData = {
          status: 'CANCELLED',
        };
        auditAction = 'leave_request.cancel';
        break;
    }

    const leaveRequest = await db.leaveRequest.update({
      where: { id },
      data: updateData,
      select: leaveRequestSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: auditAction,
      targetType: 'LeaveRequest',
      targetId: id,
      metadata: { action: data.action, previousStatus: existing.status, rejectionReason: data.rejectionReason },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    const actionMessages: Record<string, string> = {
      APPROVE: 'Leave request approved',
      REJECT: 'Leave request rejected',
      CANCEL: 'Leave request cancelled',
    };

    return NextResponse.json(
      success(leaveRequest, actionMessages[data.action]),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
