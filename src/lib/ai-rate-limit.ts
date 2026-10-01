import "server-only";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { randomUUID } from "node:crypto";

export class AiLimiterUnavailable extends Error {
  constructor() { super("AI užklausų ribojimo paslauga nepasiekiama. Pabandykite vėliau."); }
}

// Atomic leases: one per caller bucket and two globally. Expiry also covers a
// killed function. Unique owners prevent a late release from removing a new lease.
const acquireLease = `-- acquire-ai-lease
local now = redis.call('TIME')
local ms = now[1] * 1000 + math.floor(now[2] / 1000)
for i = 1, 2 do redis.call('ZREMRANGEBYSCORE', KEYS[i], '-inf', ms) end
if redis.call('ZCARD', KEYS[1]) >= 2 or redis.call('ZCARD', KEYS[2]) >= 1 then return 0 end
for i = 1, 2 do
  redis.call('ZADD', KEYS[i], ms + 90000, ARGV[1])
  redis.call('PEXPIRE', KEYS[i], 90000)
end
return 1`;
const releaseLease = `-- release-ai-lease
for i = 1, 2 do redis.call('ZREM', KEYS[i], ARGV[1]) end
return 1`;

type Permit = { release: () => Promise<void> } | { retryAfter: number };
// Internal test injection only; never read from HTTP input or environment.
export function createAiLimiter(testPrefix?: string) {
  if (testPrefix !== undefined && !/^fridge-rescue:TEST-ONLY:[a-zA-Z0-9:-]{1,160}$/.test(testPrefix)) {
    throw new Error("Netinkamas testavimo prefiksas.");
  }
  let clients: { redis: Redis; caller: Ratelimit; global: Ratelimit; prefix: string } | undefined;
  function getClients() {
    if (clients) return clients;
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!url || !token) throw new AiLimiterUnavailable();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") throw new Error();
    } catch { throw new AiLimiterUnavailable(); }
    const redis = new Redis({ url, token, retry: false, signal: () => AbortSignal.timeout(1000) });
    // Stable across deployments; preview/development do not consume production quota.
    const environment = process.env.VERCEL_ENV === "preview" ? "preview" : process.env.NODE_ENV === "production" ? "production" : "development";
    const prefix = testPrefix ?? `fridge-rescue:ai:v1:${environment}`;
    const common = { redis, analytics: false, ephemeralCache: false as const, timeout: 1000 };
    clients = { redis, prefix,
      caller: new Ratelimit({ ...common, prefix: `${prefix}:caller`, limiter: Ratelimit.fixedWindow(5, "60 s") }),
      global: new Ratelimit({ ...common, prefix: `${prefix}:global`, limiter: Ratelimit.fixedWindow(20, "60 s") }),
    };
    return clients;
  }
  return {
    async acquire(key: string): Promise<Permit> {
      try {
        const { redis, caller, global, prefix } = getClients();
        const keys = [`${prefix}:active`, `${prefix}:active:${key}`];
        const owner = randomUUID();
        const acquired = await redis.eval(acquireLease, keys, [owner]);
        if (acquired === 0) return { retryAfter: 1 };
        if (acquired !== 1) throw new AiLimiterUnavailable();
        let released = false;
        const release = async () => {
          if (released) return;
          released = true;
          try { await redis.eval(releaseLease, keys, [owner]); }
          catch { /* No raw logs; lease expires. Do not discard a generated response. */ }
        };
        try {
          for (const [limiter, identifier] of [[caller, key], [global, "all"]] as const) {
            const result = await limiter.limit(identifier);
            await result.pending;
            // The SDK's timeout is fail-open; the application explicitly fails closed.
            if (result.reason === "timeout") throw new AiLimiterUnavailable();
            if (!result.success) {
              await release();
              return { retryAfter: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)) };
            }
          }
          return { release };
        } catch {
          await release();
          throw new AiLimiterUnavailable();
        }
      } catch { throw new AiLimiterUnavailable(); }
    },
  };
}
export const aiLimiter = createAiLimiter();
