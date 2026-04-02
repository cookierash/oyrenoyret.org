/**
 * Session Management Utilities
 * 
 * Secure session handling with httpOnly cookies.
 * Sessions are stored in the database and managed server-side only.
 */

import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/src/db/client';

const SESSION_TOKEN_LENGTH = 32;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (common for educational/SaaS)
const SESSION_CACHE_TTL_MS = Number(process.env.SESSION_CACHE_TTL_MS ?? 60_000);

const globalForSessionCache = globalThis as unknown as {
  sessionCache?: Map<string, { userId: string; expiresAt: number; cachedAt: number }>;
};

const sessionCache =
  globalForSessionCache.sessionCache ??
  new Map<string, { userId: string; expiresAt: number; cachedAt: number }>();

if (!globalForSessionCache.sessionCache) {
  globalForSessionCache.sessionCache = sessionCache;
}

/**
 * Generates a secure session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(SESSION_TOKEN_LENGTH).toString('hex');
}

/**
 * Creates a new session for a user
 * @param userId User ID
 * @param ipAddress Optional IP address
 * @param userAgent Optional user agent string
 * @returns Session token
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.authSession.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  // Set httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  });

  sessionCache.set(token, {
    userId,
    expiresAt: expiresAt.getTime(),
    cachedAt: Date.now(),
  });

  return token;
}

/**
 * Validates and retrieves session from token
 * @param token Session token
 * @returns User ID if session is valid, null otherwise
 */
export async function validateSession(token: string): Promise<string | null> {
  if (!token || token.trim().length === 0) {
    return null;
  }

  const cached = sessionCache.get(token);
  const now = Date.now();
  if (cached && cached.expiresAt > now && now - cached.cachedAt < SESSION_CACHE_TTL_MS) {
    return cached.userId;
  }

  const session = await prisma.authSession.findUnique({
    where: { token },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      user: { select: { status: true } },
    },
  });

  if (!session) {
    sessionCache.delete(token);
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    await prisma.authSession.delete({ where: { id: session.id } });
    sessionCache.delete(token);
    return null;
  }

  // Check if user is active
  if (session.user.status !== 'ACTIVE') {
    sessionCache.delete(token);
    return null;
  }

  sessionCache.set(token, {
    userId: session.userId,
    expiresAt: session.expiresAt.getTime(),
    cachedAt: Date.now(),
  });

  return session.userId;
}

/**
 * Gets the current session from cookies
 * @returns User ID if session exists and is valid, null otherwise
 */
export async function getCurrentSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;

  if (!token) {
    return null;
  }

  const userId = await validateSession(token);

  if (!userId) {
    // Best-effort cleanup of stale cookies to avoid redirect loops from edge proxy.
    try {
      cookieStore.delete('session_token');
    } catch {
      // Cookie mutation may be disallowed in some render phases; ignore if so.
    }

    return null;
  }

  return userId;
}

/**
 * Deletes a session (logout)
 * @param token Session token (optional, uses cookie if not provided)
 */
export async function deleteSession(token?: string): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = token || cookieStore.get('session_token')?.value;

  if (sessionToken) {
    await prisma.authSession.deleteMany({
      where: { token: sessionToken },
    });
    sessionCache.delete(sessionToken);
  }

  cookieStore.delete('session_token');
}

/**
 * Deletes all sessions for a user
 * @param userId User ID
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.authSession.deleteMany({
    where: { userId },
  });
}
