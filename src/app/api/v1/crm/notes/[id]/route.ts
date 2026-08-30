import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const updateNoteSchema = z.object({
  content: z.string().trim().min(1).max(10000),
});

// ============================================
// SHARED HELPERS
// ============================================

const noteSelect = {
  id: true,
  content: true,
  userId: true,
  leadId: true,
  contactId: true,
  companyId: true,
  dealId: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
} as const;

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

// ============================================
// GET /api/v1/crm/notes/:id
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

    await requirePermission(payload.roleCode ?? null, 'notes.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const note = await db.note.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: noteSelect,
    });

    if (!note) {
      throw new NotFoundError('Note not found');
    }

    return NextResponse.json(success(note));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PUT /api/v1/crm/notes/:id
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

    await requirePermission(payload.roleCode ?? null, 'notes.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.note.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Note not found');
    }

    const body = await request.json();
    const data = validate(updateNoteSchema, body);

    const note = await db.note.update({
      where: { id },
      data: { content: data.content },
      select: noteSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'note.update',
      targetType: 'Note',
      targetId: id,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(note, 'Note updated successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/crm/notes/:id
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

    await requirePermission(payload.roleCode ?? null, 'notes.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.note.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Note not found');
    }

    await db.note.delete({
      where: { id },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'note.delete',
      targetType: 'Note',
      targetId: id,
      metadata: { contentPreview: existing.content.substring(0, 100) },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Note deleted successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
