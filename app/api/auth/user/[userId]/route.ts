/**
 * User API Route
 *
 * Fetches user information by ID for registration flow only.
 * SECURITY: Restricted to INACTIVE users (registration in progress).
 * ACTIVE users return 404 to prevent IDOR and PII exfiltration.
 * TODO: Add signed registration token for stronger authorization.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { z } from 'zod';
import { requireRegistrationToken } from '@/src/modules/auth/utils/registration-token';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

const uuidSchema = z.string().uuid('Invalid user ID format');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const parseResult = uuidSchema.safeParse(userId);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(`auth:user:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const tokenCheck = await requireRegistrationToken(parseResult.data);
    if (!tokenCheck.ok) {
      return NextResponse.json({ error: tokenCheck.error }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseResult.data },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        parentEmail: true,
        registrationStep: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only allow fetching users in registration flow (INACTIVE)
    if (user.status !== 'INACTIVE') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Strip status from the response payload.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUser } = user;
    return NextResponse.json(safeUser, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
