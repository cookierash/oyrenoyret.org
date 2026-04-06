const ONLINE_TTL_MS = 2 * 60 * 1000;

type OnlineStore = Map<string, number>;

const globalForOnline = globalThis as typeof globalThis & {
  onlineUsers?: OnlineStore;
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

export function touchOnlineUser(userId: string, now = Date.now()): number {
  cleanup(now);
  onlineUsers.set(userId, now);
  return onlineUsers.size;
}

export function getOnlineCount(now = Date.now()): number {
  cleanup(now);
  return onlineUsers.size;
}
