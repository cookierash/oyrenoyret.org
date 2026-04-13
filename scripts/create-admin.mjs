#!/usr/bin/env node
/**
 * Create or update an ADMIN user with a bcrypt-hashed password.
 *
 * Usage:
 *   - Recommended (no secrets in shell history; hashes plaintext):
 *     read -s "pw?Admin password: "; echo
 *     ADMIN_PLAINTEXT_PASSWORD="$pw" node scripts/create-admin.mjs --email office@oyrenoyret.org
 *     unset pw
 *
 *   - Using an existing bcrypt hash from your environment (no plaintext needed):
 *     ADMIN_EMAIL=office@oyrenoyret.org ADMIN_PASSWORD_HASH='$2b$12$...' node scripts/create-admin.mjs
 *
 *   - Explicit hash arg:
 *     node scripts/create-admin.mjs --email office@oyrenoyret.org --password-hash '$2b$12$...'
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
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

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith('--')) return null;
  return next;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const emailArg = getArgValue('--email');
  const passwordArg = getArgValue('--password');
  const passwordHashArg = getArgValue('--password-hash');
  const plaintextPassword = passwordArg || process.env.ADMIN_PLAINTEXT_PASSWORD || null;
  const emailRaw = emailArg || process.env.ADMIN_EMAIL || null;
  const force = hasFlag('--force');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to create an admin user.');
  }

  const email = String(emailRaw ?? '').trim().toLowerCase();
  if (!email) {
    throw new Error('Missing email. Pass --email or set ADMIN_EMAIL.');
  }

  const envHash = process.env.ADMIN_PASSWORD_HASH?.trim() || null;
  const passwordHashRaw = passwordHashArg ? String(passwordHashArg).trim() : null;

  if (!plaintextPassword && !passwordHashRaw && !envHash) {
    throw new Error(
      'Missing password. Provide ADMIN_PLAINTEXT_PASSWORD / --password, or provide ADMIN_PASSWORD_HASH / --password-hash.',
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, deletedAt: true },
  });

  if (existing && existing.role !== 'ADMIN' && !force) {
    throw new Error(
      `User ${email} exists with role=${existing.role}. Re-run with --force to promote to ADMIN.`,
    );
  }

  let passwordHash = '';
  if (passwordHashRaw || (!plaintextPassword && envHash)) {
    passwordHash = (passwordHashRaw || envHash || '').trim();
    if (!passwordHash.startsWith('$2') || passwordHash.length < 40) {
      throw new Error('Provided password hash does not look like a bcrypt hash.');
    }
  } else {
    passwordHash = await bcrypt.hash(String(plaintextPassword), 12);
  }

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      registrationStep: 5,
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      registrationStep: 5,
      emailVerifiedAt: new Date(),
      deletedAt: null,
    },
    select: { id: true, email: true, role: true, status: true },
  });

  // eslint-disable-next-line no-console
  console.log(`Admin user ensured: ${user.email} (${user.id}) role=${user.role} status=${user.status}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Admin create/update failed:', error?.message ?? error);
    // eslint-disable-next-line no-console
    if (error && typeof error === 'object') console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
