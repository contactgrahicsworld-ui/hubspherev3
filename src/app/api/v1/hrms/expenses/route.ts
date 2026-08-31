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

const createExpenseSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID format'),
  amount: z.number().min(0, 'Amount must be non-negative'),
  date: z.string().min(1, 'Date is required'),
  category: z.string().trim().min(1, 'Category is required').max(100),
  description: z.string().max(5000).optional(),
  receiptUrl: z.string().max(1000).optional(),
  receiptSize: z.number().int().min(0).optional(),
});

type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

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
// GET /api/v1/hrms/expenses — List expenses
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'expenses.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (category) where.category = category;

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.date = dateFilter;
    }

    const validSortFields = ['createdAt', 'updatedAt', 'date', 'amount', 'status', 'category'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        select: expenseSelect,
      }),
      db.expense.count({ where }),
    ]);

    return NextResponse.json(paginated(expenses, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/hrms/expenses — Create expense
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'expenses.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createExpenseSchema, body);

    if (data.employeeId) {
      const employee = await db.employee.findFirst({ where: { id: data.employeeId, tenantId: payload.tenantId, archived: false } });
      if (!employee) {
        throw new NotFoundError('Employee not found');
      }
    }

    const expense = await db.expense.create({
      data: {
        tenantId: payload.tenantId,
        employeeId: data.employeeId,
        amount: data.amount,
        date: new Date(data.date),
        category: data.category,
        description: data.description ?? null,
        receiptUrl: data.receiptUrl ?? null,
        receiptSize: data.receiptSize ?? null,
        status: 'PENDING',
      },
      select: expenseSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'expense.create',
      targetType: 'Expense',
      targetId: expense.id,
      metadata: {
        employeeId: data.employeeId,
        amount: data.amount,
        category: data.category,
        date: data.date,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(expense, 'Expense created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
