#!/usr/bin/env node
/**
 * Reset email verification statuses.
 *
 * Default: resets STUDENT users only.
 * Flags:
 *  --all   Reset all user roles.
 *
 * Uses DATABASE_URL from the environment.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_POOL_IDLE ?? 10000),
  connectionTimeoutMillis: Number(process.env.PG_POOL_TIMEOUT ?? 10000),
  allowExitOnIdle: true,
  keepAlive: true,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, errorFormat: 'pretty' });

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const resetAll = hasFlag('--all');

async function main() {
  const where = resetAll
    ? { deletedAt: null }
    : { role: 'STUDENT', deletedAt: null };

  const result = await prisma.user.updateMany({
    where,
    data: { emailVerifiedAt: null },
  });

  // eslint-disable-next-line no-console
  console.log(
    `Reset email verification for ${result.count} user(s) (${resetAll ? 'ALL roles' : 'STUDENT only'}).`,
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Reset failed:', error?.message ?? error);
    // eslint-disable-next-line no-console
    if (error && typeof error === 'object') console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
