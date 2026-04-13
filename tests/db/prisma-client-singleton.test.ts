import { describe, expect, it, vi } from 'vitest';

function lcFirst(value: string) {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

describe('src/db/client prisma singleton', () => {
  it('reinitializes a stale cached Prisma client when model delegates changed', async () => {
    vi.resetModules();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const globalAny = globalThis as any;
    delete globalAny.prisma;
    delete globalAny.prismaMiddlewareApplied;
    delete globalAny.prismaPool;
    delete globalAny.prismaPoolInitialized;
    delete globalAny.prismaAdapter;

    vi.doMock('pg', () => {
      class Pool {
        on() {}
      }
      return { Pool };
    });

    vi.doMock('@prisma/adapter-pg', () => {
      class PrismaPg {
        constructor(_pool: unknown) {}
      }
      return { PrismaPg };
    });

    const ModelName = {
      User: 'User',
      UserReport: 'UserReport',
    } as const;

    class PrismaClientKnownRequestError extends Error {}

    class PrismaClient {
      $use() {}
      $disconnect() {
        return Promise.resolve();
      }
      $connect() {
        return Promise.resolve();
      }
      constructor() {
        for (const modelName of Object.values(ModelName)) {
          (this as any)[lcFirst(modelName)] = {
            findMany: () => Promise.resolve([]),
          };
        }
      }
    }

    vi.doMock('@prisma/client', () => ({
      PrismaClient,
      Prisma: {
        ModelName,
        PrismaClientKnownRequestError,
      },
    }));

    const staleClient = {
      user: { findMany: () => Promise.resolve([]) },
      $disconnect: () => Promise.resolve(),
      $use: () => {},
    };

    globalAny.prisma = staleClient;
    globalAny.prismaMiddlewareApplied = true;

    const { prisma } = await import('@/src/db/client');

    expect(prisma).not.toBe(staleClient);
    expect(globalAny.prisma).toBe(prisma);
    expect(typeof (prisma as any).userReport?.findMany).toBe('function');

    warnSpy.mockRestore();
  });
});

