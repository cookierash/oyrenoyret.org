/**
 * Prisma Client Singleton
 * 
 * Ensures a single Prisma client instance across the application.
 * This prevents connection pool exhaustion in serverless environments.
 * 
 * IMPORTANT: This client is server-side only and must never be exposed to the client.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma Client Singleton
 * 
 * Creates a single Prisma client instance to prevent connection pool exhaustion.
 * In development, the client is stored globally to prevent multiple instances during hot reloads.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
