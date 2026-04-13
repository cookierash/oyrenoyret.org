import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  allowExitOnIdle: true,
  keepAlive: true,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const SUBJECT_ID = 'mathematics';
const TOPIC_ID = 'number';

const SEED_AUTHOR_EMAIL = 'seed.number.author@oyrenoyret.org';
const SEED_AUTHOR_FIRST = 'Seed';
const SEED_AUTHOR_LAST = 'Author';

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildLessonHtml({ title, bullets, example }) {
  const safeBullets = bullets.filter(Boolean);
  return [
    `<h2>${title}</h2>`,
    '<p><strong>Quick notes</strong></p>',
    '<ul>',
    ...safeBullets.map((b) => `<li>${b}</li>`),
    '</ul>',
    example ? `<p><strong>Example</strong></p><p>${example}</p>` : '',
    '<p><em>Try 3 similar problems on your own before checking the solution.</em></p>',
  ]
    .filter(Boolean)
    .join('');
}

function buildObjectivesHtml(objectives) {
  const safe = objectives.filter(Boolean);
  if (safe.length === 0) return null;
  // Objectives are stored as newline-separated plain text (rendered as bullets in UI).
  return safe.join('\n');
}

const LESSONS = [
  {
    baseTitle: 'Place Value and Expanded Form',
    bullets: [
      'Digits have different values depending on position (ones, tens, hundreds, ...).',
      'Write numbers in expanded form to see their structure.',
      'Use commas to group thousands, millions, etc.',
    ],
    example: 'Write 4,507 in expanded form: 4,000 + 500 + 7.',
    objectives: ['Identify place value.', 'Write expanded form.', 'Compare multi-digit numbers.'],
  },
  {
    baseTitle: 'Comparing and Ordering Integers',
    bullets: [
      'On a number line, numbers to the right are greater.',
      'Negative numbers are less than zero.',
      'Use <, >, = to compare values.',
    ],
    example: 'Order: -3, 2, -7, 0 → -7, -3, 0, 2.',
    objectives: ['Compare integers.', 'Order integers on a number line.'],
  },
  {
    baseTitle: 'Prime Numbers and Composite Numbers',
    bullets: [
      'A prime has exactly 2 factors: 1 and itself.',
      'A composite has more than 2 factors.',
      '1 is neither prime nor composite.',
    ],
    example: '29 is prime. 30 is composite (factors include 2, 3, 5).',
    objectives: ['Classify primes/composites.', 'List factors of a number.'],
  },
  {
    baseTitle: 'Greatest Common Factor (GCF)',
    bullets: [
      'List factors or use prime factorization.',
      'The GCF is the largest factor shared by both numbers.',
      'Useful for simplifying fractions.',
    ],
    example: 'GCF(24, 36) = 12.',
    objectives: ['Find the GCF using factors or primes.', 'Apply GCF to simplify.'],
  },
  {
    baseTitle: 'Least Common Multiple (LCM)',
    bullets: [
      'List multiples or use prime factorization.',
      'The LCM is the smallest positive multiple shared by both numbers.',
      'Useful for adding fractions with different denominators.',
    ],
    example: 'LCM(6, 8) = 24.',
    objectives: ['Find the LCM.', 'Use LCM to combine different cycles.'],
  },
  {
    baseTitle: 'Divisibility Rules',
    bullets: [
      '2: last digit even. 3: sum of digits divisible by 3.',
      '5: last digit 0 or 5. 9: sum of digits divisible by 9.',
      '10: last digit 0.',
    ],
    example: 'Is 6,237 divisible by 3? 6+2+3+7=18 → yes.',
    objectives: ['Test divisibility quickly.', 'Choose efficient factor checks.'],
  },
  {
    baseTitle: 'Rounding to the Nearest Ten, Hundred, Thousand',
    bullets: [
      'Look at the digit to the right of the rounding place.',
      '5 or more rounds up; 4 or less rounds down.',
      'Rounding is an estimate, not exact.',
    ],
    example: 'Round 7,462 to the nearest hundred → 7,500.',
    objectives: ['Round multi-digit numbers.', 'Estimate with rounding.'],
  },
  {
    baseTitle: 'Absolute Value',
    bullets: [
      'Absolute value is distance from 0 on the number line.',
      'It is always non-negative.',
      'Written like |x|.',
    ],
    example: '|-12| = 12 and |5| = 5.',
    objectives: ['Compute absolute value.', 'Interpret distance on a number line.'],
  },
  {
    baseTitle: 'Adding and Subtracting Integers',
    bullets: [
      'Same signs add and keep the sign.',
      'Different signs subtract and keep the sign of the larger absolute value.',
      'Subtraction can be rewritten as adding the opposite.',
    ],
    example: '-7 + 3 = -4, and 5 - (-2) = 7.',
    objectives: ['Add integers with signs.', 'Subtract integers by using opposites.'],
  },
  {
    baseTitle: 'Multiplying and Dividing Integers',
    bullets: [
      'Same signs → positive. Different signs → negative.',
      'Division follows the same sign rules as multiplication.',
      '0 times any number is 0.',
    ],
    example: '(-6)(-4)=24, and 15 ÷ (-3) = -5.',
    objectives: ['Apply sign rules correctly.', 'Compute integer products/quotients.'],
  },
];

const DIFFICULTIES = ['BASIC', 'INTERMEDIATE', 'ADVANCED'];
const AVATAR_VARIANTS = ['regular', 'blue', 'green', 'red', 'violet', 'yellow'];

async function main() {
  const excludeEmail = process.env.EXCLUDE_USER_EMAIL?.trim() || null;

  let author = await prisma.user.findUnique({ where: { email: SEED_AUTHOR_EMAIL } });
  if (!author) {
    author = await prisma.user.create({
      data: {
        email: SEED_AUTHOR_EMAIL,
        firstName: SEED_AUTHOR_FIRST,
        lastName: SEED_AUTHOR_LAST,
        status: 'ACTIVE',
        role: 'STUDENT',
        avatarVariant: pick(AVATAR_VARIANTS),
      },
    });
  }

  if (excludeEmail && author.email === excludeEmail) {
    throw new Error(
      `Seed author email matches EXCLUDE_USER_EMAIL (${excludeEmail}). Set EXCLUDE_USER_EMAIL to your own account email (or unset it).`
    );
  }

  const now = Date.now();
  const materials = Array.from({ length: 20 }).map((_, idx) => {
    const lesson = pick(LESSONS);
    const difficulty = pick(DIFFICULTIES);
    const title = `${lesson.baseTitle} #${idx + 1}`;
    const objectives = buildObjectivesHtml(lesson.objectives);
    const content = buildLessonHtml({
      title: lesson.baseTitle,
      bullets: lesson.bullets,
      example: lesson.example,
    });

    return {
      userId: author.id,
      subjectId: SUBJECT_ID,
      topicId: TOPIC_ID,
      title,
      objectives,
      content,
      materialType: 'TEXTUAL',
      status: 'PUBLISHED',
      publishedAt: new Date(now - idx * 60_000),
      alignmentScore: 0.75,
      difficulty,
    };
  });

  const result = await prisma.material.createMany({
    data: materials,
  });

  console.log(
    `Created ${result.count} published materials for ${SUBJECT_ID}/${TOPIC_ID} authored by ${author.email}.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
