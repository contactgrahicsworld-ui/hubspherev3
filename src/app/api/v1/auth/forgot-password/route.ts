import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRefreshToken } from '@/lib/auth';
import { forgotPasswordSchema, validate } from '@/lib/validators';
import { handleApiError, RateLimitError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 password reset requests per hour per IP
    const { limited, retryAfterMs } = rateLimit(getClientIp(request) + ':forgot', 3, 60 * 60 * 1000);
    if (limited) {
      throw new RateLimitError('Too many password reset attempts. Please try again later.', Math.ceil(retryAfterMs / 1000));
    }

    const body = await request.json();
    const { email } = validate(forgotPasswordSchema, body);

    const user = await db.user.findUnique({
      where: { email },
    });

    // Always return the same response regardless of whether user exists
    // to prevent email enumeration attacks
    if (user) {
      const token = await generateRefreshToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      });

      // Audit log
      await createAuditLog({
        actorId: user.id,
        action: 'auth.forgot_password',
        targetType: 'User',
        targetId: user.id,
        metadata: { email: user.email },
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });

      // In production, send an email with the reset link here.
      // The token is NEVER returned in the response.
    }

    return NextResponse.json(
      success({
        message: 'If an account with this email exists, a reset link will be sent.',
      })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
