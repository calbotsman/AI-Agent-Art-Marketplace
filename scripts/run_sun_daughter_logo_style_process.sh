#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/calbotsman/clawd"
STYLE_COLLECTION_ROOT="${STYLE_COLLECTION_ROOT:-${ROOT}/data/logo-influences}"
STYLE_COLLECTION_NAME="${STYLE_COLLECTION_NAME:-sun-daughter}"
STYLE_COLLECTION_DIR="${STYLE_COLLECTION_ROOT}/${STYLE_COLLECTION_NAME}"
STYLE_DIR="${STYLE_DIR:-${STYLE_COLLECTION_DIR}}"
STYLE_DIR_LEGACY_FALLBACK="${STYLE_DIR_LEGACY_FALLBACK:-${ROOT}/models/lora/studio-logo-lora-training-data}"
PROFILE_FILE="${STYLE_PROFILE:-/Users/calbotsman/clawd/data/logo-style-profile/latest.json}"
BRAND_NAME="${BRAND_NAME:-Sun Daughter}"
PROMPT_COUNT="${PROMPT_COUNT:-3}"
RUN_STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_NAME="${RUN_NAME:-style-${RUN_STAMP}}"
LOGO_ROOT="${LOGO_ROOT:-${ROOT}/output/logo}"
STYLE_ROOT="${STYLE_ROOT:-${LOGO_ROOT}/style}"
OUTPUT_ROOT="${STYLE_ROOT}/sun-daughter/${RUN_NAME}/${RUN_STAMP}"
ROUND1_OUT="${OUTPUT_ROOT}/round-01"
RECRAFT_MODEL="${RECRAFT_MODEL:-recraft/recraft-v4}"
RECRAFT_STYLE="${RECRAFT_STYLE:-vivid}"
RECRAFT_SIZE="${RECRAFT_SIZE:-1024x1024}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

if [[ ! -d "${STYLE_DIR}" ]]; then
  if [[ "${STYLE_DIR}" == "${STYLE_COLLECTION_DIR}" && -d "${STYLE_DIR_LEGACY_FALLBACK}" ]]; then
    log "using legacy style source fallback: ${STYLE_DIR_LEGACY_FALLBACK}"
    STYLE_DIR="${STYLE_DIR_LEGACY_FALLBACK}"
  else
  log "ERROR: style directory not found: ${STYLE_DIR}"
  exit 1
  fi
fi

has_supported_style_images() {
  local source_dir="$1"
  local count
  count="$(find "${source_dir}" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.svg' \) | wc -l | tr -d ' ')"
  [[ -n "${count}" ]] && (( count > 0 ))
}

if ! has_supported_style_images "${STYLE_DIR}"; then
  if [[ "${STYLE_DIR}" == "${STYLE_COLLECTION_DIR}" && -d "${STYLE_DIR_LEGACY_FALLBACK}" ]] && has_supported_style_images "${STYLE_DIR_LEGACY_FALLBACK}"; then
    log "new collection dir is empty; using legacy style source fallback: ${STYLE_DIR_LEGACY_FALLBACK}"
    STYLE_DIR="${STYLE_DIR_LEGACY_FALLBACK}"
  else
    log "ERROR: style directory contains no supported image files: ${STYLE_DIR}"
    exit 1
  fi
fi

mkdir -p "${OUTPUT_ROOT}" "${ROUND1_OUT}"

log "building style profile from ${STYLE_DIR}"
node "${ROOT}/scripts/build_logo_style_profile.mjs" \
  --input "${STYLE_DIR}" \
  --output "${PROFILE_FILE}"

log "generating deterministic candidates (no LoRA) -> ${ROUND1_OUT}"
node "${ROOT}/scripts/run_logo_style_generator.mjs" \
  --brand "${BRAND_NAME}" \
  --style-profile "${PROFILE_FILE}" \
  --out-dir "${ROUND1_OUT}" \
  --prompts "${PROMPT_COUNT}" \
  --recraft-model "${RECRAFT_MODEL}" \
  --recraft-style "${RECRAFT_STYLE}" \
  --recraft-size "${RECRAFT_SIZE}"

if [[ ! -f "${ROUND1_OUT}/manifest.json" ]]; then
  log "ERROR: manifest missing: ${ROUND1_OUT}/manifest.json"
  exit 1
fi

PNG_COUNT="$(find "${ROUND1_OUT}/previews" -maxdepth 1 -type f -name '*.png' | wc -l | tr -d ' ')"
if [[ "${PNG_COUNT}" -lt "${PROMPT_COUNT}" ]]; then
  log "ERROR: expected at least ${PROMPT_COUNT} PNG outputs, got ${PNG_COUNT}"
  exit 1
fi

log "completed style pipeline"
log "run: ${RUN_NAME}"
log "output: ${ROUND1_OUT}"
log "manifest: ${ROUND1_OUT}/manifest.json"
log "png count: ${PNG_COUNT}"

if [[ "${TELEGRAM_NOTIFY:-1}" == "1" ]]; then
  if "${ROOT}/scripts/send_latest_sun_daughter_assets.sh"; then
    log "telegram update sent (send_latest_sun_daughter_assets.sh)"
  else
    log "WARNING: telegram update failed"
  fi
fi
