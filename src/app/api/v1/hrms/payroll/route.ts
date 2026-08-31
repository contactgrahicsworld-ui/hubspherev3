import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
} from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
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

const createPayrollSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID format'),
  periodStart: z.string().min(1, 'Period start is required'),
  periodEnd: z.string().min(1, 'Period end is required'),
  basicSalary: z.number().min(0, 'Basic salary must be non-negative'),
  totalAllowances: z.number().min(0).optional(),
  totalDeductions: z.number().min(0).optional(),
  overtimePay: z.number().min(0).optional(),
  bonus: z.number().optional(),
  currency: z.string().trim().max(10).optional(),
  notes: z.string().max(5000).optional(),
});

type CreatePayrollInput = z.infer<typeof createPayrollSchema>;

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
} as const;

// ============================================
// GET /api/v1/hrms/payroll — List payroll records
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'payroll.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');
    const sortBy = searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    if (periodStart) {
      where.periodStart = { gte: new Date(periodStart) };
    }
    if (periodEnd) {
      where.periodEnd = { lte: new Date(periodEnd) };
    }

    const validSortFields = ['createdAt', 'updatedAt', 'periodStart', 'periodEnd', 'netSalary', 'status'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [records, total] = await Promise.all([
      db.payrollRecord.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        select: payrollSelect,
      }),
      db.payrollRecord.count({ where }),
    ]);

    return NextResponse.json(paginated(records, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/hrms/payroll — Create payroll record
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'payroll.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createPayrollSchema, body);

    if (data.employeeId) {
      const employee = await db.employee.findFirst({ where: { id: data.employeeId, tenantId: payload.tenantId, archived: false } });
      if (!employee) {
        throw new NotFoundError('Employee not found');
      }
    }

    // Calculate net salary
    const netSalary =
      data.basicSalary +
      (data.totalAllowances ?? 0) +
      (data.overtimePay ?? 0) +
      (data.bonus ?? 0) -
      (data.totalDeductions ?? 0);

    const record = await db.payrollRecord.create({
      data: {
        tenantId: payload.tenantId,
        employeeId: data.employeeId,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        basicSalary: data.basicSalary,
        totalAllowances: data.totalAllowances ?? 0,
        totalDeductions: data.totalDeductions ?? 0,
        overtimePay: data.overtimePay ?? 0,
        bonus: data.bonus ?? 0,
        netSalary,
        currency: data.currency ?? 'INR',
        notes: data.notes ?? null,
        createdBy: payload.userId,
      },
      select: payrollSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'payroll.create',
      targetType: 'PayrollRecord',
      targetId: record.id,
      metadata: {
        employeeId: data.employeeId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        netSalary,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(record, 'Payroll record created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
