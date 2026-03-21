/**
 * Prisma Client Singleton
 * 
 * Ensures a single Prisma client instance across the application.
 * This prevents connection pool exhaustion in serverless environments.
 * 
 * IMPORTANT: This client is server-side only and must never be exposed to the client.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaMiddlewareApplied?: boolean;
};

/**
 * Prisma Client Singleton
 * 
 * Creates a single Prisma client instance to prevent connection pool exhaustion.
 * In development, the client is stored globally to prevent multiple instances during hot reloads.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_POOL_IDLE ?? 10000),
  connectionTimeoutMillis: Number(process.env.PG_POOL_TIMEOUT ?? 10000),
  allowExitOnIdle: true,
  keepAlive: true,
});

pool.on('error', (err) => {
  // Log and allow the pool to recover by creating a new client on next checkout.
  console.error('Postgres pool error:', err);
});

const adapter = new PrismaPg(pool);

let prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (!globalForPrisma.prismaMiddlewareApplied) {
  const reconnectOnce = async (exec: () => Promise<unknown>) => {
    try {
      return await exec();
    } catch (error) {
      const isClosedConnection =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        /Server has closed the connection/i.test(error.message);

      if (isClosedConnection) {
        try {
          await prismaClient.$disconnect();
          await prismaClient.$connect();
        } catch (reconnectError) {
          console.error('Prisma reconnect failed:', reconnectError);
        }
        return exec();
      }

      throw error;
    }
  };

  type PrismaMiddleware = (params: unknown, next: (params: unknown) => Promise<unknown>) => Promise<unknown>;
  const maybeUse = (
    prismaClient as unknown as { $use?: (middleware: PrismaMiddleware) => void }
  )?.$use;
  const maybeExtends = (
    prismaClient as unknown as { $extends?: (ext: unknown) => PrismaClient }
  )?.$extends;

  if (typeof maybeUse === 'function') {
    maybeUse(async (params, next) => reconnectOnce(() => next(params)));
  } else if (typeof maybeExtends === 'function') {
    prismaClient = prismaClient.$extends({
      query: {
        $allModels: {
          $allOperations: async ({ args, query }) =>
            reconnectOnce(() => query(args)),
        },
      },
    }) as unknown as PrismaClient;
  } else {
    console.warn('Prisma middleware is not available in this runtime.');
  }

  globalForPrisma.prismaMiddlewareApplied = true;
}

export const prisma = prismaClient;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
