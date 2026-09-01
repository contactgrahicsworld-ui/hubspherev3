import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, ValidationError, RateLimitError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// ============================================
// CONSTANTS
// ============================================

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CSV_ROWS = 10_000;
const ALLOWED_CONTENT_TYPES = [
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/csv',
];

// ============================================
// HELPERS
// ============================================

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

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        current.push(field.trim());
        field = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        current.push(field.trim());
        field = '';
        if (current.some((c) => c !== '')) {
          lines.push(current);
        }
        current = [];
        if (char === '\r') i++;
      } else {
        field += char;
      }
    }
  }

  // Push last field
  current.push(field.trim());
  if (current.some((c) => c !== '')) {
    lines.push(current);
  }

  return lines;
}

// ============================================
// POST /api/v1/crm/import — Import CSV
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entityType = (formData.get('entityType') as string)?.toLowerCase();

    // Rate limit: 5 imports per 15 minutes per user
    const { limited, retryAfterMs } = await rateLimit(`${payload.userId}:import`, 5, 15 * 60 * 1000);
    if (limited) {
      throw new RateLimitError('Too many import requests. Please try again later.', Math.ceil(retryAfterMs / 1000));
    }

    if (!file) {
      throw new ValidationError('File is required');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(`File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`);
    }

    // Validate content type
    if (!ALLOWED_CONTENT_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
      throw new ValidationError('Only CSV files are accepted');
    }

    if (!['leads', 'contacts', 'companies'].includes(entityType ?? '')) {
      throw new ValidationError('entityType must be leads, contacts, or companies');
    }

    await requirePermission(payload.roleCode ?? null, `${entityType}.create`, payload.tenantId, payload.isSuperAdmin);

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      throw new ValidationError('CSV must contain a header row and at least one data row');
    }

    if (rows.length > MAX_CSV_ROWS) {
      throw new ValidationError(`CSV has too many rows (${rows.length - 1} data rows). Maximum is ${MAX_CSV_ROWS}.`);
    }

    const headers = rows[0].map((h) => h.toLowerCase());
    const dataRows = rows.slice(1);
    const tenantId = payload.tenantId;
    const userId = payload.userId;

    let created = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    if (entityType === 'leads') {
      const batchData = dataRows.map((row, index) => {
        const record: Record<string, string | null> = {};
        headers.forEach((h, i) => {
          record[h] = row[i] || null;
        });

        if (!record['first name'] && !record['firstname'] && !record['first_name']) {
          errors.push({ row: index + 2, message: 'First name is required' });
          return null;
        }

        return {
          tenantId,
          firstName: (record['first name'] ?? record['firstname'] ?? record['first_name'])!,
          lastName: record['last name'] ?? record['lastname'] ?? record['last_name'] ?? null,
          email: record['email'] || null,
          mobile: record['mobile'] ?? record['phone'] ?? null,
          company: record['company'] ?? null,
          source: record['source'] ?? 'IMPORT',
          status: 'NEW',
          priority: 'MEDIUM',
        };
      });

      const validRecords = batchData.filter(Boolean) as NonNullable<(typeof batchData)[number]>[];

      if (validRecords.length > 0) {
        const result = await db.lead.createMany({ data: validRecords, skipDuplicates: true });
        created = result.count;
        skipped = validRecords.length - created;
      }
    } else if (entityType === 'contacts') {
      const batchData = dataRows.map((row, index) => {
        const record: Record<string, string | null> = {};
        headers.forEach((h, i) => {
          record[h] = row[i] || null;
        });

        if (!record['first name'] && !record['firstname'] && !record['first_name']) {
          errors.push({ row: index + 2, message: 'First name is required' });
          return null;
        }

        return {
          tenantId,
          firstName: (record['first name'] ?? record['firstname'] ?? record['first_name'])!,
          lastName: record['last name'] ?? record['lastname'] ?? record['last_name'] ?? null,
          email: record['email'] || null,
          mobile: record['mobile'] ?? null,
          phone: record['phone'] ?? null,
          title: record['title'] ?? null,
          ownerId: userId,
        };
      });

      const validRecords = batchData.filter(Boolean) as NonNullable<(typeof batchData)[number]>[];

      if (validRecords.length > 0) {
        const result = await db.contact.createMany({ data: validRecords, skipDuplicates: true });
        created = result.count;
        skipped = validRecords.length - created;
      }
    } else if (entityType === 'companies') {
      const batchData = dataRows.map((row, index) => {
        const record: Record<string, string | null> = {};
        headers.forEach((h, i) => {
          record[h] = row[i] || null;
        });

        if (!record['name']) {
          errors.push({ row: index + 2, message: 'Company name is required' });
          return null;
        }

        return {
          tenantId,
          name: record['name']!,
          industry: record['industry'] ?? null,
          website: record['website'] ?? null,
          email: record['email'] ?? null,
          phone: record['phone'] ?? null,
          address: record['address'] ?? null,
          city: record['city'] ?? null,
          state: record['state'] ?? null,
          country: record['country'] ?? null,
          ownerId: userId,
        };
      });

      const validRecords = batchData.filter(Boolean) as NonNullable<(typeof batchData)[number]>[];

      if (validRecords.length > 0) {
        const result = await db.company.createMany({ data: validRecords, skipDuplicates: true });
        created = result.count;
        skipped = validRecords.length - created;
      }
    }

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'import.csv',
      targetType: entityType,
      metadata: {
        fileName: file.name,
        totalRows: dataRows.length,
        created,
        skipped,
        errorCount: errors.length,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({ created, skipped, errors }, `Import completed for ${entityType}`),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
