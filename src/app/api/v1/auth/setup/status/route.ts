import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { success } from '@/lib/api-response';
import { handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    const superAdmin = await db.user.findFirst({
      where: { isSuperAdmin: true },
      select: { id: true },
    });

    const superAdminExists = !!superAdmin;
    const setupComplete = superAdminExists;

    return NextResponse.json(
      success({ setupComplete, superAdminExists })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
