/**
 * Onboarding Complete API
 *
 * Marks the current user's tutorial as completed.
 */

import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';

export async function POST() {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        tutorialCompletedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to complete onboarding tutorial:', error);
    return NextResponse.json({ error: 'Failed to complete tutorial' }, { status: 500 });
  }
}
