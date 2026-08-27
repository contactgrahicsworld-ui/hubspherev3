import { NextResponse } from 'next/server';
import { runSeed } from '@/lib/seed';
import { success } from '@/lib/api-response';
import { handleApiError } from '@/lib/errors';

export async function POST() {
  try {
    const results = await runSeed();

    return NextResponse.json(
      success(results, 'Seed completed successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
