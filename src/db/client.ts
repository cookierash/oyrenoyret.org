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

let prismaSingleton: PrismaClient | undefined;

function getDatabaseUrlFromEnv() {
  return (
    process.env.DATABASE_URL ??
    process.env.DATABASE_PRISMA_DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DIRECT_URL
  );
}

function coerceBoolean(value: string | undefined) {
  if (!value) return undefined;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  return undefined;
}

function safeDbTargetLabel(databaseUrl: URL) {
  const db = databaseUrl.pathname?.replace(/^\//, '') || '(unknown-db)';
  const port = databaseUrl.port ? `:${databaseUrl.port}` : '';
  return `${databaseUrl.hostname}${port}/${db}`;
}

function buildPostgresConnection(databaseUrlRaw: string) {
  let databaseUrl: URL | undefined;
  try {
    databaseUrl = new URL(databaseUrlRaw);
  } catch {
    // Some connection strings may include unescaped characters in credentials.
    // Fall back to using the raw string and rely on explicit PG_* env vars.
    const rejectUnauthorized =
      coerceBoolean(process.env.PG_SSL_REJECT_UNAUTHORIZED) ?? true;
    const sslForcedOff = coerceBoolean(process.env.PG_SSL) === false;
    const shouldUseSsl = process.env.NODE_ENV === 'production' && !sslForcedOff;
    return {
      connectionString: databaseUrlRaw,
      ssl: shouldUseSsl ? { rejectUnauthorized } : undefined,
      targetLabel: '(unparsed DATABASE_URL)',
      sslMode: process.env.PG_SSLMODE,
    };
  }
  const sslModeFromEnv = process.env.PG_SSLMODE;
  const isProduction = process.env.NODE_ENV === 'production';

  if (
    isProduction &&
    (databaseUrl.hostname === 'localhost' ||
      databaseUrl.hostname === '127.0.0.1' ||
      databaseUrl.hostname === '0.0.0.0')
  ) {
    throw new Error(
      `DATABASE_URL points to a local host (${safeDbTargetLabel(
        databaseUrl
      )}); Vercel cannot reach localhost. Set a publicly reachable Postgres host.`
    );
  }

  if (sslModeFromEnv) {
    databaseUrl.searchParams.set('sslmode', sslModeFromEnv);
  } else if (isProduction && !databaseUrl.searchParams.has('sslmode')) {
    // Default to SSL in production because most managed Postgres providers require TLS.
    databaseUrl.searchParams.set('sslmode', 'require');
  }

  const sslMode = databaseUrl.searchParams.get('sslmode')?.toLowerCase();
  const sslDisabled = sslMode === 'disable';
  const sslForcedOff = coerceBoolean(process.env.PG_SSL) === false;
  const shouldUseSsl = !sslDisabled && !sslForcedOff && Boolean(sslMode && sslMode !== 'prefer');

  const rejectUnauthorized =
    coerceBoolean(process.env.PG_SSL_REJECT_UNAUTHORIZED) ?? true;

  return {
    connectionString: databaseUrl.toString(),
    ssl: shouldUseSsl ? { rejectUnauthorized } : undefined,
    targetLabel: safeDbTargetLabel(databaseUrl),
    sslMode,
  };
}

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

function initPrismaPool(): Pool {
  const databaseUrl = getDatabaseUrlFromEnv();
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  const { connectionString, ssl, targetLabel, sslMode } = buildPostgresConnection(databaseUrl);

  const pool =
    globalForPrisma.prismaPool ??
    new Pool({
      connectionString,
      ssl,
      max: Number(
        process.env.PG_POOL_MAX ?? (process.env.NODE_ENV === 'production' ? 1 : 10)
      ),
      idleTimeoutMillis: Number(process.env.PG_POOL_IDLE ?? 10000),
      connectionTimeoutMillis: Number(
        process.env.PG_POOL_TIMEOUT ?? (process.env.NODE_ENV === 'production' ? 30000 : 10000)
      ),
      allowExitOnIdle: true,
      keepAlive: true,
    });

  if (!globalForPrisma.prismaPool) {
    globalForPrisma.prismaPool = pool;
  }

  if (!globalForPrisma.prismaPoolInitialized) {
    console.info(
      `Postgres pool configured: target=${targetLabel} sslmode=${sslMode ?? '(default)'} ssl=${
        ssl ? 'on' : 'off'
      }`
    );
    pool.on('error', (err) => {
      // Log and allow the pool to recover by creating a new client on next checkout.
      console.error('Postgres pool error:', err);
    });
    globalForPrisma.prismaPoolInitialized = true;
  }

  return pool;
}

function initPrismaAdapter(): PrismaPg {
  const adapter =
    globalForPrisma.prismaAdapter ??
    new PrismaPg(initPrismaPool());

  if (!globalForPrisma.prismaAdapter) {
    globalForPrisma.prismaAdapter = adapter;
  }

  return adapter;
}

function initPrismaClient(): PrismaClient {
  const cachedClient = globalForPrisma.prisma;
  const shouldUseCachedClient =
    Boolean(cachedClient) &&
    (process.env.NODE_ENV === 'production' ||
      isCachedClientCompatible(cachedClient as PrismaClient));

  if (cachedClient && !shouldUseCachedClient && process.env.NODE_ENV !== 'production') {
    console.warn('Stale Prisma client detected in global cache; reinitializing to match current schema.');
    globalForPrisma.prismaMiddlewareApplied = false;
    void cachedClient.$disconnect().catch(() => {});
  }

  let prismaClient =
    (shouldUseCachedClient ? cachedClient : undefined) ??
    new PrismaClient({
      adapter: initPrismaAdapter(),
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

    type PrismaMiddleware = (
      params: unknown,
      next: (params: unknown) => Promise<unknown>
    ) => Promise<unknown>;
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

        if (
          p?.model === 'User' &&
          (p.action === 'update' || p.action === 'upsert' || p.action === 'updateMany')
        ) {
          const data = p.args?.data;
          if (
            data &&
            typeof data.email === 'string' &&
            !Object.prototype.hasOwnProperty.call(data, 'emailVerifiedAt')
          ) {
            data.emailVerifiedAt = null;
          }
        }

        return reconnectOnce(() => next(params));
      });
    } else if (typeof maybeExtends === 'function') {
      prismaClient = prismaClient.$extends({
        query: {
          $allModels: {
            $allOperations: async ({ args, query }) => reconnectOnce(() => query(args)),
          },
        },
      }) as unknown as PrismaClient;
    } else {
      console.warn('Prisma middleware is not available in this runtime.');
    }

    globalForPrisma.prismaMiddlewareApplied = true;
  }

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaClient;
  }

  return prismaClient;
}

function getPrismaClient(): PrismaClient {
  if (prismaSingleton) return prismaSingleton;

  const cachedClient = globalForPrisma.prisma;
  const shouldUseCachedClient =
    Boolean(cachedClient) &&
    (process.env.NODE_ENV === 'production' ||
      isCachedClientCompatible(cachedClient as PrismaClient));

  prismaSingleton = shouldUseCachedClient ? (cachedClient as PrismaClient) : initPrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaSingleton;
  }

  return prismaSingleton;
}

export const prisma: PrismaClient = new Proxy(
  {} as PrismaClient,
  {
    get(_target, prop) {
      const client = getPrismaClient() as unknown as Record<string, unknown>;
      const value = client[prop as keyof typeof client];
      if (typeof value !== 'function') return value;
      const fn = value as (...args: unknown[]) => unknown;
      return fn.bind(client);
    },
  }
);
