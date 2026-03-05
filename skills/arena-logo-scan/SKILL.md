---
name: arena_logo_scan
description: Run Arenna logo scrape + duplicate-safe dedupe + vision tagging for new logos.
user-invocable: true
---

Use this when asked to refresh logo references from an Are.na board.

Primary behavior:

- Run the orchestrator script at:
  `node scripts/run_arena_logo_pipeline.mjs <board_or_url> --max <n> --output <dir>`
- Keep downloads duplicate-safe via hashed filenames from the sync step.
- Tag only newly downloaded images so existing tags are preserved and not re-run.
- Prefer non-LoRA workflows: this is vision/tagging for logo reference curation.

## Inputs accepted

- Plain board argument: `/arena_logo_scan https://www.are.na/user/board`
- `--board <value>` URL or `user/board`
- `--max <n>` number to cap downloaded images
- `--output <dir>` destination directory (default is `data/logo-influences/sun-daughter`)
- `--no-tag` to skip vision tagging this run
- `--tag-only-missing` to ensure only missing files are tagged

If no board is provided, the script falls back to `ARENA_BOARD_URL` / `ARENA_BOARD`.

After running, report the manifest and catalog/review paths from script output.
