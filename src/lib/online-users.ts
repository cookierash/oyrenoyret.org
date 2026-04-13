import { Redis } from '@upstash/redis';

const ONLINE_TTL_MS = 2 * 60 * 1000;
const ONLINE_ZSET_KEY = 'oyrenoyret:online-users';

type OnlineStore = Map<string, number>;

const globalForOnline = globalThis as typeof globalThis & {
  onlineUsers?: OnlineStore;
  onlineUsersRedis?: Redis;
};

const onlineUsers = globalForOnline.onlineUsers ?? new Map<string, number>();

if (!globalForOnline.onlineUsers) {
  globalForOnline.onlineUsers = onlineUsers;
}

function cleanup(now: number) {
  for (const [userId, lastSeen] of onlineUsers.entries()) {
    if (now - lastSeen > ONLINE_TTL_MS) {
      onlineUsers.delete(userId);
    }
  }
}

const hasUpstashConfig =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

function getRedis(): Redis | null {
  if (!hasUpstashConfig) return null;
  if (globalForOnline.onlineUsersRedis) return globalForOnline.onlineUsersRedis;
  try {
    const redis = Redis.fromEnv();
    globalForOnline.onlineUsersRedis = redis;
    return redis;
  } catch {
    return null;
  }
}

async function cleanupRedis(redis: Redis, now: number) {
  const cutoff = now - ONLINE_TTL_MS;
  // Remove stale members so ZCARD reflects "tabs currently open" (within TTL).
  await redis.zremrangebyscore(ONLINE_ZSET_KEY, 0, cutoff);
}

export async function touchOnlineUser(userId: string, now = Date.now()): Promise<number> {
  const redis = getRedis();
  if (redis) {
    await redis.zadd(ONLINE_ZSET_KEY, { score: now, member: userId });
    await cleanupRedis(redis, now);
    const count = await redis.zcard(ONLINE_ZSET_KEY);
    return typeof count === 'number' ? count : Number(count ?? 0);
  }

  cleanup(now);
  onlineUsers.set(userId, now);
  return onlineUsers.size;
}

export async function getOnlineCount(now = Date.now()): Promise<number> {
  const redis = getRedis();
  if (redis) {
    await cleanupRedis(redis, now);
    const count = await redis.zcard(ONLINE_ZSET_KEY);
    return typeof count === 'number' ? count : Number(count ?? 0);
  }

  cleanup(now);
  return onlineUsers.size;
}
