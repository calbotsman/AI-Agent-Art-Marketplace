#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/calbotsman/clawd"
TRAIN_OUT_DIR="${TRAIN_OUT_DIR:-$ROOT/models/lora/studio-logo}"
BASE_MODEL="${BASE_MODEL:-stabilityai/stable-diffusion-xl-base-1.0}"
RUN_NAME="${RUN_NAME:-${1:-}}"
PYTHON_BIN="${PYTHON_BIN:-$ROOT/.venv-kohya/bin/python}"
GEN_SCRIPT="$ROOT/scripts/generate_sdxl_lora_logo_set.py"
CHECK_SCRIPT="$ROOT/scripts/check_kohya_env.sh"
TELEGRAM_TARGET="${TELEGRAM_TARGET:-6736310070}"
TELEGRAM_ACCOUNT="${TELEGRAM_ACCOUNT:-}"
WAIT_INTERVAL_SEC="${WAIT_INTERVAL_SEC:-30}"
MAX_WAIT_MINUTES="${MAX_WAIT_MINUTES:-720}"

STEPS_ROUND1="${STEPS_ROUND1:-18}"
GUIDANCE_ROUND1="${GUIDANCE_ROUND1:-2.8}"
LORA_SCALE_ROUND1="${LORA_SCALE_ROUND1:-0.55}"
STEPS_ROUND2="${STEPS_ROUND2:-20}"
GUIDANCE_ROUND2="${GUIDANCE_ROUND2:-3.0}"
LORA_SCALE_ROUND2="${LORA_SCALE_ROUND2:-0.55}"
WIDTH="${WIDTH:-448}"
HEIGHT="${HEIGHT:-448}"
SKIP_ROUND2="${SKIP_ROUND2:-1}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

send_telegram() {
  local text="$1"
  local media="${2:-}"
  local cmd=(openclaw message send --channel telegram --target "${TELEGRAM_TARGET}" --message "${text}" --json)
  if [[ -n "${TELEGRAM_ACCOUNT}" ]]; then
    cmd+=(--account "${TELEGRAM_ACCOUNT}")
  fi
  if [[ -n "${media}" ]]; then
    cmd+=(--media "${media}")
  fi

  local out err
  out="$(mktemp)"
  err="$(mktemp)"
  local i
  for i in 1 2 3; do
    if "${cmd[@]}" >"${out}" 2>"${err}"; then
      log "telegram send ok attempt=${i} media=${media:-none}"
      cat "${out}"
      rm -f "${out}" "${err}"
      sleep 2
      return 0
    fi
    log "telegram send failed attempt=${i} media=${media:-none}"
    sed -n '1,120p' "${err}" || true
    sleep 3
  done
  rm -f "${out}" "${err}"
  return 1
}

latest_run_from_files() {
  local final
  final="$(find "${TRAIN_OUT_DIR}" -maxdepth 1 -type f -name '*.safetensors' ! -name '*-step*.safetensors' -print | sort | tail -n 1 || true)"
  if [[ -n "${final}" ]]; then
    basename "${final}" .safetensors
    return 0
  fi
  return 1
}

resolve_run_name() {
  if [[ -n "${RUN_NAME}" ]]; then
    echo "${RUN_NAME}"
    return
  fi
  local active
  active="$(pgrep -af 'sdxl_train_network.py' | sed -n 's/.*--output_name=\([^ ]*\).*/\1/p' | head -n 1 || true)"
  if [[ -n "${active}" ]]; then
    echo "${active}"
    return
  fi
  latest_run_from_files || true
}

wait_for_training_exit() {
  local run="$1"
  local waited=0
  local max_wait="$(( MAX_WAIT_MINUTES * 60 ))"
  while pgrep -f "sdxl_train_network.py.*--output_name=${run}" >/dev/null; do
    if (( waited >= max_wait )); then
      log "ERROR: timeout waiting for training exit for run=${run}"
      return 1
    fi
    log "waiting for training run=${run} (waited=${waited}s)"
    sleep "${WAIT_INTERVAL_SEC}"
    waited=$(( waited + WAIT_INTERVAL_SEC ))
  done
  return 0
}

resolve_final_lora() {
  local run="$1"
  local final="${TRAIN_OUT_DIR}/${run}.safetensors"
  if [[ -f "${final}" ]]; then
    echo "${final}"
    return 0
  fi
  local latest_step
  latest_step="$(ls -1t "${TRAIN_OUT_DIR}/${run}"-step*.safetensors 2>/dev/null | head -n 1 || true)"
  if [[ -n "${latest_step}" && -f "${latest_step}" ]]; then
    echo "${latest_step}"
    return 0
  fi
  return 1
}

validate_round_outputs() {
  local round_dir="$1"
  "${PYTHON_BIN}" - <<'PY' "${round_dir}"
import json
import sys
from pathlib import Path

round_dir = Path(sys.argv[1])
manifest = round_dir / "manifest.json"
if not manifest.exists():
    print("manifest_missing")
    raise SystemExit(2)

obj = json.loads(manifest.read_text())
imgs = obj.get("images", [])
if len(imgs) < 3:
    print(f"insufficient_images:{len(imgs)}")
    raise SystemExit(3)

all_dark = True
for item in imgs:
    dark = float(item.get("darkPct", 0.0))
    if dark < 99.5:
        all_dark = False
        break

if all_dark:
    print("all_images_near_black")
    raise SystemExit(4)

print("round_ok")
PY
}

if [[ ! -x "${PYTHON_BIN}" ]]; then
  log "ERROR: python not executable: ${PYTHON_BIN}"
  exit 1
fi
if [[ ! -f "${GEN_SCRIPT}" ]]; then
  log "ERROR: generator script missing: ${GEN_SCRIPT}"
  exit 1
fi
if [[ -x "${CHECK_SCRIPT}" ]]; then
  "${CHECK_SCRIPT}" || {
    log "ERROR: kohya env preflight failed"
    exit 1
  }
fi

RUN_NAME="$(resolve_run_name)"
if [[ -z "${RUN_NAME}" ]]; then
  log "ERROR: could not resolve run name"
  exit 1
fi
log "run name: ${RUN_NAME}"

wait_for_training_exit "${RUN_NAME}" || exit 1

FINAL_LORA="$(resolve_final_lora "${RUN_NAME}")" || {
  log "ERROR: no LoRA checkpoint found for run=${RUN_NAME}"
  exit 1
}
log "using lora: ${FINAL_LORA}"

RUN_STAMP="$(date +%Y%m%d-%H%M%S)"
LOGO_ROOT="${LOGO_ROOT:-${ROOT}/output/logo}"
LORA_ROOT="${LORA_ROOT:-${LOGO_ROOT}/lora}"
OUTPUT_ROOT="${LORA_ROOT}/sun-daughter/${RUN_NAME}/${RUN_STAMP}"
ROUND1_OUT="${OUTPUT_ROOT}/round-01"
ROUND2_OUT="${OUTPUT_ROOT}/round-02"
mkdir -p "${ROUND1_OUT}" "${ROUND2_OUT}"

PROMPTS1="${OUTPUT_ROOT}/prompts.round-01.txt"
PROMPTS2="${OUTPUT_ROOT}/prompts.round-02.txt"

cat > "${PROMPTS1}" <<'P1'
Sun Daughter logo icon, minimal geometric sun symbol, flat vector style, centered, high contrast, no gradients
Sun Daughter monoline emblem, sun and leaf fusion mark, clean negative space, scalable brand icon, plain background
Sun Daughter wordmark lockup with simple sun glyph, modern premium wellness logo, solid fills only, no texture
P1

cat > "${PROMPTS2}" <<'P2'
Sun Daughter primary mark, icon-first circular sun crest, crisp vector-like edges, black on warm ivory background
Sun Daughter signature logo, minimal monogram + sun axis, balanced spacing, clean professional identity system
Sun Daughter final logo option, bold sans lockup with geometric sun punctuation, flat single-color, plain backdrop
P2

log "generating round 1"
"${PYTHON_BIN}" "${GEN_SCRIPT}" \
  --base-model "${BASE_MODEL}" \
  --lora "${FINAL_LORA}" \
  --out-dir "${ROUND1_OUT}" \
  --prompt-file "${PROMPTS1}" \
  --steps "${STEPS_ROUND1}" \
  --guidance "${GUIDANCE_ROUND1}" \
  --width "${WIDTH}" \
  --height "${HEIGHT}" \
  --seed-base 20261221 \
  --num-images 1 \
  --lora-scale "${LORA_SCALE_ROUND1}"

validate_round_outputs "${ROUND1_OUT}" || {
  log "ERROR: round 1 outputs invalid"
  exit 1
}

if [[ "${SKIP_ROUND2}" = "1" ]]; then
  log "SKIP_ROUND2=1, using round 1 assets"
  ASSET_DIR="${ROUND1_OUT}"
else
  log "generating round 2"
  "${PYTHON_BIN}" "${GEN_SCRIPT}" \
    --base-model "${BASE_MODEL}" \
    --lora "${FINAL_LORA}" \
    --out-dir "${ROUND2_OUT}" \
    --prompt-file "${PROMPTS2}" \
    --steps "${STEPS_ROUND2}" \
    --guidance "${GUIDANCE_ROUND2}" \
    --width "${WIDTH}" \
    --height "${HEIGHT}" \
    --seed-base 20262221 \
    --num-images 1 \
    --lora-scale "${LORA_SCALE_ROUND2}"

  if ! validate_round_outputs "${ROUND2_OUT}"; then
    log "round 2 validation failed; falling back to round 1 assets"
    ASSET_DIR="${ROUND1_OUT}"
  else
    ASSET_DIR="${ROUND2_OUT}"
  fi
fi

TOP3=()
while IFS= read -r line; do
  TOP3+=("$line")
done < <(find "${ASSET_DIR}" -maxdepth 1 -type f -name 'logo-*.png' | sort | head -n 3)

if [[ "${#TOP3[@]}" -lt 3 ]]; then
  log "ERROR: not enough png outputs in ${ASSET_DIR}"
  exit 1
fi

SUMMARY="${OUTPUT_ROOT}/process-summary.md"
cat > "${SUMMARY}" <<EOF2
# Sun Daughter Logo Process Summary

- run name: ${RUN_NAME}
- lora: ${FINAL_LORA}
- output root: ${OUTPUT_ROOT}
- selected asset dir: ${ASSET_DIR}
- png 1: ${TOP3[0]}
- png 2: ${TOP3[1]}
- png 3: ${TOP3[2]}
EOF2

send_failed=0
send_telegram "Sun Daughter logo generator complete. Folder: ${ASSET_DIR}" || send_failed=1
idx=1
for png in "${TOP3[@]}"; do
  send_telegram "Sun Daughter logo ${idx}/3" "${png}" || send_failed=1
  idx=$((idx + 1))
done

if (( send_failed != 0 )); then
  ZIP_PATH="${OUTPUT_ROOT}/previews.zip"
  rm -f "${ZIP_PATH}"
  (cd "${ASSET_DIR}" && zip -q "${ZIP_PATH}" "$(basename "${TOP3[0]}")" "$(basename "${TOP3[1]}")" "$(basename "${TOP3[2]}")")
  send_telegram "Telegram media fallback: previews zip created at ${ZIP_PATH}" || true
  send_telegram "Sun Daughter previews.zip" "${ZIP_PATH}" || true
fi

log "done"
log "summary=${SUMMARY}"
printf '%s\n' "${SUMMARY}" "${TOP3[@]}"
