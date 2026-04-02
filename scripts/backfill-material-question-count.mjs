import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getPracticeTestQuestionCount(content) {
  if (!content) return 0;
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
  } catch {
    return 0;
  }
}

async function main() {
  const materials = await prisma.material.findMany({
    where: { materialType: 'PRACTICE_TEST' },
    select: { id: true, content: true, questionCount: true },
  });

  let updated = 0;

  for (const material of materials) {
    const count = getPracticeTestQuestionCount(material.content);
    if (count !== material.questionCount) {
      await prisma.material.update({
        where: { id: material.id },
        data: { questionCount: count },
      });
      updated += 1;
    }
  }

  console.log(`Backfill complete. Updated ${updated} materials.`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
