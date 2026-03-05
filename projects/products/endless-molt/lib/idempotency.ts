import { NextRequest, NextResponse } from 'next/server';

type StoredResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  stored_at: number;
};

type RequestLike = NextRequest | { headers: Headers };
type Store = Map<string, { value: StoredResponse; expiresAtMs: number }>;

type BeginIdempotencyOptions = {
  bucket: string;
  ttlMs: number;
  keySuffix?: string;
};

type BeginIdempotencyResult = {
  replay: NextResponse | null;
  key: string | null;
  commit: (response: Response) => Promise<void>;
  keyErrorResponse?: NextResponse;
};

type RedisConfig = {
  url: string;
  token: string;
};

const IDEM_HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 128;
const MIN_KEY_LENGTH = 8;
const MAX_BODY_STORE_BYTES = 256_000;
const PRUNE_EVERY_CALLS = 200;

let calls = 0;

function getRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

function getStore(): Store {
  const globalWithStore = globalThis as typeof globalThis & {
    __endlessMoltIdempotencyStore?: Store;
  };

  if (!globalWithStore.__endlessMoltIdempotencyStore) {
    globalWithStore.__endlessMoltIdempotencyStore = new Map<string, { value: StoredResponse; expiresAtMs: number }>();
  }

  return globalWithStore.__endlessMoltIdempotencyStore;
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

function buildStorageKey(request: RequestLike, options: BeginIdempotencyOptions, key: string) {
  return `em:idem:${options.bucket}:${getClientKey(request)}:${options.keySuffix || 'default'}:${key}`;
}

function maybePruneMemoryStore(store: Store) {
  calls += 1;
  if (calls % PRUNE_EVERY_CALLS !== 0) return;
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.expiresAtMs <= now) {
      store.delete(key);
    }
  }
}

function isHeaderAllowed(name: string) {
  const lower = name.toLowerCase();
  if (lower === 'set-cookie') return false;
  if (lower === 'content-length') return false;
  return true;
}

function toNextResponse(stored: StoredResponse, replay = false) {
  const headers = new Headers(stored.headers);
  if (replay) headers.set('x-idempotent-replay', 'true');
  return new NextResponse(stored.body, { status: stored.status, headers });
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

async function redisGetStored(config: RedisConfig, key: string): Promise<StoredResponse | null> {
  const raw = await redisCommand(config, 'get', [key]);
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as StoredResponse;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.status !== 'number' || typeof parsed.body !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function redisSetStored(config: RedisConfig, key: string, ttlMs: number, value: StoredResponse) {
  await redisCommand(config, 'set', [key, JSON.stringify(value), 'PX', String(ttlMs)]);
}

async function getStoredResponse(storageKey: string): Promise<StoredResponse | null> {
  const redisConfig = getRedisConfig();
  if (redisConfig) {
    try {
      return await redisGetStored(redisConfig, storageKey);
    } catch {
      // fall through to memory store
    }
  }

  const store = getStore();
  maybePruneMemoryStore(store);
  const hit = store.get(storageKey);
  if (!hit) return null;
  if (hit.expiresAtMs <= Date.now()) {
    store.delete(storageKey);
    return null;
  }
  return hit.value;
}

async function setStoredResponse(storageKey: string, ttlMs: number, value: StoredResponse): Promise<void> {
  const redisConfig = getRedisConfig();
  if (redisConfig) {
    try {
      await redisSetStored(redisConfig, storageKey, ttlMs, value);
      return;
    } catch {
      // fall through to memory store
    }
  }

  const store = getStore();
  maybePruneMemoryStore(store);
  store.set(storageKey, {
    value,
    expiresAtMs: Date.now() + ttlMs,
  });
}

function parseIncomingKey(request: RequestLike) {
  const key = request.headers.get(IDEM_HEADER)?.trim();
  if (!key) return { key: null, error: null };
  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
    return { key: null, error: `Idempotency key must be ${MIN_KEY_LENGTH}-${MAX_KEY_LENGTH} characters.` };
  }
  if (!/^[A-Za-z0-9_.:-]+$/.test(key)) {
    return { key: null, error: 'Idempotency key contains invalid characters.' };
  }
  return { key, error: null };
}

export async function beginIdempotency(
  request: RequestLike,
  options: BeginIdempotencyOptions,
): Promise<BeginIdempotencyResult> {
  const parsed = parseIncomingKey(request);
  if (parsed.error) {
    return {
      replay: null,
      key: null,
      keyErrorResponse: NextResponse.json({ error: parsed.error }, { status: 400 }),
      commit: async () => {},
    };
  }

  if (!parsed.key) {
    return {
      replay: null,
      key: null,
      commit: async () => {},
    };
  }

  const storageKey = buildStorageKey(request, options, parsed.key);
  const existing = await getStoredResponse(storageKey);
  if (existing) {
    return {
      replay: toNextResponse(existing, true),
      key: parsed.key,
      commit: async () => {},
    };
  }

  return {
    replay: null,
    key: parsed.key,
    commit: async (response: Response) => {
      if (response.status >= 500) return;

      const cloned = response.clone();
      const body = await cloned.text();
      if (body.length > MAX_BODY_STORE_BYTES) return;

      const headers: Record<string, string> = {};
      cloned.headers.forEach((value, name) => {
        if (isHeaderAllowed(name)) {
          headers[name] = value;
        }
      });

      const payload: StoredResponse = {
        status: cloned.status,
        headers,
        body,
        stored_at: Date.now(),
      };

      await setStoredResponse(storageKey, options.ttlMs, payload);
    },
  };
}
