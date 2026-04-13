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
  prismaPool?: Pool;
  prismaPoolInitialized?: boolean;
  prismaAdapter?: PrismaPg;
};

function getModelDelegateNames() {
  const modelNameEnum = (Prisma as unknown as { ModelName?: Record<string, string> }).ModelName;
  if (!modelNameEnum) return [];
  const modelNames = Object.values(modelNameEnum).filter((name) => typeof name === 'string');
  return modelNames.map((name) => `${name.charAt(0).toLowerCase()}${name.slice(1)}`);
}

function hasFindManyDelegate(client: PrismaClient, delegateName: string) {
  const delegate = (client as unknown as Record<string, unknown>)[delegateName] as { findMany?: unknown } | undefined;
  return Boolean(delegate && typeof delegate.findMany === 'function');
}

function isCachedClientCompatible(client: PrismaClient) {
  const delegates = getModelDelegateNames();
  if (delegates.length === 0) return true;
  return delegates.every((delegateName) => hasFindManyDelegate(client, delegateName));
}

/**
 * Prisma Client Singleton
 * 
 * Creates a single Prisma client instance to prevent connection pool exhaustion.
 * In development, the client is stored globally to prevent multiple instances during hot reloads.
 */
const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.PG_POOL_IDLE ?? 10000),
    connectionTimeoutMillis: Number(process.env.PG_POOL_TIMEOUT ?? 10000),
    allowExitOnIdle: true,
    keepAlive: true,
  });

if (!globalForPrisma.prismaPool) {
  globalForPrisma.prismaPool = pool;
}

if (!globalForPrisma.prismaPoolInitialized) {
  pool.on('error', (err) => {
    // Log and allow the pool to recover by creating a new client on next checkout.
    console.error('Postgres pool error:', err);
  });
  globalForPrisma.prismaPoolInitialized = true;
}

const adapter = globalForPrisma.prismaAdapter ?? new PrismaPg(pool);
if (!globalForPrisma.prismaAdapter) {
  globalForPrisma.prismaAdapter = adapter;
}

const cachedClient = globalForPrisma.prisma;
const shouldUseCachedClient =
  Boolean(cachedClient) &&
  (process.env.NODE_ENV === 'production' || isCachedClientCompatible(cachedClient as PrismaClient));

if (cachedClient && !shouldUseCachedClient && process.env.NODE_ENV !== 'production') {
  console.warn('Stale Prisma client detected in global cache; reinitializing to match current schema.');
  globalForPrisma.prismaMiddlewareApplied = false;
  void cachedClient.$disconnect().catch(() => {});
}

let prismaClient =
  (shouldUseCachedClient ? cachedClient : undefined) ??
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
    maybeUse(async (params, next) => {
      const p = params as {
        model?: string;
        action?: string;
        args?: { data?: Record<string, unknown> };
      };

      if (p?.model === 'User' && (p.action === 'update' || p.action === 'upsert' || p.action === 'updateMany')) {
        const data = p.args?.data;
        if (data && typeof data.email === 'string' && !Object.prototype.hasOwnProperty.call(data, 'emailVerifiedAt')) {
          data.emailVerifiedAt = null;
        }
      }

      return reconnectOnce(() => next(params));
    });
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
