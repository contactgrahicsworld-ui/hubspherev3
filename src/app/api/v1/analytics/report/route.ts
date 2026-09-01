import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';

// ============================================
// HELPERS
// ============================================

function isDbError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
  );
}

const VALID_MODULES = [
  'leads',
  'contacts',
  'companies',
  'deals',
  'employees',
  'calls',
  'attendance',
] as const;

type ReportModule = (typeof VALID_MODULES)[number];

// Default fields per module for CSV export
const MODULE_DEFAULT_FIELDS: Record<ReportModule, string[]> = {
  leads: ['id', 'firstName', 'lastName', 'email', 'mobile', 'source', 'status', 'priority', 'value', 'createdAt'],
  contacts: ['id', 'firstName', 'lastName', 'email', 'mobile', 'phone', 'title', 'createdAt'],
  companies: ['id', 'name', 'industry', 'website', 'email', 'phone', 'city', 'state', 'createdAt'],
  deals: ['id', 'title', 'value', 'currency', 'stage', 'probability', 'expectedCloseDate', 'createdAt'],
  employees: ['id', 'employeeId', 'firstName', 'lastName', 'email', 'mobile', 'employmentStatus', 'workLocation', 'createdAt'],
  calls: ['id', 'direction', 'callType', 'callStatus', 'duration', 'callStartTime', 'callEndTime', 'createdAt'],
  attendance: ['id', 'date', 'checkInTime', 'checkOutTime', 'status', 'workingMinutes', 'lateMinutes', 'createdAt'],
};

// DB select fields mapped to CSV field names
// CSV fields use camelCase, DB fields use snake_case mapped by Prisma
function buildPrismaSelect(
  module: ReportModule,
  fields: string[],
): Record<string, boolean> {
  const select: Record<string, boolean> = {};
  for (const field of fields) {
    select[field] = true;
  }
  // Always include tenantId for safety (stripped from output)
  select['tenantId'] = true;
  return select;
}

function buildDateFilter(
  dateFrom: string | null,
  dateTo: string | null,
  module: ReportModule,
): Record<string, { gte?: Date; lte?: Date }> {
  const filter: Record<string, { gte?: Date; lte?: Date }> = {};

  // Attendance uses 'date', calls use 'callStartTime', rest use 'createdAt'
  let dateField = 'createdAt';
  if (module === 'attendance') dateField = 'date';
  if (module === 'calls') dateField = 'callStartTime';

  if (dateFrom) filter[dateField] = { ...filter[dateField], gte: new Date(dateFrom) };
  if (dateTo) filter[dateField] = { ...filter[dateField], lte: new Date(dateTo) };
  return filter;
}

function toCSVRow(record: Record<string, unknown>, fields: string[]): string {
  return fields
    .map((field) => {
      const val = record[field];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape CSV: if value contains comma, quote, or newline, wrap in quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(',');
}

function formatFilename(module: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${module}_report_${today}.csv`;
}

// ============================================
// GET /api/v1/analytics/report — CSV Export
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    const { searchParams } = new URL(request.url);
    const moduleName = searchParams.get('module');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const format = searchParams.get('format');
    const fieldsParam = searchParams.get('fields');

    // Validate module
    if (!moduleName || !VALID_MODULES.includes(moduleName as ReportModule)) {
      throw new ValidationError(
        `Invalid module. Must be one of: ${VALID_MODULES.join(', ')}`
      );
    }

    const reportModule = moduleName as ReportModule;

    // Validate format (only CSV supported for now)
    if (format && format !== 'csv') {
      throw new ValidationError('Only CSV format is currently supported');
    }

    // RBAC check — module-specific export permission
    await requirePermission(payload.roleCode ?? null, `${reportModule}.export`, payload.tenantId, payload.isSuperAdmin);

    // Resolve fields — whitelist against allowed module fields only
    const allowedFields = MODULE_DEFAULT_FIELDS[reportModule];
    const resolvedFields = fieldsParam
      ? fieldsParam.split(',').map((f) => f.trim()).filter((f) => f.length > 0 && allowedFields.includes(f))
      : allowedFields;

    // Validate that at least some fields remain after whitelist
    if (resolvedFields.length === 0) {
      throw new ValidationError('No valid fields specified for export');
    }

    // Build query
    const tenantId = payload.tenantId;
    const dateFilter = buildDateFilter(dateFrom, dateTo, reportModule);
    const select = buildPrismaSelect(reportModule, resolvedFields);

    // Query the appropriate model
    let records: Record<string, unknown>[];

    switch (reportModule) {
      case 'leads':
        records = await db.lead.findMany({
          where: { tenantId, archived: false, ...dateFilter },
          select,
          orderBy: { createdAt: 'desc' },
        });
        break;
      case 'contacts':
        records = await db.contact.findMany({
          where: { tenantId, archived: false, ...dateFilter },
          select,
          orderBy: { createdAt: 'desc' },
        });
        break;
      case 'companies':
        records = await db.company.findMany({
          where: { tenantId, archived: false, ...dateFilter },
          select,
          orderBy: { createdAt: 'desc' },
        });
        break;
      case 'deals':
        records = await db.deal.findMany({
          where: { tenantId, archived: false, ...dateFilter },
          select,
          orderBy: { createdAt: 'desc' },
        });
        break;
      case 'employees':
        records = await db.employee.findMany({
          where: { tenantId, archived: false, ...dateFilter },
          select,
          orderBy: { createdAt: 'desc' },
        });
        break;
      case 'calls':
        records = await db.call.findMany({
          where: { tenantId, ...dateFilter },
          select,
          orderBy: { createdAt: 'desc' },
        });
        break;
      case 'attendance':
        records = await db.attendanceSession.findMany({
          where: { tenantId, ...dateFilter },
          select,
          orderBy: { date: 'desc' },
        });
        break;
      default:
        throw new ValidationError(`Unknown module: ${reportModule}`);
    }

    // Build CSV — strip tenantId from output even if somehow present
    const outputFields = resolvedFields.filter((f) => f !== 'tenantId');
    const csvHeader = outputFields.join(',');
    const csvRows = records.map((record) => toCSVRow(record, outputFields));
    const csvContent = [csvHeader, ...csvRows].join('\n');

    const filename = formatFilename(reportModule);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (isDbError(error)) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
