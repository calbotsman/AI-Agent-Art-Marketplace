# Dream Machine: Research + Plan

This doc is the technical plan for the Dream Machine pipeline:

`LoRA training` -> `still generation` -> `image-to-video` -> `publish to web gallery`.

## Goals
- Generate new motion studies (videos) from Dream Machine style stills with minimal manual steps.
- Make outputs publicly viewable on a simple website (gallery + piece pages).
- Make the pipeline reliable and observable (job states, logs, reproducible runs).

## Non-Goals (for MVP)
- End-user prompt submission / accounts.
- Real-time video generation in the browser.
- Multi-tenant GPU scheduling.

## Current State
- Next.js gallery + SQLite schema + API routes exist.
- Worker is stubbed (`npm run worker:once`).

## Research Notes

### ComfyUI API Surface (what the worker will call)
ComfyUI exposes an HTTP+WS interface for submitting prompt graphs and checking results.

Common endpoints (exact prefix varies by ComfyUI version; new versions may prefix routes with `/api`):
- `POST /prompt` to enqueue a workflow/prompt graph.
- `GET /history` and `GET /history/{prompt_id}` to read outputs.
- `GET /queue` to inspect queue depth.
- `GET /ws` for websocket events/progress.

Practical implementation note: treat route prefix as configurable (e.g. `COMFYUI_API_PREFIX`), and auto-detect once by probing `/history` vs `/api/history`.

### Image-to-Video Model Options (inside ComfyUI)
- Stable Video Diffusion (SVD): widely used for i2v; ComfyUI custom nodes exist.
- AnimateDiff: also common, but generally more moving parts (motion modules, etc).

For MVP, SVD is the default recommendation because it is straightforward and predictable.

### Training The Dream Machine LoRA
Two viable approaches:
- Train outside ComfyUI (kohya-ss scripts). More standard, easier to reproduce.
- Train in/with ComfyUI via a training custom node wrapper.

For MVP, prefer training outside ComfyUI unless you specifically want the full pipeline inside a single UI.

## Proposed Architecture (MVP)

### Components
- **Web/API (Next.js)**: stores jobs + pieces in SQLite and serves the gallery.
- **GPU Worker**: polls pending jobs, runs ComfyUI workflows, uploads outputs, updates job + piece records.
- **ComfyUI Server**: runs on the GPU box and executes workflows (still + i2v).
- **Object Storage**: stores `still.png` and `video.mp4` with public URLs (R2/S3/Vercel Blob).

### Job States
- `pending` -> `running` -> `succeeded|failed`

Store on the job:
- `type`: `still` or `i2v`
- `input`: prompt, seed, model, lora, input image URL (for i2v)
- `comfy_prompt_id` (once enqueued)
- `output_urls`: still/video URLs
- `error`: string (failed)

### Worker Flow
1. `GET /api/jobs?status=pending`
2. `PATCH /api/jobs/:id` -> `running`
3. Build ComfyUI prompt graph JSON for the job type
4. `POST /prompt` to ComfyUI
5. Poll history until outputs exist (`GET /history/{prompt_id}`)
6. Collect outputs (read from disk on the GPU host, or download via ComfyUI “view” endpoint if available)
7. Upload to storage
8. `PATCH job` with `output_urls` + `succeeded`
9. `POST /api/pieces` (or create piece directly in the same mutation) with metadata

## Planning: Milestones

### Milestone 1: ComfyUI Workflow Lock-In
- Choose base still workflow (SDXL + Dream Machine LoRA).
- Choose i2v workflow (SVD).
- Export both workflows to versioned JSON files in the repo (e.g. `comfy/workflows/*.json`).

### Milestone 2: Worker MVP (Single Job)
- Implement `scripts/worker/run-once.ts` to run one pending job end-to-end.
- Add a `dryRun` mode that prints the graph + intended API calls without executing.
- Add a `--job-id` flag for targeted reruns.

### Milestone 3: Continuous Worker + Retry
- Long-running worker loop with backoff.
- Retry policy:
  - retry transient network errors
  - do not auto-retry deterministic model errors unless explicitly flagged

### Milestone 4: Hosting + Publish
- Decide where Next.js runs (Vercel recommended).
- Decide storage (R2/S3/Vercel Blob).
- Confirm the GPU worker can reach the API securely (admin token).

## Open Questions (need your answers)
- Video aesthetic: SVD “subtle motion studies” vs more aggressive motion (AnimateDiff).
- Where is the GPU box (local vs cloud) and how do we want to deploy the worker there.
- Storage preference: R2/S3 vs Vercel Blob.
- Is the pipeline fully autonomous (scheduled generation) or admin-triggered jobs only.
