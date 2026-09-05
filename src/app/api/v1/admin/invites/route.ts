import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { requirePermission } from '@/lib/rbac';
import { db } from '@/lib/db';
import { z } from 'zod';
import { enforceSeatLimit } from '@/lib/billing';
import { sendInvitationEmail } from '@/lib/email';
import { env } from '@/lib/env';

const createInviteSchema = z.object({
  email: z.string().trim().email('Invalid email format'),
  roleCode: z.enum(['ADMIN', 'MANAGER', 'SALES_MANAGER', 'SALES_EXECUTIVE', 'TELECALLER', 'HR_MANAGER', 'HR_EXECUTIVE', 'FIELD_MANAGER', 'FIELD_EXECUTIVE', 'ACCOUNTANT', 'VIEWER']).default('VIEWER'),
  name: z.string().trim().max(200).optional(),
});

/**
 * POST /api/v1/admin/invites - Invite a user to the tenant
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'No tenant context' },
        { status: 400 }
      );
    }

    await requirePermission(auth.roleCode ?? null, 'users.create', auth.tenantId, auth.isSuperAdmin);

    const body = await request.json();
    const { email, roleCode, name } = createInviteSchema.parse(body);

    // Check if user already exists in this tenant
    const existingUser = await db.user.findUnique({
      where: { email },
      include: { memberships: { where: { tenantId: auth.tenantId } } },
    });

    if (existingUser && existingUser.memberships.length > 0) {
      return NextResponse.json(
        { success: false, error: 'User is already a member of this organization', code: 'CONFLICT' },
        { status: 409 }
      );
    }

    // Enforce seat limit
    const seatCheck = await enforceSeatLimit(auth.tenantId);
    if (!seatCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Seat limit reached (${seatCheck.current}/${seatCheck.max}). Upgrade your plan to add more users.`,
          code: 'SEAT_LIMIT',
          current: seatCheck.current,
          max: seatCheck.max,
        },
        { status: 403 }
      );
    }

    // Get tenant name for the invite email
    const tenant = await db.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { name: true },
    });

    // If user already exists on platform, add them directly
    if (existingUser) {
      const membership = await db.membership.create({
        data: {
          userId: existingUser.id,
          tenantId: auth.tenantId,
          roleCode,
          status: 'ACTIVE',
          invitedBy: auth.userId,
        },
      });

      return NextResponse.json(
        success({ membership, message: 'Existing user added to organization' }, 'User added successfully'),
        { status: 201 }
      );
    }

    // Create a pending membership as an invite token
    // We need a placeholder userId - use a random UUID that will be replaced on signup
    const placeholderUserId = crypto.randomUUID();

    const membership = await db.membership.create({
      data: {
        userId: placeholderUserId,
        tenantId: auth.tenantId,
        roleCode,
        status: 'PENDING',
        invitedBy: auth.userId,
      },
    });

    // Send invitation email
    const baseUrl = env.APP_URL || 'https://hubspherev3.vercel.app';
    const inviteUrl = `${baseUrl}/signup?invite=${membership.id}`;

    const inviterName = auth.email; // We don't have the user's name in JWT
    await sendInvitationEmail(email, inviterName, tenant?.name || 'Organization', inviteUrl);

    return NextResponse.json(
      success({
        inviteId: membership.id,
        email,
        roleCode,
        message: 'Invitation sent. The user will be added when they sign up.'
      }, 'Invitation sent'),
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/v1/admin/invites - List pending invitations
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'No tenant context' },
        { status: 400 }
      );
    }

    await requirePermission(auth.roleCode ?? null, 'users.view', auth.tenantId, auth.isSuperAdmin);

    const invites = await db.membership.findMany({
      where: { tenantId: auth.tenantId, status: 'PENDING' },
      select: {
        id: true,
        roleCode: true,
        invitedBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json(success({ invites }));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
