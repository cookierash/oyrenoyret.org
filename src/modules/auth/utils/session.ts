/**
 * Session Management Utilities
 * 
 * Secure session handling with httpOnly cookies.
 * Sessions are stored in the database and managed server-side only.
 */

import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

const SESSION_TOKEN_LENGTH = 32;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (common for educational/SaaS)
const SESSION_CACHE_TTL_MS = Number(process.env.SESSION_CACHE_TTL_MS ?? 60_000);

function isDbUnreachable(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error && typeof (error as any).code === 'string'
      ? String((error as any).code)
      : '';

  // Prisma / driver codes
  if (code === 'P1001') return true;
  // Postgres: too_many_connections
  if (code === '53300') return true;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (!message) return false;
  const lowered = message.toLowerCase();
  return (
    lowered.includes("can't reach database server") ||
    lowered.includes('cannot reach database server') ||
    lowered.includes('too many connections') ||
    lowered.includes('too many clients already') ||
    lowered.includes('remaining connection slots are reserved') ||
    lowered.includes('connection terminated unexpectedly') ||
    lowered.includes('econnrefused') ||
    lowered.includes('etimedout')
  );
}

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

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isTokenHashUnsupportedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: unknown }).name;
  const message = (error as { message?: unknown }).message;
  return (
    name === 'PrismaClientValidationError' &&
    typeof message === 'string' &&
    message.includes('Unknown argument `tokenHash`')
  );
}

function isTokenHashMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  const metaColumn = (error as { meta?: { column?: unknown } }).meta?.column;
  return (
    code === 'P2022' &&
    ((typeof metaColumn === 'string' && metaColumn.toLowerCase().includes('tokenhash')) ||
      (typeof message === 'string' &&
        (message.includes('tokenHash') ||
          message.includes('"tokenHash"') ||
          // Some Prisma builds redact the column name as "(not available)".
          message.includes('(not available)'))))
  );
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
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  try {
    await prisma.authSession.create({
      data: {
        userId,
        tokenHash,
        token: null,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Safe rollout fallback:
    // - If Prisma Client is outdated (no tokenHash), or DB migration isn't applied yet,
    //   fall back to legacy raw-token sessions to avoid a hard outage.
    if (isTokenHashUnsupportedError(error) || isTokenHashMissingColumnError(error)) {
      console.warn(
        'AuthSession.tokenHash is not available yet; falling back to legacy session tokens. Ensure prisma generate + migrate deploy ran in production.',
      );
      await prisma.authSession.create({
        data: {
          userId,
          token,
          expiresAt,
          ipAddress,
          userAgent,
        },
      });
    } else {
      throw error;
    }
  }

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

  const tokenHash = hashSessionToken(token);
  const baseSelect = {
    id: true,
    userId: true,
    expiresAt: true,
  } as const;

  const hashedSelect = {
    ...baseSelect,
    token: true,
    tokenHash: true,
  } as const;

  let session: any = null;

  try {
    session = await prisma.authSession.findUnique({
      where: { tokenHash },
      select: hashedSelect as any,
    });
  } catch (error) {
    if (isDbUnreachable(error)) {
      sessionCache.delete(token);
      return null;
    }
    if (isTokenHashUnsupportedError(error) || isTokenHashMissingColumnError(error)) {
      session = null;
    } else {
      throw error;
    }
  }

  if (!session) {
    // Legacy sessions (pre-hash migration): fall back to raw token lookup.
    try {
      session = await prisma.authSession.findUnique({
        where: { token },
        select: { ...baseSelect, token: true } as any,
      });
    } catch (error) {
      if (isDbUnreachable(error)) {
        sessionCache.delete(token);
        return null;
      }
      throw error;
    }
  }

  if (!session) {
    sessionCache.delete(token);
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    try {
      await prisma.authSession.delete({ where: { id: session.id } });
    } catch (error) {
      if (!isDbUnreachable(error)) throw error;
    }
    sessionCache.delete(token);
    return null;
  }

  // Fetch user status separately so missing/new user columns don't break session validation.
  // This prevents "random logouts" during partial rollouts when only auth tables are migrated.
  let userStatus: any = null;
  try {
    userStatus = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { status: true, suspensionUntil: true } as any,
    });
  } catch (error) {
    if (isDbUnreachable(error)) {
      sessionCache.delete(token);
      return null;
    }
    if (isDbSchemaMismatch(error)) {
      try {
        userStatus = await prisma.user.findUnique({
          where: { id: session.userId },
          select: { status: true } as any,
        });
      } catch (fallbackError) {
        if (isDbUnreachable(fallbackError)) {
          sessionCache.delete(token);
          return null;
        }
        if (!isDbSchemaMismatch(fallbackError)) throw fallbackError;
        userStatus = { status: 'ACTIVE' } as any;
      }
    } else {
      throw error;
    }
  }

  // Check if user is allowed to browse while logged in.
  // - INACTIVE: registration incomplete → treat as unauthenticated.
  // - SUSPENDED/BANNED: session is valid, but app will gate features and show a blocking dialog.
  const status = userStatus?.status as string | undefined;
  if (!status) {
    // If the user was deleted, the session is no longer valid.
    try {
      await prisma.authSession.delete({ where: { id: session.id } });
    } catch (error) {
      if (!isDbUnreachable(error)) throw error;
    }
    sessionCache.delete(token);
    return null;
  }
  if (status === 'INACTIVE') {
    try {
      await prisma.authSession.delete({ where: { id: session.id } });
    } catch (error) {
      if (!isDbUnreachable(error)) throw error;
    }
    sessionCache.delete(token);
    return null;
  }

  // Auto-lift suspension once the window expires.
  if (status === 'SUSPENDED') {
    const until = (userStatus as any)?.suspensionUntil as Date | null | undefined;
    if (until && until.getTime() <= Date.now()) {
      try {
        await prisma.user.update({
          where: { id: session.userId },
          data: { status: 'ACTIVE', suspensionUntil: null, suspensionReason: null },
          select: { id: true },
        });
      } catch (error) {
        if (isDbUnreachable(error)) return session.userId;
        if (!isDbSchemaMismatch(error)) throw error;
        // If migrations aren't applied yet, ignore and keep the session usable.
      }
    }
  }

  // Opportunistically migrate legacy sessions to hashed storage.
  if (!session.tokenHash && session.token) {
    try {
      await prisma.authSession.update({
        where: { id: session.id },
        data: { tokenHash, token: null },
      });
    } catch {
      // Ignore race conditions / unique collisions; session remains usable for this request.
    }
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

  let userId: string | null = null;
  try {
    userId = await validateSession(token);
  } catch (error) {
    if (isDbUnreachable(error)) {
      return null;
    }
    throw error;
  }

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
    const tokenHash = hashSessionToken(sessionToken);
    try {
      await prisma.authSession.deleteMany({
        where: {
          OR: [{ tokenHash }, { token: sessionToken }],
        },
      });
    } catch (error) {
      if (isTokenHashUnsupportedError(error) || isTokenHashMissingColumnError(error)) {
        await prisma.authSession.deleteMany({
          where: { token: sessionToken },
        });
      } else {
        throw error;
      }
    }
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
