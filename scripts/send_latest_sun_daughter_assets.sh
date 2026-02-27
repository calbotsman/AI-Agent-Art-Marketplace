#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/Users/calbotsman/clawd}"
TELEGRAM_TARGET="${TELEGRAM_TARGET:-6736310070}"
TELEGRAM_ACCOUNT="${TELEGRAM_ACCOUNT:-}"
DRY_RUN="${DRY_RUN:-0}"
THROTTLE_SEC="${THROTTLE_SEC:-2}"
LOGO_ROOT="${LOGO_ROOT:-${ROOT}/output/logo}"
LOGO_LORA_ROOT="${LOGO_LORA_ROOT:-${LOGO_ROOT}/lora}"
LOGO_STYLE_ROOT="${LOGO_STYLE_ROOT:-${LOGO_ROOT}/style}"

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

  if [[ "${DRY_RUN}" = "1" ]]; then
    printf 'DRY_RUN: %q ' "${cmd[@]}"
    printf '\n'
    return 0
  fi

  local attempt
  for attempt in 1 2 3; do
    if "${cmd[@]}"; then
      sleep "${THROTTLE_SEC}"
      return 0
    fi
    sleep 2
  done
  return 1
}

supplement_report_metrics() {
  local run_dir="$1"
  local report_path="${run_dir}/quality-report.json"
  local payload

  if [[ ! -f "${report_path}" ]]; then
    return 1
  fi

  if ! payload="$(node -e "const fs = require('fs'); const reportPath = process.argv[1]; try { const payload = JSON.parse(fs.readFileSync(reportPath, 'utf8')); const scoreCandidates = [payload.score, payload.scoring?.overall, payload.scoring?.summary?.weightAdjustedScore]; let score = 0; for (const candidate of scoreCandidates) { const parsed = Number(candidate); if (Number.isFinite(parsed)) { score = parsed; break; } } const pass = payload && payload.pass === true ? '1' : '0'; const recraft = (payload.checks?.recraftV4Used === true || payload.pipeline?.imageEngineUsed === 'recraft-v4' || payload.checks?.imageEngineUsed === 'recraft-v4') ? '1' : '0'; process.stdout.write([pass, score.toFixed(2), recraft].join('|')); } catch (error) { process.exit(1); }" "${report_path}" 2>/dev/null)"; then
    return 1
  fi

  printf '%s' "${payload}"
}

pick_logo_lora_assets() {
  local latest_round2=""
  local root=""
  local -a LOGO_LORA_PNGS=()

  for root in "${LOGO_LORA_ROOT}/sun-daughter"; do
    latest_round2="$(ls -td "${root}"/*/*/round-02 2>/dev/null | head -n 1 || true)"
    if [[ -n "${latest_round2}" && -d "${latest_round2}" ]]; then
      break
    fi
  done
  if [[ -z "${latest_round2}" || ! -d "${latest_round2}" ]]; then
    return 1
  fi

  LOGO_LORA_PNGS=()
  while IFS= read -r line; do
    LOGO_LORA_PNGS+=("$line")
  done < <(find "${latest_round2}" -maxdepth 1 -type f -name 'logo-*.png' | sort | head -n 3)
  if [[ "${#LOGO_LORA_PNGS[@]}" -lt 3 ]]; then
    return 1
  fi

  ASSET_SOURCE="logo/lora"
  ASSET_DIR="${latest_round2}"
  ASSET_FILES=("${LOGO_LORA_PNGS[@]}")
  return 0
}

pick_style_logo_assets() {
  local manifest_file=""
  local manifest_mtime=0
  local current_mtime=0
  local manifest=""
  local round_dir=""
  local preview_dir=""
  local style_pngs=()
  local fallback_pngs=()

  while IFS= read -r manifest; do
    if ! grep -q '"generator"[[:space:]]*:[[:space:]]*"logo-style-influenced-deterministic"' "${manifest}"; then
      continue
    fi
  current_mtime="$(stat -f "%m" "${manifest}")"
  if [[ "${current_mtime}" -gt "${manifest_mtime}" ]]; then
    manifest_file="${manifest}"
    manifest_mtime="${current_mtime}"
  fi
done < <(
    find "${LOGO_STYLE_ROOT}/sun-daughter" -type f -name manifest.json 2>/dev/null
  )

  if [[ -z "${manifest_file}" || ! -f "${manifest_file}" ]]; then
    return 1
  fi

  round_dir="$(dirname "${manifest_file}")"
  preview_dir="${round_dir}/previews"
  if [[ -d "${preview_dir}" ]]; then
    while IFS= read -r line; do
      style_pngs+=("$line")
    done < <(find "${preview_dir}" -maxdepth 1 -type f -name 'logo-*.png' | sort | head -n 3)
  fi
  if [[ "${#style_pngs[@]}" -lt 3 ]]; then
    while IFS= read -r line; do
      style_pngs+=("$line")
    done < <(find "${round_dir}" -maxdepth 1 -type f -name 'logo-*.png' | sort | head -n 3)
  fi

  if [[ "${#style_pngs[@]}" -lt 3 ]]; then
    while IFS= read -r line; do
      fallback_pngs+=("$line")
    done < <(find "${preview_dir}" -maxdepth 1 -type f -name '*.png' | sort | head -n 3)
  fi
  if [[ "${#fallback_pngs[@]}" -gt 0 ]]; then
    style_pngs=("${fallback_pngs[@]}")
  else
    while IFS= read -r line; do
      fallback_pngs+=("$line")
    done < <(find "${round_dir}" -maxdepth 1 -type f -name '*.png' | sort | head -n 3)
  fi
  if [[ "${#fallback_pngs[@]}" -gt 0 && "${#style_pngs[@]}" -lt 3 ]]; then
    style_pngs=("${fallback_pngs[@]}")
  fi

  if [[ "${#style_pngs[@]}" -lt 3 ]]; then
    return 1
  fi

  STYLE_MANIFEST="${manifest_file}"
  ASSET_SOURCE="logo/style"
  ASSET_DIR="${round_dir}"
  ASSET_FILES=("${style_pngs[@]}")
  return 0
}

pick_supplement_assets() {
  local latest_supplement
  local run_report
  local -a quality_reports=()
  local -a candidates=()
  local candidate_list
  local candidate
  local pass
  local score
  local recraft

  while IFS= read -r run_report; do
    quality_reports+=("$(stat -f '%m|%N' "${run_report}")")
  done < <(find "${ROOT}"/output/supplement-design -type f -name 'quality-report.json' 2>/dev/null)

  if [[ "${#quality_reports[@]}" -eq 0 ]]; then
    return 1
  fi

  while IFS='|' read -r report_mtime latest_supplement; do
    latest_supplement="$(dirname "${latest_supplement}")"
    local label="${latest_supplement}/label.png"
    local product="${latest_supplement}/product-mock.png"
    local board="${latest_supplement}/brand-board.png"
    local metrics_line
    if [[ ! -f "${label}" || ! -f "${product}" || ! -f "${board}" ]]; then
      continue
    fi

    if ! metrics_line="$(supplement_report_metrics "${latest_supplement}")"; then
      continue
    fi

    IFS='|' read -r pass score recraft <<< "${metrics_line}"
    if [[ -z "${pass}" || -z "${score}" || -z "${recraft}" ]]; then
      continue
    fi

    candidates+=("${pass}|${score}|${recraft}|${report_mtime}|${latest_supplement}")
  done < <(printf '%s\n' "${quality_reports[@]}" | sort -nr -t'|' -k1,1)

  if [[ "${#candidates[@]}" -eq 0 ]]; then
    return 1
  fi

  candidate_list="$(printf '%s\n' "${candidates[@]}" | sort -t'|' -k1,1nr -k2,2gr -k3,3nr -k4,4nr)"
  if [[ -z "${candidate_list}" ]]; then
    return 1
  fi

  while IFS= read -r candidate; do
    local candidate_dir
    IFS='|' read -r pass score recraft _ candidate_dir <<< "${candidate}"
    if [[ "${pass}" == "1" ]]; then
      ASSET_SOURCE="supplement-design"
      ASSET_DIR="${candidate_dir}"
      ASSET_FILES=("${candidate_dir}/label.png" "${candidate_dir}/product-mock.png" "${candidate_dir}/brand-board.png")
      ASSET_SCORE="${score}"
      ASSET_RECRAFT_V4="${recraft}"
      return 0
    fi
    log "supplement failed Cyborg QA gate: ${candidate_dir}; checking other channels"
  done <<< "${candidate_list}"

  return 1
}

ASSET_SOURCE=""
ASSET_DIR=""
ASSET_FILES=()
ASSET_SCORE=""
ASSET_RECRAFT_V4=""
STYLE_MANIFEST=""

if pick_supplement_assets; then
  log "selected validated supplement-design: ${ASSET_DIR} (score=${ASSET_SCORE}, recraft-v4=${ASSET_RECRAFT_V4})"
elif pick_style_logo_assets; then
  log "selected style-run manifest: ${STYLE_MANIFEST}"
elif pick_logo_lora_assets; then
  log "selected LoRA round-2 manifest from ${ASSET_DIR}"
else
  log "style and LoRA selectors missed; using supplement fallback"
fi

if [[ -z "${ASSET_DIR}" || "${#ASSET_FILES[@]}" -lt 3 ]]; then
  log "ERROR: Could not find 3 PNG assets in logo/style, logo/lora, or supplement outputs."
  exit 1
fi

if [[ "${ASSET_SOURCE}" == "supplement-design" && -n "${ASSET_SCORE}" ]]; then
  send_telegram "Sun Daughter assets ready (${ASSET_SOURCE}). score=${ASSET_SCORE}, recraft-v4=${ASSET_RECRAFT_V4}. Folder: ${ASSET_DIR}"
else
  send_telegram "Sun Daughter assets ready (${ASSET_SOURCE}). Folder: ${ASSET_DIR}"
fi

idx=1
send_failed=0
for png in "${ASSET_FILES[@]}"; do
  send_telegram "Sun Daughter asset ${idx}/3: $(basename "${png}")" "${png}" || send_failed=1
  idx=$((idx + 1))
done

if [[ "${send_failed}" = "1" ]]; then
  ZIP_PATH="${ASSET_DIR}/previews.zip"
  rm -f "${ZIP_PATH}"
  (
    cd "${ASSET_DIR}"
    zip -q "${ZIP_PATH}" "$(basename "${ASSET_FILES[0]}")" "$(basename "${ASSET_FILES[1]}")" "$(basename "${ASSET_FILES[2]}")"
  )
  send_telegram "Media fallback zip created: ${ZIP_PATH}" || true
  send_telegram "Sun Daughter previews.zip" "${ZIP_PATH}" || true
fi

log "Sent 3 assets from ${ASSET_DIR}"
for png in "${ASSET_FILES[@]}"; do
  printf '%s\n' "${png}"
done
