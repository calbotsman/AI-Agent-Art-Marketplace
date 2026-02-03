/**
 * Database Connection Layer
 * Singleton wrapper for better-sqlite3
 */

import Database from 'better-sqlite3';
import { join } from 'path';

let db: Database.Database | null = null;

/**
 * Get or create database connection
 */
export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || join(process.cwd(), 'database', 'endless-molt.db');

    db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');

    console.log(`📦 Database connected: ${dbPath}`);
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
    console.log('📦 Database connection closed');
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
