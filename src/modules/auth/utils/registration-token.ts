/**
 * Registration Token Utilities
 *
 * Issues and verifies a short-lived registration token to prevent IDOR
 * during multi-step registration.
 */

import crypto from 'crypto';
import { cookies } from 'next/headers';

type RegistrationTokenPayload = {
  v: 1;
  userId: string;
  exp: number;
  nonce: string;
};

const REGISTRATION_TOKEN_COOKIE = 'registration_token';
const REGISTRATION_TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function getRegistrationTokenSecret(): string {
  const secret = process.env.REGISTRATION_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('Registration token secret is not configured');
  }
  return secret;
}

function sign(payload: string): string {
  return crypto
    .createHmac('sha256', getRegistrationTokenSecret())
    .update(payload)
    .digest('base64url');
}

function encodePayload(payload: RegistrationTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(body);
  return `${body}.${signature}`;
}

function decodePayload(token: string): RegistrationTokenPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = sign(body);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(signatureBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as RegistrationTokenPayload;
    if (!parsed || parsed.v !== 1 || !parsed.userId || !parsed.exp || !parsed.nonce) {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createRegistrationToken(userId: string): string {
  const payload: RegistrationTokenPayload = {
    v: 1,
    userId,
    exp: Date.now() + REGISTRATION_TOKEN_TTL_MS,
    nonce: crypto.randomBytes(12).toString('hex'),
  };
  return encodePayload(payload);
}

export async function issueRegistrationToken(userId: string): Promise<string> {
  const token = createRegistrationToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(REGISTRATION_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REGISTRATION_TOKEN_TTL_MS / 1000,
    path: '/',
  });
  return token;
}

export async function requireRegistrationToken(
  userId: string,
): Promise<{ ok: true } | { ok: false; errorKey: 'registrationSessionExpired' | 'registrationSessionInvalid' }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(REGISTRATION_TOKEN_COOKIE)?.value;
  if (!token) {
    return { ok: false, errorKey: 'registrationSessionExpired' };
  }

  const payload = decodePayload(token);
  if (!payload || payload.userId !== userId) {
    return { ok: false, errorKey: 'registrationSessionInvalid' };
  }

  return { ok: true };
}

export async function clearRegistrationToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(REGISTRATION_TOKEN_COOKIE);
}
