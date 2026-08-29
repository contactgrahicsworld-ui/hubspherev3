import { NextResponse } from 'next/server';
import { db, isDatabaseConnected } from '@/lib/db';
import { success } from '@/lib/api-response';

export async function GET() {
  try {
    const dbConnected = await isDatabaseConnected();
    if (!dbConnected) {
      return NextResponse.json(
        {
          success: true,
          data: {
            setupComplete: false,
            superAdminExists: false,
            databaseUnavailable: true,
            message: 'Database is not available. Please configure PostgreSQL to complete setup.',
          },
        },
        { status: 503 }
      );
    }

    const superAdmin = await db.user.findFirst({
      where: { isSuperAdmin: true },
      select: { id: true },
    });

    const superAdminExists = !!superAdmin;
    const setupComplete = superAdminExists;

    return NextResponse.json(
      success({ setupComplete, superAdminExists })
    );
  } catch {
    return NextResponse.json(
      {
        success: true,
        data: {
          setupComplete: false,
          superAdminExists: false,
          databaseUnavailable: true,
          message: 'Database is not available. Please configure PostgreSQL to complete setup.',
        },
      },
      { status: 503 }
    );
  }
}
