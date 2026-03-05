/**
 * Database Connection Layer
 * - SQLite (better-sqlite3) for local/dev workflows
 * - Postgres (pg) for durable production storage (Vercel DATABASE_URL)
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync, readFileSync } from 'fs';
import { Pool, types as pgTypes } from 'pg';

let db: Database.Database | null = null;

declare global {
  var __endlessMoltPgPool: Pool | undefined;
  var __endlessMoltPgSchemaInit: Promise<void> | undefined;
}

function debugDb() {
  return process.env.DEBUG_DB === 'true';
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function isPostgresUrl(value: string) {
  return /^(postgres|postgresql):/i.test(value.trim());
}

function getPostgresUrl(): string | null {
  const primary = process.env.DATABASE_URL ? stripWrappingQuotes(process.env.DATABASE_URL) : '';
  if (primary && isPostgresUrl(primary)) return primary;

  const fallbacks = [
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];

  for (const value of fallbacks) {
    const cleaned = value ? stripWrappingQuotes(value) : '';
    if (cleaned && isPostgresUrl(cleaned)) return cleaned;
  }

  return null;
}

export type DbBackend = 'postgres' | 'sqlite';

export function getDbBackend(): DbBackend {
  return getPostgresUrl() ? 'postgres' : 'sqlite';
}

function resolveSqlitePath(envValue?: string): string | null {
  if (!envValue) return null;
  const cleaned = stripWrappingQuotes(envValue);
  if (!cleaned) return null;

  // This app uses better-sqlite3 at runtime; ignore non-SQLite URLs (Postgres, etc).
  if (/^(postgres|postgresql|mysql|mariadb|http|https):/i.test(cleaned)) {
    return null;
  }

  if (cleaned.startsWith('file:')) {
    const withoutPrefix = cleaned.replace(/^file:/, '');
    const [pathOnly] = withoutPrefix.split('?');
    return pathOnly || null;
  }

  return cleaned;
}

function normalizePostgresConnectionString(raw: string): {
  connectionString: string;
  ssl?: boolean;
} {
  // Avoid provider-specific `sslmode=` warnings by stripping it and driving TLS via `ssl` option.
  // Security posture: if TLS is requested, verify certificates (Node default behavior).
  try {
    const url = new URL(raw);
    const ssl = url.searchParams.get('ssl');
    const sslMode = url.searchParams.get('sslmode');
    const wantsSsl =
      ssl === 'true' ||
      (sslMode !== null &&
        sslMode !== '' &&
        sslMode !== 'disable' &&
        sslMode !== 'allow');

    url.searchParams.delete('ssl');
    url.searchParams.delete('sslmode');

    return {
      connectionString: url.toString(),
      ssl: wantsSsl ? true : undefined,
    };
  } catch {
    return { connectionString: raw };
  }
}

function configurePgTypeParsers() {
  // bigint/int8 comes back as string by default; we use numbers throughout this app.
  // If these ever exceed MAX_SAFE_INTEGER, we should migrate types to bigint/decimal.
  pgTypes.setTypeParser(pgTypes.builtins.INT8, (value) => Number(value));
  pgTypes.setTypeParser(pgTypes.builtins.NUMERIC, (value) => Number(value));
}

function getPgPool(): Pool {
  const existing = globalThis.__endlessMoltPgPool;
  if (existing) return existing;

  const rawConnectionString = getPostgresUrl();
  if (!rawConnectionString) {
    throw new Error('Postgres is not configured (missing DATABASE_URL)');
  }

  configurePgTypeParsers();

  const { connectionString, ssl } = normalizePostgresConnectionString(rawConnectionString);
  const pool = new Pool({
    connectionString,
    ssl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  globalThis.__endlessMoltPgPool = pool;

  if (debugDb()) {
    console.log('📦 Postgres pool initialized');
  }

  return pool;
}

async function ensurePostgresSchema(): Promise<void> {
  if (globalThis.__endlessMoltPgSchemaInit) {
    return globalThis.__endlessMoltPgSchemaInit;
  }

  const init = (async () => {
    const pool = getPgPool();

    // Fast path: avoid reapplying the whole schema on every cold start.
    // If core objects exist, assume the schema has already been applied.
    try {
      const probe = await pool.query(
        `SELECT
           to_regclass('public.agents') as agents,
           to_regclass('public.listings') as listings,
           to_regclass('public.posts') as posts,
           to_regclass('public.post_comments') as post_comments,
           to_regclass('public.social_engagement_events') as social_engagement_events,
           to_regclass('public.feed_activity') as feed_activity`
      );
      const row = probe.rows?.[0] as Record<string, unknown> | undefined;
      const ok =
        !!row?.agents &&
        !!row?.listings &&
        !!row?.posts &&
        !!row?.post_comments &&
        !!row?.social_engagement_events &&
        !!row?.feed_activity;
      if (ok) return;
    } catch {
      // If the probe fails (permissions, transient connectivity), fall back to schema apply attempt.
    }

    const schemaPath = join(process.cwd(), 'database', 'schema.postgres.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    if (debugDb()) {
      console.log('📦 Postgres schema verified');
    }
  })();

  globalThis.__endlessMoltPgSchemaInit = init.catch((error) => {
    // Allow retries if the first attempt fails (transient provider error, cold start, etc).
    globalThis.__endlessMoltPgSchemaInit = undefined;
    throw error;
  });

  return globalThis.__endlessMoltPgSchemaInit;
}

/**
 * Get or create database connection
 */
export function getDb(): Database.Database {
  if (!db) {
    const envSqlitePath =
      resolveSqlitePath(process.env.DATABASE_PATH) ??
      resolveSqlitePath(process.env.DATABASE_URL);
    const vercelFallback = join('/tmp', 'endless-molt.db');
    const isVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
    const defaultPath = isVercel ? vercelFallback : join(process.cwd(), 'database', 'endless-molt.db');
    const dbPath = isVercel ? vercelFallback : envSqlitePath || defaultPath;

    // Ensure parent directory exists (Vercel only allows writes in /tmp)
    try {
      const dir = dirname(dbPath);
      if (dir && dir !== '.' && dir !== dbPath) {
        mkdirSync(dir, { recursive: true });
      }
    } catch (error) {
      console.warn('⚠️ Unable to ensure database directory exists:', error);
    }

    if (debugDb()) {
      console.log(`📦 Database path: ${dbPath} (vercel=${isVercel})`);
    }
    db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');

    // Ensure schema exists (especially on Vercel /tmp DB)
    try {
      const database = db as Database.Database;
      const requiredDbObjects = [
        { type: 'table', name: 'listings' },
        { type: 'table', name: 'listing_comments' },
        { type: 'table', name: 'artist_tokens' },
        { type: 'table', name: 'posts' },
        { type: 'table', name: 'post_comments' },
        { type: 'table', name: 'social_engagement_events' },
        { type: 'view', name: 'feed_activity' },
      ];

      const missingObject = requiredDbObjects.find(({ type, name }) => {
        const row = database
          .prepare(
            `SELECT name FROM sqlite_master WHERE type = ? AND name = ?`
          )
          .get(type, name) as { name: string } | undefined;
        return !row;
      });

      if (missingObject) {
        const schemaPath = join(process.cwd(), 'database', 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        database.exec(schema);
        if (debugDb()) {
          console.log(
            `📦 Database schema initialized (missing: ${missingObject.name})`
          );
        }
      }
    } catch (error) {
      console.warn('⚠️ Unable to verify/initialize schema:', error);
    }

    if (debugDb()) {
      console.log(`📦 Database connected: ${dbPath}`);
    }
  }

  return db;
}

/**
 * Close database connection
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    if (debugDb()) {
      console.log('📦 Database connection closed');
    }
  }
}

/**
 * Execute a transaction safely
 */
export function transaction<T>(fn: (db: Database.Database) => T): T {
  const database = getDb();
  const trans = database.transaction(fn);
  return trans(database);
}

/**
 * Type-safe query result
 */
export type QueryResult<T> = T | undefined;

/**
 * Type-safe query results array
 */
export type QueryResults<T> = T[];

function normalizeSql(sql: string) {
  // A lot of this codebase uses Postgres-style positional params ($1, $2, ...).
  // SQLite/better-sqlite3 supports positional params via `?`, so we normalize.
  return sql.replace(/\$(\d+)/g, '?');
}

function statementKind(sql: string) {
  const head = sql.trimStart().slice(0, 20).trim().split(/\s+/)[0]?.toLowerCase() || '';
  return head;
}

function toSqliteDatetimeUtc(value: Date) {
  // SQLite schema uses `datetime('now')` -> `YYYY-MM-DD HH:MM:SS` in UTC.
  // Matching that format keeps lexical comparisons correct.
  const iso = value.toISOString(); // `YYYY-MM-DDTHH:MM:SS.sssZ`
  return iso.slice(0, 19).replace('T', ' ');
}

function normalizeParamsForSqlite(params: any[]) {
  return params.map((param) => (param instanceof Date ? toSqliteDatetimeUtc(param) : param));
}

/**
 * Minimal query helpers used by some API routes.
 *
 * `query` returns rows for SELECT/CTE statements, otherwise returns the run result.
 * `queryOne` returns a single row for SELECT or `RETURNING` statements.
 */
export async function query(sql: string, params: any[] = []) {
  if (getDbBackend() === 'postgres') {
    await ensurePostgresSchema();
    const pool = getPgPool();
    const result = await pool.query(sql, params);
    const kind = statementKind(sql);
    if (kind === 'select' || kind === 'with' || kind === 'show') {
      return result.rows;
    }
    return result;
  }

  const database = getDb();
  const normalized = normalizeSql(sql);
  const kind = statementKind(normalized);
  const stmt = database.prepare(normalized);
  const boundParams = normalizeParamsForSqlite(params);

  if (kind === 'select' || kind === 'with' || kind === 'pragma') {
    return stmt.all(boundParams);
  }

  return stmt.run(boundParams);
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
  if (getDbBackend() === 'postgres') {
    await ensurePostgresSchema();
    const pool = getPgPool();
    const result = await pool.query(sql, params);
    const kind = statementKind(sql);
    const hasReturning = /\breturning\b/i.test(sql);

    if (kind === 'select' || kind === 'with' || hasReturning) {
      return (result.rows[0] as T | undefined) ?? undefined;
    }
    return undefined;
  }

  const database = getDb();
  const normalized = normalizeSql(sql);
  const kind = statementKind(normalized);
  const stmt = database.prepare(normalized);
  const hasReturning = /\breturning\b/i.test(normalized);
  const boundParams = normalizeParamsForSqlite(params);

  if (kind === 'select' || kind === 'with' || kind === 'pragma' || hasReturning) {
    return stmt.get(boundParams) as QueryResult<T>;
  }

  // Non-returning writes: execute and return undefined.
  stmt.run(boundParams);
  return undefined;
}
