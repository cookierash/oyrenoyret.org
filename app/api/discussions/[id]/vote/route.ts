/**
 * Discussion Vote API - POST upvote/downvote
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: discussionId } = await params;
    const body = await request.json();
    const value = body.value === -1 ? -1 : 1;

    const discussion = await prisma.discussion.findFirst({
      where: { id: discussionId, archivedAt: null },
    });

    if (!discussion) {
      return NextResponse.json({ error: 'Discussion not found or archived' }, { status: 404 });
    }

    await prisma.discussionVote.upsert({
      where: {
        discussionId_userId: { discussionId, userId },
      },
      create: { discussionId, userId, value },
      update: { value },
    });

    await prisma.discussion.update({
      where: { id: discussionId },
      data: { lastActivityAt: new Date() },
    });

    const votes = await prisma.discussionVote.findMany({
      where: { discussionId },
    });
    const score = votes.reduce((s, v) => s + v.value, 0);

    return NextResponse.json({ voteScore: score });
  } catch (error) {
    console.error('Error voting on discussion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
