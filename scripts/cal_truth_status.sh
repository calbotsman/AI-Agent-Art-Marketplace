#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/Users/calbotsman/clawd}"
RUN_NAME="${1:-studio_logo_sdxl_mpssafe_20260220_215402}"
TRAIN_ROOT="${TRAIN_ROOT:-${ROOT}/models/lora/studio-logo}"
OUTPUT_ROOT="${OUTPUT_ROOT:-${ROOT}/output}"

printf 'Cal truth check @ %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
echo "Run target: ${RUN_NAME}"
echo "-----"

printf 'Live LoRA trainer processes:\n'
if ! pgrep -af "sdxl_train_network.py.*--output_name=${RUN_NAME}" | rg -v "rg"; then
  echo "- none"
fi
echo

printf 'Live post-train generator/sender processes:\n'
if ! pgrep -af "run_sun_daughter_logo_process_after_lora\\.sh|send_latest_sun_daughter_assets\\.sh" | rg -v "rg"; then
  echo "- none"
fi
echo

latest_lora_checkpoint="$(find "${TRAIN_ROOT}" -maxdepth 1 -type f -name "*.safetensors" ! -name '*-step*.safetensors' 2>/dev/null | sort | tail -n 1 || true)"
latest_step_checkpoint="$(find "${TRAIN_ROOT}" -maxdepth 1 -type f -name "${RUN_NAME}-step*.safetensors" 2>/dev/null | sort | tail -n 1 || true)"

printf 'Checkpoint evidence:\n'
if [[ -n "${latest_lora_checkpoint}" ]]; then
  echo "- latest_final: ${latest_lora_checkpoint}"
else
  echo "- latest_final: missing"
fi
if [[ -n "${latest_step_checkpoint}" ]]; then
  echo "- latest_step_for_target: ${latest_step_checkpoint}"
else
  echo "- latest_step_for_target: missing"
fi
echo

latest_lora_output="$(ls -td "${OUTPUT_ROOT}/logo/lora/sun-daughter/"*/*/round-*/ 2>/dev/null | head -n 1 || true)"
printf 'Latest LoRA output folder:\n'
if [[ -n "${latest_lora_output}" ]]; then
  echo "- ${latest_lora_output}"
else
  echo "- none"
fi
echo

latest_style_output="$(ls -td "${OUTPUT_ROOT}/logo/style/sun-daughter/"*/*/ 2>/dev/null | head -n 1 || true)"
printf 'Latest style output folder:\n'
if [[ -n "${latest_style_output}" ]]; then
  echo "- ${latest_style_output}"
else
  echo "- none"
fi
echo

latest_supplement="$(ls -td "${OUTPUT_ROOT}/supplement-design/"*/* 2>/dev/null | head -n 1 || true)"
printf 'Latest supplement folder:\n'
if [[ -n "${latest_supplement}" ]]; then
  echo "- ${latest_supplement}"
else
  echo "- none"
fi
