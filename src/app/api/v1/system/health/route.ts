import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { success } from '@/lib/api-response';
import { handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    // Try a simple DB query to verify connectivity
    await db.user.count();

    const uptime = process.uptime();

    return NextResponse.json(
      success({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        database: 'connected',
      })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
