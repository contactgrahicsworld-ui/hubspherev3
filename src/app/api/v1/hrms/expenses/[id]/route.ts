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
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().max(5000).optional(),
});

// ============================================
// SHARED SELECT
// ============================================

const expenseSelect = {
  id: true,
  tenantId: true,
  employeeId: true,
  amount: true,
  date: true,
  category: true,
  description: true,
  receiptUrl: true,
  receiptSize: true,
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
  approver: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
} as const;

// ============================================
// PUT /api/v1/hrms/expenses/:id — Approve/Reject
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
      await requirePermission(payload.roleCode ?? null, 'expenses.approve', payload.tenantId);
    } else {
      await requirePermission(payload.roleCode ?? null, 'expenses.reject', payload.tenantId);
    }

    const { id } = await params;

    const existing = await db.expense.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Expense not found');
    }

    if (existing.status !== 'PENDING') {
      throw new ValidationError(`Cannot ${data.action.toLowerCase()} an expense that is not pending`);
    }

    let updateData: Record<string, unknown>;
    let auditAction: string;

    if (data.action === 'APPROVE') {
      updateData = {
        status: 'APPROVED',
        approvedBy: payload.userId,
        approvedAt: new Date(),
      };
      auditAction = 'expense.approve';
    } else {
      updateData = {
        status: 'REJECTED',
        rejectionReason: data.rejectionReason ?? null,
      };
      auditAction = 'expense.reject';
    }

    const expense = await db.expense.update({
      where: { id },
      data: updateData,
      select: expenseSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: auditAction,
      targetType: 'Expense',
      targetId: id,
      metadata: { action: data.action, amount: existing.amount, category: existing.category, rejectionReason: data.rejectionReason },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    const actionMessages: Record<string, string> = {
      APPROVE: 'Expense approved',
      REJECT: 'Expense rejected',
    };

    return NextResponse.json(
      success(expense, actionMessages[data.action]),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
