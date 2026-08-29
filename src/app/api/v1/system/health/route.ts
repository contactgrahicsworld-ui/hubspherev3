import { NextResponse } from 'next/server';
import { db, isDatabaseConnected } from '@/lib/db';
import { success } from '@/lib/api-response';

export async function GET() {
  const uptime = process.uptime();

  try {
    const dbConnected = await isDatabaseConnected();

    if (!dbConnected) {
      return NextResponse.json(
        {
          success: true,
          data: {
            status: 'degraded',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(uptime),
            database: 'unavailable',
            message: 'PostgreSQL is not reachable. Application UI is available but data operations will fail.',
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      success({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        database: 'connected',
      })
    );
  } catch {
    return NextResponse.json(
      {
        success: true,
        data: {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(uptime),
          database: 'unavailable',
          message: 'Health check failed. Database may be unavailable.',
        },
      },
      { status: 503 }
    );
  }
}
