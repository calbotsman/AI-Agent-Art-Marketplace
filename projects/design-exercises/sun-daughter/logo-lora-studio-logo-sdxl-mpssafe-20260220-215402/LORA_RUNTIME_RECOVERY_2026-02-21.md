# LoRA Runtime Recovery - 2026-02-21

## Status
- LoRA checkpoint is working.
- Primary failure was orchestration/runtime config, not checkpoint corruption.
- Pipeline scripts have been patched for path resilience and deterministic execution.

## What was failing
1. Base model path mismatch
- Failing path in logs: `/Users/calbotsman/clawd/models/Stable-diffusion/sd_xl_base_1.0.safetensors`
- Error observed: `ValueError: ... is neither a valid local path nor a valid repo id`.
- Impact: generation step aborted before first image.

2. Post-train runner script corruption
- `scripts/run_sun_daughter_logo_process_after_lora.sh` had mixed temporary edits:
  - contradictory single-round vs round-2 sections
  - dead/commented generation blocks with active downstream references
  - a stray non-comment line that could fail shell execution
- Impact: intermittent or inconsistent post-train behavior.

3. Separate but related runtime instability
- OpenAI quota/billing errors in gateway logs caused agent-side response instability.
- This impacted chat continuity, but not direct local LoRA render correctness.

## Fixes applied
1. `scripts/generate_sdxl_lora_logo_set.py`
- Added base model resolver with fallback behavior:
  - accepts valid local path
  - checks known workspace paths for `sd_xl_base_1.0.safetensors`
  - if configured path is missing, falls back to `stabilityai/stable-diffusion-xl-base-1.0`
- Added manifest fields:
  - `baseModelConfigured`
  - `baseModelSource`

2. `scripts/run_sun_daughter_logo_process_after_lora.sh`
- Added base model normalization + fallback logging.
- Added `RUN_TWO_ROUNDS` control (`0` default for fast path, `1` for full two-round run).
- Added fast smoke controls:
  - `PROMPT_LIMIT`
  - `ROUND1_*` and `ROUND2_*` render params (steps/guidance/size/seed/lora-scale)
- Removed broken duplicate/contradictory execution tail.
- Kept telegram delivery deterministic from final generated round.
- Made design-exercise feedback steps non-fatal (`warn and continue`).

## Verification completed
1. Direct LoRA render success (core model test)
- Output: `/Users/calbotsman/clawd/output/logo-lora/_debug-20260221-133330/logo-p01-v01-s13346.png`
- Manifest: `/Users/calbotsman/clawd/output/logo-lora/_debug-20260221-133330/manifest.json`

2. Fallback-path render success (bad local path test)
- Command intentionally used missing local base path.
- Script logged warning and auto-fell back to HF model id.
- Output: `/Users/calbotsman/clawd/output/logo-lora/_debug-fallback-20260221-134201/logo-p01-v01-s3223.png`
- Manifest confirms fallback source:
  - `baseModelSource: "repo-fallback"`
  - `baseModelConfigured: "/Users/calbotsman/clawd/models/Stable-diffusion/sd_xl_base_1.0.safetensors"`

3. End-to-end runner smoke success (post-train script)
- Command (fast settings):
  `RUN_TWO_ROUNDS=0 PROMPT_LIMIT=1 ROUND1_STEPS=1 ROUND1_WIDTH=256 ROUND1_HEIGHT=256 ROUND1_GUIDANCE=4.0 ROUND1_LORA_SCALE=0.8 bash scripts/run_sun_daughter_logo_process_after_lora.sh studio_logo_sdxl_mpssafe_20260220_215402`
- Result:
  - generated round-01 manifest
  - captured exercise feedback
  - delivered Telegram status + PNG via `openclaw message send`
  - wrote summary at `/Users/calbotsman/clawd/output/logo-lora/sun-daughter/studio_logo_sdxl_mpssafe_20260220_215402/20260221-134651/process-summary.md`

4. End-to-end quick production pass success (2 prompts)
- Command:
  `RUN_TWO_ROUNDS=0 PROMPT_LIMIT=2 ROUND1_STEPS=2 ROUND1_WIDTH=512 ROUND1_HEIGHT=512 ROUND1_GUIDANCE=4.8 ROUND1_LORA_SCALE=0.85 bash scripts/run_sun_daughter_logo_process_after_lora.sh studio_logo_sdxl_mpssafe_20260220_215402`
- Result:
  - generated 2 PNG outputs + manifest
  - delivered Telegram status + 2 PNG files successfully
  - summary path: `/Users/calbotsman/clawd/output/logo-lora/sun-daughter/studio_logo_sdxl_mpssafe_20260220_215402/20260221-135135/process-summary.md`

## ASAP run commands
From `/Users/calbotsman/clawd`:

```bash
# 1) Fast recovery path (round 1 only)
RUN_TWO_ROUNDS=0 bash scripts/run_sun_daughter_logo_process_after_lora.sh studio_logo_sdxl_mpssafe_20260220_215402
```

```bash
# 2) Full two-round path (slower, final SHIP round)
RUN_TWO_ROUNDS=1 bash scripts/run_sun_daughter_logo_process_after_lora.sh studio_logo_sdxl_mpssafe_20260220_215402
```

```bash
# 3) Quick direct smoke test (no orchestration)
/Users/calbotsman/clawd/.venv-kohya/bin/python scripts/generate_sdxl_lora_logo_set.py \
  --base-model stabilityai/stable-diffusion-xl-base-1.0 \
  --lora /Users/calbotsman/clawd/models/lora/studio-logo/studio_logo_sdxl_mpssafe_20260220_215402.safetensors \
  --out-dir /Users/calbotsman/clawd/output/logo-lora/_manual-smoke \
  --prompt "Sun Daughter icon minimal" \
  --steps 6 --guidance 5.0 --width 512 --height 512 --num-images 1
```

## Recommendations
1. Keep `BASE_MODEL` as repo id unless you explicitly confirm a local file exists.
2. Keep `RUN_TWO_ROUNDS=0` while stabilizing, then switch to `1` once runtime is steady.
3. Add one preflight check before long runs:
- validate LoRA file exists
- validate python env imports (`torch`, `diffusers`, `peft`)
- validate base model resolution
4. Keep agent quota/billing issues tracked separately from LoRA generation health.

## External Research (primary sources)
- Hugging Face Diffusers SDXL + LoRA docs (official):
  - https://huggingface.co/docs/diffusers/api/pipelines/stable_diffusion/stable_diffusion_xl
  - https://huggingface.co/docs/diffusers/tutorials/using_peft_for_inference
- Hugging Face Diffusers MPS optimization guidance (official):
  - https://huggingface.co/docs/diffusers/optimization/mps
  - Notes include avoiding mixed-precision/autocast patterns that can cause instability/black outputs on MPS in some configurations.

## Next step
- Execute one real production run with `RUN_TWO_ROUNDS=0` now for immediate asset delivery, then follow with `RUN_TWO_ROUNDS=1` once the first output is verified.
