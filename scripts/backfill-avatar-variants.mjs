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

function isValidVariant(value) {
  return typeof value === 'string' && AVATAR_VARIANTS.includes(value);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const onlyMissing = process.argv.includes('--only-missing');
  const onlyDefault = process.argv.includes('--only-default');
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
    // Note: In some deployments `avatarVariant` may be non-nullable in Prisma schema,
    // so filtering with `{ avatarVariant: null }` can throw. We filter in JS instead.
    const total = await prisma.user.count();
    console.log(
      `[avatars] scanning users: ${total}${dryRun ? ' (dry-run)' : ''} ` +
        `(mode: ${overwrite ? 'overwrite' : onlyMissing ? 'only-missing' : onlyDefault ? 'only-default' : 'all'}) ` +
        `(variant: ${random ? 'random' : 'stable'})`,
    );

    const take = 500;
    let cursor = undefined;
    let processed = 0;
    let updated = 0;

    while (true) {
      const users = await prisma.user.findMany({
        take,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: { id: true, email: true, avatarVariant: true },
      });

      if (users.length === 0) break;

      for (const user of users) {
        const current = user.avatarVariant;
        const computed = random ? pickRandomVariant() : pickStableVariant(user.id);

        processed += 1;
        if (dryRun) continue;

        const missingOrInvalid =
          current == null || (typeof current === 'string' && current.trim() === '') || !isValidVariant(current);
        const isDefault = current === 'regular';

        const shouldUpdate =
          overwrite ||
          (onlyMissing ? missingOrInvalid : false) ||
          (onlyDefault ? isDefault : false) ||
          (!onlyMissing && !onlyDefault);

        if (!shouldUpdate) continue;
        if (!overwrite && !missingOrInvalid && !onlyDefault && current != null) {
          // Safety: if user didn't ask to overwrite, don't touch already-set values.
          continue;
        }

        // Idempotent in stable mode: if it's already the computed value, skip.
        if (!random && current === computed) continue;

        await prisma.user.update({
          where: { id: user.id },
          data: { avatarVariant: computed },
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
