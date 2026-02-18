# Dream Machine

Dream Machine is a small web gallery and API for publishing AI-generated motion studies:

- Still image generation (base model + LoRA)
- Image-to-video generation (ComfyUI workflow)
- Publish output URLs as gallery pieces

This repo is intentionally minimal so the generation pipeline can evolve without UI churn.

## Local Dev

```bash
cd /Users/calbotsman/clawd/projects/products/dream-machine
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

SQLite DB is created at `./data/dream-machine.db` by default.

## Admin Token

Mutating endpoints require `DREAM_MACHINE_ADMIN_TOKEN` via:

- `Authorization: Bearer <token>` or
- `X-Admin-Token: <token>`

If the token is unset, mutations are denied (safer default).

## API

### List Pieces

`GET /api/pieces`

### Create Piece (Admin)

```bash
curl -sS -X POST http://localhost:3000/api/pieces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DREAM_MACHINE_ADMIN_TOKEN" \
  -d '{
    "title":"Study 001",
    "description":"LoRA still -> SVD motion",
    "image_url":"https://example.com/still.png",
    "video_url":"https://example.com/still.mp4",
    "model":"sdxl",
    "lora":"dream_machine_v1",
    "seed":12345,
    "tags":["dream-machine","svd"]
  }'
```

### Create Job (Admin)

`POST /api/jobs`

This stores a pending job record. The next step is a separate worker (runs on the GPU box) that:

1. Polls `GET /api/jobs?status=pending`
2. Marks a job running via `PATCH /api/jobs/:id`
3. Executes the ComfyUI workflow
4. Uploads outputs somewhere public (R2/S3/Vercel Blob/IPFS)
5. Patches the job with output URLs and creates a piece

## Scripts

- `npm run db:init` initializes the SQLite schema.
- `npm run worker:once` is a stub entrypoint for the future ComfyUI worker.

