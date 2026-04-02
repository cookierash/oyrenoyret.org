import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Purge failed: DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idleTimeoutMillis: Number(process.env.PG_POOL_IDLE ?? 10_000),
  connectionTimeoutMillis: Number(process.env.PG_POOL_TIMEOUT ?? 10_000),
  allowExitOnIdle: true,
  keepAlive: true,
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const enrollments = await prisma.liveEventEnrollment.deleteMany({});
  const events = await prisma.liveEvent.deleteMany({});

  console.log(`Deleted ${enrollments.count} live event enrollments.`);
  console.log(`Deleted ${events.count} live events.`);
}

main()
  .catch((error) => {
    console.error('Purge failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
