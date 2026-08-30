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

const updateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(200).optional(),
  lastName: z.string().trim().max(200).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  mobile: z.string().trim().max(30).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  designationId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  joiningDate: z.string().datetime({ offset: true }).optional().or(z.string().datetime().optional()),
  employmentStatus: z.string().trim().max(50).optional(),
  workLocation: z.string().trim().max(300).optional(),
  basicSalary: z.number().min(0).nullable().optional(),
  salaryCurrency: z.string().trim().max(10).optional(),
  emergencyName: z.string().trim().max(200).nullable().optional(),
  emergencyPhone: z.string().trim().max(30).nullable().optional(),
  emergencyRelation: z.string().trim().max(100).nullable().optional(),
});

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
// GET /api/v1/hrms/employees/:id
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

    await requirePermission(payload.roleCode ?? null, 'employees.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const employee = await db.employee.findFirst({
      where: {
        id,
        tenantId: payload.tenantId,
        archived: false,
      },
      select: employeeSelect,
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    return NextResponse.json(success(employee));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PUT /api/v1/hrms/employees/:id
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

    await requirePermission(payload.roleCode ?? null, 'employees.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.employee.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!existing) {
      throw new NotFoundError('Employee not found');
    }

    const body = await request.json();
    const data = validate(updateEmployeeSchema, body);

    const updateData: Record<string, unknown> = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName ?? null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.mobile !== undefined) updateData.mobile = data.mobile ?? null;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.designationId !== undefined) updateData.designationId = data.designationId;
    if (data.managerId !== undefined) updateData.managerId = data.managerId;
    if (data.joiningDate !== undefined) updateData.joiningDate = data.joiningDate ? new Date(data.joiningDate) : null;
    if (data.employmentStatus !== undefined) updateData.employmentStatus = data.employmentStatus;
    if (data.workLocation !== undefined) updateData.workLocation = data.workLocation ?? null;
    if (data.basicSalary !== undefined) updateData.basicSalary = data.basicSalary;
    if (data.salaryCurrency !== undefined) updateData.salaryCurrency = data.salaryCurrency;
    if (data.emergencyName !== undefined) updateData.emergencyName = data.emergencyName;
    if (data.emergencyPhone !== undefined) updateData.emergencyPhone = data.emergencyPhone;
    if (data.emergencyRelation !== undefined) updateData.emergencyRelation = data.emergencyRelation;

    const employee = await db.employee.update({
      where: { id },
      data: updateData,
      select: employeeSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'employee.update',
      targetType: 'Employee',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(employee, 'Employee updated successfully'),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/hrms/employees/:id — Archive
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

    await requirePermission(payload.roleCode ?? null, 'employees.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.employee.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!existing) {
      throw new NotFoundError('Employee not found');
    }

    await db.employee.update({
      where: { id },
      data: { archived: true },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'employee.archive',
      targetType: 'Employee',
      targetId: id,
      metadata: { firstName: existing.firstName, lastName: existing.lastName, employeeId: existing.employeeId },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Employee archived successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
