import "server-only";

import { getDb } from "@/lib/db";
import { z } from "zod";
import { randomUUID } from "crypto";

export const PieceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  video_url: z.string().nullable(),
  prompt: z.string().nullable(),
  negative_prompt: z.string().nullable(),
  seed: z.number().int().nullable(),
  model: z.string().nullable(),
  lora: z.string().nullable(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Piece = z.infer<typeof PieceSchema>;

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type PieceRow = Record<string, unknown>;

function rowToPiece(row: unknown): Piece {
  const r: PieceRow = typeof row === "object" && row !== null ? (row as PieceRow) : {};
  return PieceSchema.parse({
    ...(r as Record<string, unknown>),
    tags: parseJson(typeof r.tags_json === "string" ? r.tags_json : null, [] as string[]),
    metadata: parseJson(
      typeof r.metadata_json === "string" ? r.metadata_json : null,
      {} as Record<string, unknown>
    ),
  });
}

export function listPieces(args?: { limit?: number; offset?: number }) {
  const limit = Math.max(1, Math.min(200, args?.limit ?? 60));
  const offset = Math.max(0, args?.offset ?? 0);
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT *
      FROM pieces
      ORDER BY datetime(created_at) DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(limit, offset);
  return rows.map(rowToPiece);
}

export function getPiece(id: string) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM pieces WHERE id = ?`).get(id);
  if (!row) return null;
  return rowToPiece(row);
}

export const CreatePieceInputSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  image_url: z.string().url().optional(),
  video_url: z.string().url().optional(),
  prompt: z.string().max(4000).optional(),
  negative_prompt: z.string().max(4000).optional(),
  seed: z.number().int().optional(),
  model: z.string().max(200).optional(),
  lora: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreatePieceInput = z.infer<typeof CreatePieceInputSchema>;

export function createPiece(input: CreatePieceInput) {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const tagsJson = JSON.stringify(input.tags || []);
  const metadataJson = JSON.stringify(input.metadata || {});

  db.prepare(
    `
    INSERT INTO pieces (
      id, title, description, image_url, video_url,
      prompt, negative_prompt, seed, model, lora,
      tags_json, metadata_json, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `
  ).run(
    id,
    input.title,
    input.description ?? null,
    input.image_url ?? null,
    input.video_url ?? null,
    input.prompt ?? null,
    input.negative_prompt ?? null,
    input.seed ?? null,
    input.model ?? null,
    input.lora ?? null,
    tagsJson,
    metadataJson,
    now,
    now
  );

  return getPiece(id)!;
}
