import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const AVATAR_VARIANTS = [
  'regular',
  'blue',
  'green',
  'red',
  'violet',
  'yellow',
];

function pickStableVariant(seed) {
  if (!seed) return 'regular';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_VARIANTS[Math.abs(hash) % AVATAR_VARIANTS.length];
}

function pickRandomVariant() {
  return AVATAR_VARIANTS[Math.floor(Math.random() * AVATAR_VARIANTS.length)];
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const onlyMissing = process.argv.includes('--only-missing');
  const overwrite = process.argv.includes('--overwrite');
  const random = process.argv.includes('--random');

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required (set it in the environment)');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(
      new Pool({
        connectionString: databaseUrl,
        max: Number(process.env.PG_POOL_MAX ?? 10),
        idleTimeoutMillis: Number(process.env.PG_POOL_IDLE ?? 10000),
        connectionTimeoutMillis: Number(process.env.PG_POOL_TIMEOUT ?? 10000),
        allowExitOnIdle: true,
        keepAlive: true,
      }),
    ),
  });
  try {
    const where = onlyMissing ? { avatarVariant: null } : {};

    const total = await prisma.user.count({ where });
    console.log(`[avatars] target users: ${total}${dryRun ? ' (dry-run)' : ''}`);

    const take = 500;
    let cursor = undefined;
    let processed = 0;
    let updated = 0;

    while (true) {
      const users = await prisma.user.findMany({
        where,
        take,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: { id: true, email: true, avatarVariant: true },
      });

      if (users.length === 0) break;

      for (const user of users) {
        const nextVariant = random ? pickRandomVariant() : pickStableVariant(user.id);
        processed += 1;
        if (dryRun) continue;

        if (!overwrite && user.avatarVariant != null) continue;

        await prisma.user.update({
          where: { id: user.id },
          data: { avatarVariant: nextVariant },
          select: { id: true },
        });
        updated += 1;
      }

      cursor = users[users.length - 1].id;
      console.log(`[avatars] processed ${processed}/${total} updated ${updated}`);
    }

    console.log(`[avatars] done. processed=${processed} updated=${updated}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[avatars] failed:', err);
  process.exit(1);
});
