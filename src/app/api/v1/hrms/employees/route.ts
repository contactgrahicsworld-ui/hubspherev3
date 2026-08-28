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

const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(200),
  lastName: z.string().trim().max(200).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  mobile: z.string().trim().max(30).optional(),
  userId: z.string().uuid('Invalid user ID format'),
  employeeId: z.string().trim().min(1, 'Employee ID is required').max(50),
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  joiningDate: z.string().datetime({ offset: true }).optional().or(z.string().datetime().optional()),
  employmentStatus: z.string().trim().max(50).optional(),
  workLocation: z.string().trim().max(300).optional(),
  basicSalary: z.number().min(0).optional(),
  salaryCurrency: z.string().trim().max(10).optional(),
  emergencyName: z.string().trim().max(200).optional(),
  emergencyPhone: z.string().trim().max(30).optional(),
  emergencyRelation: z.string().trim().max(100).optional(),
});

type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// ============================================
// SHARED SELECT
// ============================================

const employeeSelect = {
  id: true,
  tenantId: true,
  userId: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  email: true,
  mobile: true,
  departmentId: true,
  designationId: true,
  managerId: true,
  joiningDate: true,
  employmentStatus: true,
  workLocation: true,
  basicSalary: true,
  salaryCurrency: true,
  emergencyName: true,
  emergencyPhone: true,
  emergencyRelation: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: { id: true, name: true },
  },
  designation: {
    select: { id: true, title: true },
  },
  manager: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  user: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
} as const;

// ============================================
// GET /api/v1/hrms/employees — List employees
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'employees.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const search = searchParams.get('search') ?? '';
    const departmentId = searchParams.get('departmentId');
    const designationId = searchParams.get('designationId');
    const employmentStatus = searchParams.get('employmentStatus');
    const managerId = searchParams.get('managerId');
    const sortBy = searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
      archived: false,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) where.departmentId = departmentId;
    if (designationId) where.designationId = designationId;
    if (employmentStatus) where.employmentStatus = employmentStatus;
    if (managerId) where.managerId = managerId;

    const validSortFields = ['createdAt', 'updatedAt', 'firstName', 'employeeId', 'employmentStatus', 'joiningDate'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        select: employeeSelect,
      }),
      db.employee.count({ where }),
    ]);

    return NextResponse.json(paginated(employees, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/hrms/employees — Create employee
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'employees.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createEmployeeSchema, body);

    // Verify the user exists
    const userExists = await db.user.findUnique({
      where: { id: data.userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new NotFoundError('User not found');
    }

    const employee = await db.employee.create({
      data: {
        tenantId: payload.tenantId,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        email: data.email || null,
        mobile: data.mobile ?? null,
        userId: data.userId,
        employeeId: data.employeeId,
        departmentId: data.departmentId ?? null,
        designationId: data.designationId ?? null,
        managerId: data.managerId ?? null,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
        employmentStatus: data.employmentStatus ?? 'ACTIVE',
        workLocation: data.workLocation ?? null,
        basicSalary: data.basicSalary ?? null,
        salaryCurrency: data.salaryCurrency ?? 'INR',
        emergencyName: data.emergencyName ?? null,
        emergencyPhone: data.emergencyPhone ?? null,
        emergencyRelation: data.emergencyRelation ?? null,
      },
      select: employeeSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'employee.create',
      targetType: 'Employee',
      targetId: employee.id,
      metadata: {
        firstName: data.firstName,
        lastName: data.lastName,
        employeeId: data.employeeId,
        email: data.email,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(employee, 'Employee created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
