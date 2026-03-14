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

function normalizeSqlitePath(input?: string) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return undefined;

  const unquoted = trimmed.replace(/^['"]+|['"]+$/g, '');
  if (!unquoted) return undefined;

  if (unquoted === ':memory:') {
    return unquoted;
  }

  if (unquoted.startsWith('file:')) {
    return unquoted.replace(/^file:/, '');
  }

  // Ignore remote database URLs when booting the local SQLite adapter.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(unquoted)) {
    return undefined;
  }

  return unquoted;
}

/**
 * Get or create database connection
 */
export function getDb(): Database.Database {
  if (!db) {
    const envPath = process.env.DATABASE_URL || process.env.DATABASE_PATH;
    const normalizedEnvPath = normalizeSqlitePath(envPath);
    const vercelFallback = join('/tmp', 'endless-molt.db');
    const isVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
    const defaultPath = isVercel ? vercelFallback : join(process.cwd(), 'database', 'endless-molt.db');
    const dbPath = isVercel ? vercelFallback : normalizedEnvPath || defaultPath;

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
      const listingsRow = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='listings'").get() as
        | { name: string }
        | undefined;
      const commentsRow = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='listing_comments'").get() as
        | { name: string }
        | undefined;
      if (!listingsRow || !commentsRow) {
        const schemaPath = join(process.cwd(), 'database', 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        db.exec(schema);
        if (debugDb()) {
          console.log('📦 Database schema initialized');
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
