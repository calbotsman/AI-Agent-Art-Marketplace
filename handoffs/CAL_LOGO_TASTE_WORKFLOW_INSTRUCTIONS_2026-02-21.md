# Cal Instructions - Logo Taste Model (No Duplicate Work)

Date: 2026-02-21
Workspace: /Users/calbotsman/clawd

## Goal
Train and use a logo LoRA that matches Josh's taste from an Are.na board, with one canonical workflow and no duplicated runs.

## Single Source of Truth
- Are.na source board: user-provided URL
- Raw LoRA dataset dir: /Users/calbotsman/clawd/models/lora/studio-logo-lora-training-data
- Deterministic style influence dir: /Users/calbotsman/clawd/data/logo-influences/sun-daughter
- Prepared dataset dir: /Users/calbotsman/clawd/models/lora/studio-logo-lora-ready
- LoRA outputs: /Users/calbotsman/clawd/models/lora/studio-logo
- Logo outputs:
  - Style flow: /Users/calbotsman/clawd/output/logo/style/sun-daughter
  - LoRA flow: /Users/calbotsman/clawd/output/logo/lora/sun-daughter

## De-dup Rules (mandatory)
1. Never start train/generate if another matching process is already running (`train_logo_lora_kohya.sh`, `sdxl_train_network.py`, `run_sun_daughter_logo_process_after_lora.sh`).
2. Always sync Are.na first, then decide:
- If `Downloaded: 0` and no significant new data, skip retraining and only regenerate logos.
- Retrain only when at least 10 new logos were added or style direction changed materially.
3. Keep one active run name per board refresh:
- `OUTPUT_NAME=studio_logo_sdxl_<YYYYMMDD>_<HHMMSS>`
4. Use one generation path only for final logo candidates (SDXL+LoRA script + validation), with Telegram zip fallback.

## Step-by-step commands

### 1) Sync Are.na board
Run from `/Users/calbotsman/clawd`:

```bash
node scripts/sync_arena_to_lora.mjs \
  --board "<ARENA_BOARD_URL>" \
  --output /Users/calbotsman/clawd/models/lora/studio-logo-lora-training-data \
  --max 300
```

Expected output includes `Downloaded: N` and `Manifest: ...arena-sync-manifest-*.json`.

### 2) Prepare training dataset (filters low-res, writes captions)

```bash
node scripts/prepare_logo_lora_dataset.mjs \
  --input /Users/calbotsman/clawd/models/lora/studio-logo-lora-training-data \
  --output /Users/calbotsman/clawd/models/lora/studio-logo-lora-ready \
  --token studiologo \
  --repeats 10 \
  --max-size 1024 \
  --min-side 640
```

### 3) Train LoRA

```bash
cd /Users/calbotsman/clawd
BASE_MODEL=stabilityai/stable-diffusion-xl-base-1.0 \
OUTPUT_NAME=studio_logo_sdxl_$(date +%Y%m%d_%H%M%S) \
MAX_STEPS=1200 \
SAVE_EVERY=200 \
bash scripts/train_logo_lora_kohya.sh
```

Quick test profile:

```bash
cd /Users/calbotsman/clawd
BASE_MODEL=stabilityai/stable-diffusion-xl-base-1.0 \
OUTPUT_NAME=studio_logo_sdxl_test_$(date +%Y%m%d_%H%M%S) \
MAX_STEPS=200 \
SAVE_EVERY=50 \
NETWORK_DIM=16 \
NETWORK_ALPHA=8 \
bash scripts/train_logo_lora_kohya.sh
```

### 4) Generate 3 logo candidates + deliver
Use the final `OUTPUT_NAME` from training:

```bash
cd /Users/calbotsman/clawd
bash scripts/run_sun_daughter_logo_process_after_lora.sh <OUTPUT_NAME>
```

If Telegram media delivery is flaky, run:

```bash
cd /Users/calbotsman/clawd
bash scripts/send_latest_sun_daughter_assets.sh
```

## Quality gate before sending
- Confirm at least 3 PNG files exist in selected round output.
- Confirm `manifest.json` exists and images are not all near-black.
- If media fails, send `previews.zip` fallback automatically.

## What Cal should send to Josh each run
- One short status line with run name.
- Exact output folder path.
- 3 PNG file paths.
- Note whether sent as direct media or zip fallback.
