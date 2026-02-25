/**
 * Logout API
 *
 * Clears the session and redirects to home.
 */

import { NextResponse } from 'next/server';
import { deleteSession } from '@/src/modules/auth/utils/session';

export async function POST() {
  await deleteSession();
  return NextResponse.redirect(new URL('/', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
}
