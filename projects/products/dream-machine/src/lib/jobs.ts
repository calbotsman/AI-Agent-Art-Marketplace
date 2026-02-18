import "server-only";

import { randomUUID } from "crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";

export const JobSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "running", "succeeded", "failed"]),
  kind: z.enum(["image_to_video", "text_to_image", "pipeline"]),
  title: z.string().nullable(),
  prompt: z.string().nullable(),
  negative_prompt: z.string().nullable(),
  seed: z.number().int().nullable(),
  model: z.string().nullable(),
  lora: z.string().nullable(),
  source_image_url: z.string().nullable(),
  workflow_json: z.string().nullable(),
  output_image_url: z.string().nullable(),
  output_video_url: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Job = z.infer<typeof JobSchema>;

function rowToJob(row: unknown): Job {
  return JobSchema.parse(row);
}

export const CreateJobInputSchema = z.object({
  kind: z.enum(["image_to_video", "text_to_image", "pipeline"]).default("pipeline"),
  title: z.string().max(160).optional(),
  prompt: z.string().max(4000).optional(),
  negative_prompt: z.string().max(4000).optional(),
  seed: z.number().int().optional(),
  model: z.string().max(200).optional(),
  lora: z.string().max(200).optional(),
  source_image_url: z.string().url().optional(),
  workflow_json: z.string().optional(),
});

export type CreateJobInput = z.infer<typeof CreateJobInputSchema>;

export function listJobs(args?: { status?: Job["status"]; limit?: number; offset?: number }) {
  const limit = Math.max(1, Math.min(200, args?.limit ?? 50));
  const offset = Math.max(0, args?.offset ?? 0);
  const db = getDb();

  if (args?.status) {
    const rows = db
      .prepare(
        `
        SELECT *
        FROM jobs
        WHERE status = ?
        ORDER BY datetime(created_at) ASC
        LIMIT ? OFFSET ?
      `
      )
      .all(args.status, limit, offset);
    return rows.map(rowToJob);
  }

  const rows = db
    .prepare(
      `
      SELECT *
      FROM jobs
      ORDER BY datetime(created_at) DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(limit, offset);
  return rows.map(rowToJob);
}

export function getJob(id: string) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);
  if (!row) return null;
  return rowToJob(row);
}

export function createJob(input: CreateJobInput) {
  const parsed = CreateJobInputSchema.parse(input);
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO jobs (
      id, status, kind, title, prompt, negative_prompt,
      seed, model, lora, source_image_url, workflow_json,
      created_at, updated_at
    ) VALUES (
      ?, 'pending', ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?
    )
  `
  ).run(
    id,
    parsed.kind,
    parsed.title ?? null,
    parsed.prompt ?? null,
    parsed.negative_prompt ?? null,
    parsed.seed ?? null,
    parsed.model ?? null,
    parsed.lora ?? null,
    parsed.source_image_url ?? null,
    parsed.workflow_json ?? null,
    now,
    now
  );

  return getJob(id)!;
}

export const UpdateJobInputSchema = z.object({
  status: z.enum(["pending", "running", "succeeded", "failed"]).optional(),
  output_image_url: z.string().url().nullable().optional(),
  output_video_url: z.string().url().nullable().optional(),
  error: z.string().max(8000).nullable().optional(),
});

export type UpdateJobInput = z.infer<typeof UpdateJobInputSchema>;

export function updateJob(id: string, patch: UpdateJobInput) {
  const parsed = UpdateJobInputSchema.parse(patch);
  const db = getDb();
  const now = new Date().toISOString();

  const current = getJob(id);
  if (!current) return null;

  const next = {
    status: parsed.status ?? current.status,
    output_image_url:
      parsed.output_image_url === undefined ? current.output_image_url : parsed.output_image_url,
    output_video_url:
      parsed.output_video_url === undefined ? current.output_video_url : parsed.output_video_url,
    error: parsed.error === undefined ? current.error : parsed.error,
  };

  db.prepare(
    `
    UPDATE jobs
    SET status = ?, output_image_url = ?, output_video_url = ?, error = ?, updated_at = ?
    WHERE id = ?
  `
  ).run(next.status, next.output_image_url, next.output_video_url, next.error, now, id);

  return getJob(id)!;
}
