/**
 * Archive Discussions Cron
 *
 * Archives discussions with no interaction for 24 hours.
 * Call via: GET /api/cron/archive-discussions
 * SECURITY: In production, CRON_SECRET must be set and passed as Bearer token.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';

const ARCHIVE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      if (!cronSecret) {
        return NextResponse.json(
          { error: 'Cron endpoint not configured. Set CRON_SECRET in production.' },
          { status: 503 }
        );
      }
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In dev/test: if CRON_SECRET is set, require it
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cutoff = new Date(Date.now() - ARCHIVE_THRESHOLD_MS);

    const result = await prisma.discussion.updateMany({
      where: {
        archivedAt: null,
        lastActivityAt: { lt: cutoff },
      },
      data: { archivedAt: new Date() },
    });

    return NextResponse.json({
      archived: result.count,
      message: `Archived ${result.count} discussions`,
    });
  } catch (error) {
    console.error('Error archiving discussions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
