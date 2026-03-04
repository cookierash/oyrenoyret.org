import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';

export async function GET() {
    const userId = await getCurrentSession();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accesses = await prisma.materialAccess.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
            material: {
                select: {
                    id: true,
                    title: true,
                    subjectId: true,
                    topicId: true,
                    materialType: true,
                    difficulty: true,
                    deletedAt: true,
                },
            },
        },
    });

    // Filter out soft-deleted materials
    const result = accesses
        .filter((a) => !a.material.deletedAt)
        .map((a) => ({
            purchasedAt: a.createdAt,
            material: {
                id: a.material.id,
                title: a.material.title,
                subjectId: a.material.subjectId,
                topicId: a.material.topicId,
                materialType: a.material.materialType,
                difficulty: a.material.difficulty,
            },
        }));

    return NextResponse.json(result);
}
