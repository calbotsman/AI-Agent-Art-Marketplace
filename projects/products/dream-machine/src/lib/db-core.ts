import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { getEnv } from "@/lib/env";

let db: Database.Database | null = null;

function dbPath() {
  const env = getEnv();
  return env.DREAM_MACHINE_DB_PATH || join(process.cwd(), "data", "dream-machine.db");
}

function ensureParentDir(path: string) {
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    // ignore
  }
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS pieces (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      video_url TEXT,
      prompt TEXT,
      negative_prompt TEXT,
      seed INTEGER,
      model TEXT,
      lora TEXT,
      tags_json TEXT,
      metadata_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pieces_created_at ON pieces(created_at);

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('pending','running','succeeded','failed')) DEFAULT 'pending',
      kind TEXT NOT NULL CHECK(kind IN ('image_to_video','text_to_image','pipeline')) DEFAULT 'pipeline',
      title TEXT,
      prompt TEXT,
      negative_prompt TEXT,
      seed INTEGER,
      model TEXT,
      lora TEXT,
      source_image_url TEXT,
      workflow_json TEXT,
      output_image_url TEXT,
      output_video_url TEXT,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at);
  `);
}

export function getDb() {
  if (db) return db;

  const path = dbPath();
  ensureParentDir(path);
  const database = new Database(path);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  initSchema(database);
  db = database;
  return db;
}

