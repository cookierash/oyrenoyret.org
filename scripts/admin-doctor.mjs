#!/usr/bin/env node
/**
 * Admin login diagnostics (local / server env).
 *
 * Checks:
 * - DATABASE_URL present
 * - ADMIN_EMAIL provided (via --email or env)
 * - User exists in DB
 * - Role/status flags
 * - Optional password match (set ADMIN_PLAINTEXT_PASSWORD)
 *
 * Usage:
 *   node scripts/admin-doctor.mjs --email office@oyrenoyret.org
 *
 * Optional password check (recommended, avoids shell history):
 *   read -s "pw?Password to test: "; echo
 *   ADMIN_PLAINTEXT_PASSWORD="$pw" node scripts/admin-doctor.mjs --email office@oyrenoyret.org
 *   unset pw
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith('--')) return null;
  return next;
}

function maskEmail(email) {
  return email.replace(/(^.).*(@.*$)/, '$1***$2');
}

async function main() {
  const emailArg = getArgValue('--email');
  const emailRaw = emailArg || process.env.ADMIN_EMAIL || '';
  const email = String(emailRaw).trim().toLowerCase();
  const plaintext = process.env.ADMIN_PLAINTEXT_PASSWORD || null;

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  if (!hasDatabaseUrl) {
    throw new Error('DATABASE_URL is missing. Set it in .env or your shell.');
  }

  if (!email) {
    throw new Error('Missing email. Pass --email or set ADMIN_EMAIL.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: true,
    keepAlive: true,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter, errorFormat: 'pretty' });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        registrationStep: true,
        emailVerifiedAt: true,
        deletedAt: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // eslint-disable-next-line no-console
    console.log('Admin doctor:', {
      email: maskEmail(email),
      databaseUrlPresent: hasDatabaseUrl,
      userExists: Boolean(user),
    });

    if (!user) return;

    const hasPasswordHash = Boolean(user.passwordHash);
    let passwordMatches = null;
    if (plaintext && user.passwordHash) {
      passwordMatches = await bcrypt.compare(String(plaintext), user.passwordHash);
    }

    // eslint-disable-next-line no-console
    console.log('User:', {
      id: user.id,
      role: user.role,
      status: user.status,
      registrationStep: user.registrationStep,
      emailVerifiedAt: Boolean(user.emailVerifiedAt),
      deletedAt: Boolean(user.deletedAt),
      hasPasswordHash,
      passwordMatches,
    });
  } finally {
    // Let the process exit cleanly.
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Admin doctor failed:', error?.message ?? error);
  process.exitCode = 1;
});

