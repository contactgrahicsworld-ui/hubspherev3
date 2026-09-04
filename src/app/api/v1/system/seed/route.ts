import { NextRequest, NextResponse } from 'next/server';
import { runSeed } from '@/lib/seed';
import { success } from '@/lib/api-response';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { verifyAccessToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  // Block destructive seed endpoint in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  try {
    // Require SUPER_ADMIN authentication for seeding
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      throw new AuthenticationError('Authentication required');
    }

    const payload = await verifyAccessToken(token);
    if (!payload || !payload.isSuperAdmin) {
      throw new AuthenticationError('Super Admin access required');
    }

    const results = await runSeed();

    return NextResponse.json(
      success(results, 'Seed completed successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
