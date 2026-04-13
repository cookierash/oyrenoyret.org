/**
 * Contact Messages API
 *
 * POST: Create a contact message (public)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { sanitizeInput } from '@/src/security/validation';
import { RATE_LIMITS } from '@/src/config/constants';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitIdentifier,
} from '@/src/security/rateLimiter';
import { contactMessageSchema } from '@/src/modules/contact/schemas/contact-message';

function getClientIpFromHeaders(headers: Headers): string | null {
  const forwarded =
    headers.get('x-forwarded-for') ||
    headers.get('x-vercel-forwarded-for') ||
    headers.get('x-real-ip');
  return forwarded ? forwarded.split(',')[0]?.trim() || null : null;
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentSession();
    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `contact:message:create:${identifier}`,
      RATE_LIMITS.CONTACT_MESSAGE,
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const json = await request.json();
    const parsed = contactMessageSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const name = sanitizeInput(parsed.data.name);
    const email = sanitizeInput(parsed.data.email);
    const subject = sanitizeInput(parsed.data.subject);
    const message = sanitizeInput(parsed.data.message);

    const ipAddress = getClientIpFromHeaders(request.headers);
    const userAgent = request.headers.get('user-agent');

    await prisma.contactMessage.create({
      data: {
        userId: userId ?? null,
        name,
        email,
        subject,
        message,
        ipAddress,
        userAgent,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error creating contact message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
