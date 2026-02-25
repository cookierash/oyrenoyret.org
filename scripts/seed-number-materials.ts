/**
 * Seed 30 random textual materials to the Number topic under Mathematics.
 * Run: npx tsx scripts/seed-number-materials.ts
 */

import 'dotenv/config';
import { prisma } from '../src/db/client';

const NUMBER_TOPIC_TITLES = [
  'Understanding Whole Numbers',
  'Place Value and Expanded Form',
  'Comparing and Ordering Numbers',
  'Rounding Numbers to the Nearest Ten',
  'Addition with Regrouping',
  'Subtraction with Borrowing',
  'Multiplication Tables 1–12',
  'Long Division Step by Step',
  'Factors and Multiples',
  'Prime and Composite Numbers',
  'Greatest Common Factor (GCF)',
  'Least Common Multiple (LCM)',
  'Introduction to Integers',
  'Absolute Value',
  'Order of Operations (PEMDAS)',
  'Exponents and Powers',
  'Square Roots Basics',
  'Number Patterns and Sequences',
  'Odd and Even Numbers',
  'Divisibility Rules',
  'Mental Math Strategies',
  'Estimating Sums and Differences',
  'Word Problems with Whole Numbers',
  'Number Line Introduction',
  'Negative Numbers on a Number Line',
  'Scientific Notation',
  'Roman Numerals',
  'Number Systems: Base 10',
  'Real-World Applications of Numbers',
  'Number Theory for Beginners',
];

function randomContent(title: string): string {
  const paragraphs = [
    `This guide covers the key concepts you need to master ${title.toLowerCase()}.`,
    `Understanding these fundamentals will help you in more advanced math topics.`,
    `Practice the examples and try the exercises at the end of each section.`,
    `Remember to check your work and understand each step of the process.`,
    `Many students find that breaking problems into smaller steps makes them easier.`,
  ];
  const numParagraphs = 2 + Math.floor(Math.random() * 3);
  const selected = paragraphs.slice(0, numParagraphs);
  return selected.map((p) => `<p>${p}</p>`).join('');
}

async function main() {
  const subjectId = 'mathematics';
  const topicId = 'number';

  const user = await prisma.user.findFirst({
    where: { deletedAt: null },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!user) {
    console.error('No user found in database. Create a user first.');
    process.exit(1);
  }

  console.log(`Using user: ${user.email} (${user.id})`);

  const existingCount = await prisma.material.count({
    where: { subjectId, topicId, status: 'PUBLISHED', deletedAt: null },
  });
  console.log(`Existing materials in Number topic: ${existingCount}`);

  const titlesToUse = [...NUMBER_TOPIC_TITLES].sort(() => Math.random() - 0.5).slice(0, 30);

  const now = new Date();
  let created = 0;

  for (const title of titlesToUse) {
    const content = randomContent(title);
    await prisma.material.create({
      data: {
        userId: user.id,
        subjectId,
        topicId,
        title,
        content,
        materialType: 'TEXTUAL',
        status: 'PUBLISHED',
        publishedAt: now,
        alignmentScore: 0.7 + Math.random() * 0.25,
      },
    });
    created++;
    console.log(`Created: ${title}`);
  }

  console.log(`\nDone. Created ${created} textual materials in Mathematics > Number.`);
}

main()
  .catch((err) => {
    if (err?.code === 'ECONNREFUSED') {
      console.error(
        'Database connection refused. Ensure PostgreSQL is running and DATABASE_URL in .env is correct.'
      );
    }
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
