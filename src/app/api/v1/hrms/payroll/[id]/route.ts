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

const updatePayrollSchema = z.object({
  basicSalary: z.number().min(0).optional(),
  totalAllowances: z.number().min(0).optional(),
  totalDeductions: z.number().min(0).optional(),
  overtimePay: z.number().min(0).optional(),
  bonus: z.number().optional(),
  currency: z.string().trim().max(10).optional(),
  notes: z.string().max(5000).nullable().optional(),
  paymentMethod: z.string().trim().max(50).nullable().optional(),
  paymentRef: z.string().trim().max(200).nullable().optional(),
  status: z.enum(['DRAFT', 'PROCESSING', 'FINALIZED', 'PAID', 'CANCELLED']).optional(),
});

// ============================================
// SHARED SELECT
// ============================================

const payrollSelect = {
  id: true,
  tenantId: true,
  employeeId: true,
  periodStart: true,
  periodEnd: true,
  basicSalary: true,
  totalAllowances: true,
  totalDeductions: true,
  overtimePay: true,
  bonus: true,
  netSalary: true,
  currency: true,
  status: true,
  paymentMethod: true,
  paymentRef: true,
  paidAt: true,
  notes: true,
  createdBy: true,
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
  creator: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  items: {
    select: {
      id: true,
      type: true,
      name: true,
      amount: true,
      description: true,
    },
  },
  bankTransfers: {
    select: {
      id: true,
      amount: true,
      bankName: true,
      accountNumber: true,
      ifscCode: true,
      accountHolder: true,
      status: true,
      transactionRef: true,
      initiatedAt: true,
      completedAt: true,
      failureReason: true,
    },
  },
} as const;

// ============================================
// GET /api/v1/hrms/payroll/:id
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

    await requirePermission(payload.roleCode ?? null, 'payroll.view', payload.tenantId);

    const { id } = await params;

    const record = await db.payrollRecord.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: payrollSelect,
    });

    if (!record) {
      throw new NotFoundError('Payroll record not found');
    }

    return NextResponse.json(success(record));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PUT /api/v1/hrms/payroll/:id
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

    const { id } = await params;

    const existing = await db.payrollRecord.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Payroll record not found');
    }

    const body = await request.json();
    const data = validate(updatePayrollSchema, body);

    // If status change, require appropriate permission
    if (data.status && data.status !== existing.status) {
      const statusPermissionMap: Record<string, string> = {
        PROCESSING: 'payroll.edit',
        FINALIZED: 'payroll.edit',
        PAID: 'payroll.edit',
        CANCELLED: 'payroll.edit',
      };
      const perm = statusPermissionMap[data.status];
      if (perm) {
        await requirePermission(payload.roleCode ?? null, perm, payload.tenantId);
      }
    } else {
      await requirePermission(payload.roleCode ?? null, 'payroll.edit', payload.tenantId);
    }

    const updateData: Record<string, unknown> = {};

    if (data.basicSalary !== undefined) updateData.basicSalary = data.basicSalary;
    if (data.totalAllowances !== undefined) updateData.totalAllowances = data.totalAllowances;
    if (data.totalDeductions !== undefined) updateData.totalDeductions = data.totalDeductions;
    if (data.overtimePay !== undefined) updateData.overtimePay = data.overtimePay;
    if (data.bonus !== undefined) updateData.bonus = data.bonus;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.paymentRef !== undefined) updateData.paymentRef = data.paymentRef;

    // Recalculate net salary if any financial field changed
    if (
      data.basicSalary !== undefined ||
      data.totalAllowances !== undefined ||
      data.totalDeductions !== undefined ||
      data.overtimePay !== undefined ||
      data.bonus !== undefined
    ) {
      const basic = data.basicSalary ?? existing.basicSalary;
      const allowances = data.totalAllowances ?? existing.totalAllowances;
      const deductions = data.totalDeductions ?? existing.totalDeductions;
      const overtime = data.overtimePay ?? existing.overtimePay;
      const bonusVal = data.bonus ?? existing.bonus;
      updateData.netSalary = basic + allowances + overtime + bonusVal - deductions;
    }

    // Handle status changes
    if (data.status && data.status !== existing.status) {
      updateData.status = data.status;

      if (data.status === 'PAID') {
        updateData.paidAt = new Date();
      }
    }

    const record = await db.payrollRecord.update({
      where: { id },
      data: updateData,
      select: payrollSelect,
    });

    // Audit status changes separately
    if (data.status && data.status !== existing.status) {
      await createAuditLog({
        actorId: payload.userId,
        tenantId: payload.tenantId,
        action: `payroll.status_change`,
        targetType: 'PayrollRecord',
        targetId: id,
        metadata: { previousStatus: existing.status, newStatus: data.status },
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
    } else {
      await createAuditLog({
        actorId: payload.userId,
        tenantId: payload.tenantId,
        action: 'payroll.update',
        targetType: 'PayrollRecord',
        targetId: id,
        metadata: Object.keys(updateData),
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
    }

    return NextResponse.json(
      success(record, 'Payroll record updated successfully'),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
