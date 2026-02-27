/**
 * Database Connection Layer
 * Singleton wrapper for better-sqlite3
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync, readFileSync } from 'fs';

let db: Database.Database | null = null;

function debugDb() {
  return process.env.DEBUG_DB === 'true';
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
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

/**
 * Minimal query helpers used by some API routes.
 *
 * `query` returns rows for SELECT/CTE statements, otherwise returns the run result.
 * `queryOne` returns a single row for SELECT or `RETURNING` statements.
 */
export function query(sql: string, params: any[] = []) {
  const database = getDb();
  const normalized = normalizeSql(sql);
  const kind = statementKind(normalized);
  const stmt = database.prepare(normalized);

  if (kind === 'select' || kind === 'with' || kind === 'pragma') {
    return stmt.all(params);
  }

  return stmt.run(params);
}

export function queryOne<T = any>(sql: string, params: any[] = []): QueryResult<T> {
  const database = getDb();
  const normalized = normalizeSql(sql);
  const kind = statementKind(normalized);
  const stmt = database.prepare(normalized);
  const hasReturning = /\breturning\b/i.test(normalized);

  if (kind === 'select' || kind === 'with' || kind === 'pragma' || hasReturning) {
    return stmt.get(params) as QueryResult<T>;
  }

  // Non-returning writes: execute and return undefined.
  stmt.run(params);
  return undefined;
}
