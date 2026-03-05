import { NextResponse } from 'next/server';

type BucketState = {
  count: number;
  resetAtMs: number;
};

type RateLimitStore = Map<string, BucketState>;
type RequestLike = Request | { headers: Headers };
type RedisConfig = {
  url: string;
  token: string;
};

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowMs: number;
  keySuffix?: string;
};

type RateLimitSuccess = {
  ok: true;
  headers: Headers;
};

type RateLimitFailure = {
  ok: false;
  response: NextResponse;
};

type RateLimitResult = RateLimitSuccess | RateLimitFailure;

const PRUNE_EVERY_CALLS = 200;
let callCount = 0;
let lastRedisFallbackLogAt = 0;

function getStore(): RateLimitStore {
  const globalWithStore = globalThis as typeof globalThis & {
    __endlessMoltRateLimitStore?: RateLimitStore;
  };

  if (!globalWithStore.__endlessMoltRateLimitStore) {
    globalWithStore.__endlessMoltRateLimitStore = new Map<string, BucketState>();
  }

  return globalWithStore.__endlessMoltRateLimitStore;
}

function getRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) return null;

  return {
    url: url.replace(/\/+$/, ''),
    token,
  };
}

function getClientKey(request: RequestLike) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    if (first?.trim()) return first.trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp?.trim()) return realIp.trim();

  return 'unknown-client';
}

function buildHeaders(limit: number, remaining: number, resetAtMs: number) {
  const headers = new Headers();
  headers.set('x-ratelimit-limit', String(limit));
  headers.set('x-ratelimit-remaining', String(Math.max(0, remaining)));
  headers.set('x-ratelimit-reset', String(Math.ceil(resetAtMs / 1000)));
  return headers;
}

async function redisCommand(config: RedisConfig, command: string, args: string[]) {
  const encoded = args.map((value) => encodeURIComponent(value));
  const url = `${config.url}/${command}${encoded.length ? `/${encoded.join('/')}` : ''}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`redis ${command} failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { result?: unknown };
  return payload.result;
}

function maybeLogRedisFallback(error: unknown) {
  const now = Date.now();
  if (now - lastRedisFallbackLogAt < 60_000) return;
  lastRedisFallbackLogAt = now;
  const message = error instanceof Error ? error.message : String(error);
  console.error('[rate-limit] Redis unavailable, falling back to in-memory limiter:', message);
}

async function checkRateLimitRedis(
  request: RequestLike,
  options: RateLimitOptions,
): Promise<RateLimitResult | null> {
  const config = getRedisConfig();
  if (!config) return null;

  const key = `em:rl:${options.bucket}:${getClientKey(request)}:${options.keySuffix || 'default'}`;
  try {
    const incremented = await redisCommand(config, 'incr', [key]);
    const count = Number(incremented || 0);

    if (count === 1) {
      await redisCommand(config, 'pexpire', [key, String(options.windowMs)]);
    }

    const ttl = await redisCommand(config, 'pttl', [key]);
    const ttlMs = Math.max(0, Number(ttl || options.windowMs));
    const resetAtMs = Date.now() + ttlMs;

    if (count > options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
      const headers = buildHeaders(options.limit, 0, resetAtMs);
      headers.set('retry-after', String(retryAfterSeconds));
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'Too many requests. Please retry shortly.',
            retry_after_seconds: retryAfterSeconds,
          },
          {
            status: 429,
            headers,
          },
        ),
      };
    }

    return {
      ok: true,
      headers: buildHeaders(options.limit, options.limit - count, resetAtMs),
    };
  } catch (error) {
    maybeLogRedisFallback(error);
    return null;
  }
}

function maybePrune(store: RateLimitStore, now: number) {
  callCount += 1;
  if (callCount % PRUNE_EVERY_CALLS !== 0) return;

  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAtMs <= now) {
      store.delete(key);
    }
  }
}

export async function checkRateLimit(
  request: RequestLike,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const redisResult = await checkRateLimitRedis(request, options);
  if (redisResult) {
    return redisResult;
  }

  const now = Date.now();
  const key = `${options.bucket}:${getClientKey(request)}:${options.keySuffix || 'default'}`;
  const store = getStore();
  maybePrune(store, now);
  const current = store.get(key);

  if (!current || current.resetAtMs <= now) {
    const resetAtMs = now + options.windowMs;
    store.set(key, { count: 1, resetAtMs });
    return {
      ok: true,
      headers: buildHeaders(options.limit, options.limit - 1, resetAtMs),
    };
  }

  if (current.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAtMs - now) / 1000));
    const headers = buildHeaders(options.limit, 0, current.resetAtMs);
    headers.set('retry-after', String(retryAfterSeconds));
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Too many requests. Please retry shortly.',
          retry_after_seconds: retryAfterSeconds,
        },
        {
          status: 429,
          headers,
        },
      ),
    };
  }

  current.count += 1;
  store.set(key, current);
  return {
    ok: true,
    headers: buildHeaders(options.limit, options.limit - current.count, current.resetAtMs),
  };
}

export function applyRateLimitHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}
