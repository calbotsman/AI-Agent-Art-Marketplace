#!/usr/bin/env bash
set -euo pipefail

# SDXL LoRA training launcher for prepared logo dataset.
# Prereqs:
# - kohya_ss cloned locally
# - Python env with accelerate/bitsandbytes/torch configured for your hardware
# - Base SDXL model file (.safetensors or .ckpt)

KOHYA_DIR="${KOHYA_DIR:-$HOME/kohya_ss}"
SD_SCRIPTS_DIR="${SD_SCRIPTS_DIR:-${KOHYA_DIR}/sd-scripts}"
BASE_MODEL="${BASE_MODEL:-}"
DATASET_DIR="${DATASET_DIR:-/Users/calbotsman/clawd/models/lora/studio-logo-lora-ready}"
OUTPUT_DIR="${OUTPUT_DIR:-/Users/calbotsman/clawd/models/lora/studio-logo}"
OUTPUT_NAME="${OUTPUT_NAME:-studio_logo_sdxl_v1}"
MAX_STEPS="${MAX_STEPS:-1800}"
SAVE_EVERY="${SAVE_EVERY:-300}"
NETWORK_DIM="${NETWORK_DIM:-32}"
NETWORK_ALPHA="${NETWORK_ALPHA:-16}"
TRAIN_BATCH_SIZE="${TRAIN_BATCH_SIZE:-1}"
RESOLUTION="${RESOLUTION:-1024,1024}"
MIXED_PRECISION="${MIXED_PRECISION:-no}"
MAX_BUCKET_RESO="${MAX_BUCKET_RESO:-1536}"
MIN_BUCKET_RESO="${MIN_BUCKET_RESO:-512}"
LR="${LR:-1e-4}"
UNET_LR="${UNET_LR:-1e-4}"
TEXT_ENCODER_LR="${TEXT_ENCODER_LR:-5e-5}"
OPTIMIZER_TYPE="${OPTIMIZER_TYPE:-AdamW}"
CACHE_LATENTS="${CACHE_LATENTS:-1}"
GRADIENT_CHECKPOINTING="${GRADIENT_CHECKPOINTING:-1}"
TRAIN_TEXT_ENCODER="${TRAIN_TEXT_ENCODER:-1}"

if [[ -z "${BASE_MODEL}" ]]; then
  echo "ERROR: BASE_MODEL is required."
  echo "Example:"
  echo "  BASE_MODEL=/path/to/sd_xl_base_1.0.safetensors bash scripts/train_logo_lora_kohya.sh"
  echo "  BASE_MODEL=stabilityai/stable-diffusion-xl-base-1.0 bash scripts/train_logo_lora_kohya.sh"
  exit 1
fi

if [[ ! -f "${BASE_MODEL}" ]]; then
  if [[ "${BASE_MODEL}" == *"/"* ]]; then
    echo "BASE_MODEL looks like a model repo id; proceeding: ${BASE_MODEL}"
  else
    echo "ERROR: BASE_MODEL file not found and not a model repo id: ${BASE_MODEL}"
    exit 1
  fi
fi

if [[ ! -d "${KOHYA_DIR}" ]]; then
  echo "ERROR: KOHYA_DIR not found: ${KOHYA_DIR}"
  echo "Clone it first: git clone https://github.com/bmaltais/kohya_ss \"${KOHYA_DIR}\""
  exit 1
fi

if [[ ! -d "${DATASET_DIR}" ]]; then
  echo "ERROR: DATASET_DIR not found: ${DATASET_DIR}"
  exit 1
fi

if ! command -v accelerate >/dev/null 2>&1; then
  echo "ERROR: accelerate not found in PATH."
  echo "Install in your training env and re-run."
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

echo "KOHYA_DIR=${KOHYA_DIR}"
echo "SD_SCRIPTS_DIR=${SD_SCRIPTS_DIR}"
echo "BASE_MODEL=${BASE_MODEL}"
echo "DATASET_DIR=${DATASET_DIR}"
echo "OUTPUT_DIR=${OUTPUT_DIR}"
echo "OUTPUT_NAME=${OUTPUT_NAME}"
echo "MAX_STEPS=${MAX_STEPS}"
echo "CACHE_LATENTS=${CACHE_LATENTS}"
echo "GRADIENT_CHECKPOINTING=${GRADIENT_CHECKPOINTING}"
echo "TRAIN_TEXT_ENCODER=${TRAIN_TEXT_ENCODER}"

if [[ ! -d "${SD_SCRIPTS_DIR}" ]]; then
  echo "ERROR: SD_SCRIPTS_DIR not found: ${SD_SCRIPTS_DIR}"
  exit 1
fi

cd "${SD_SCRIPTS_DIR}"

if [[ ! -f "./sdxl_train_network.py" ]]; then
  echo "ERROR: sdxl_train_network.py not found under ${SD_SCRIPTS_DIR}"
  exit 1
fi

EXTRA_ARGS=()
if [[ "${CACHE_LATENTS}" == "1" ]]; then
  EXTRA_ARGS+=(--cache_latents)
fi
if [[ "${GRADIENT_CHECKPOINTING}" == "1" ]]; then
  EXTRA_ARGS+=(--gradient_checkpointing)
fi
if [[ "${TRAIN_TEXT_ENCODER}" != "1" ]]; then
  EXTRA_ARGS+=(--network_train_unet_only)
fi

accelerate launch --num_cpu_threads_per_process 2 ./sdxl_train_network.py \
  --pretrained_model_name_or_path="${BASE_MODEL}" \
  --train_data_dir="${DATASET_DIR}" \
  --output_dir="${OUTPUT_DIR}" \
  --output_name="${OUTPUT_NAME}" \
  --resolution="${RESOLUTION}" \
  --enable_bucket \
  --min_bucket_reso="${MIN_BUCKET_RESO}" \
  --max_bucket_reso="${MAX_BUCKET_RESO}" \
  --network_module=networks.lora \
  --network_dim="${NETWORK_DIM}" \
  --network_alpha="${NETWORK_ALPHA}" \
  --train_batch_size="${TRAIN_BATCH_SIZE}" \
  --max_train_steps="${MAX_STEPS}" \
  --learning_rate="${LR}" \
  --unet_lr="${UNET_LR}" \
  --text_encoder_lr="${TEXT_ENCODER_LR}" \
  --lr_scheduler=cosine_with_restarts \
  --lr_scheduler_num_cycles=2 \
  --optimizer_type="${OPTIMIZER_TYPE}" \
  --mixed_precision="${MIXED_PRECISION}" \
  "${EXTRA_ARGS[@]}" \
  --save_every_n_steps="${SAVE_EVERY}" \
  --save_model_as=safetensors \
  --caption_extension=.txt

echo "Done. LoRA saved under ${OUTPUT_DIR}"
