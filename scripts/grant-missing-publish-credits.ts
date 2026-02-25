/**
 * One-time script: Grant 0.5 credits for materials published before publishCreditsGrantedAt was added.
 * Run: npx tsx scripts/grant-missing-publish-credits.ts
 */

import { prisma } from '../src/db/client';
import { grantMaterialPublish } from '../src/modules/credits';

async function main() {
  const materials = await prisma.material.findMany({
    where: {
      status: 'PUBLISHED',
      publishCreditsGrantedAt: null,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      materialType: true,
      alignmentScore: true,
      content: true,
    },
  });

  console.log(`Found ${materials.length} published materials without credits granted`);

  for (const m of materials) {
    let questionCount = 0;
    if (m.materialType === 'PRACTICE_TEST' && m.content) {
      try {
        const parsed = JSON.parse(m.content) as { questions?: unknown[] };
        questionCount = Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
      } catch {
        /* ignore */
      }
    }
    const result = await grantMaterialPublish(
      m.userId,
      {
        alignmentScore: m.alignmentScore ?? 0.75,
        materialType: m.materialType,
        questionCount,
      },
      m.id
    );
    if (result.success && result.amount > 0) {
      console.log(`Granted ${result.amount} credits for material ${m.id} (user ${m.userId})`);
    }
  }

  console.log('Done');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
