/**
 * My Drafts API
 *
 * List current user's draft materials. Requires auth.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';

export async function GET() {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const materials = await prisma.material.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        subjectId: true,
        topicId: true,
        title: true,
        status: true,
        materialType: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(materials);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
