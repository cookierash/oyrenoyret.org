/**
 * Credits Balance API
 *
 * GET: Current user's credit balance
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { getBalance } from '@/src/modules/credits';

export async function GET() {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const balance = await getBalance(userId);
    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
