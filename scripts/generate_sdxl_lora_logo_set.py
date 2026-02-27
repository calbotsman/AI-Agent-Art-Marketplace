#!/usr/bin/env python3

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from diffusers import DPMSolverMultistepScheduler, StableDiffusionXLPipeline

DEFAULT_BASE_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"
WORKSPACE_DIR = Path("/Users/calbotsman/clawd")
COMMON_BASE_MODEL_PATHS = [
    WORKSPACE_DIR / "models" / "stable-diffusion" / "sd_xl_base_1.0.safetensors",
    WORKSPACE_DIR / "models" / "Stable-diffusion" / "sd_xl_base_1.0.safetensors",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate SDXL logo samples using a trained LoRA.")
    parser.add_argument("--lora", required=True, help="Path to LoRA .safetensors file.")
    parser.add_argument(
        "--base-model",
        default=DEFAULT_BASE_MODEL,
        help="Base model id or local path for SDXL.",
    )
    parser.add_argument("--out-dir", required=True, help="Directory for generated images and manifest.")
    parser.add_argument("--prompt", action="append", default=[], help="Prompt (can be repeated).")
    parser.add_argument("--prompt-file", help="Text file with one prompt per line.")
    parser.add_argument(
        "--negative-prompt",
        default="blurry, low quality, watermark, signature, text artifacts, noisy, cluttered composition",
        help="Negative prompt applied to all generations.",
    )
    parser.add_argument("--steps", type=int, default=35, help="Inference steps.")
    parser.add_argument("--guidance", type=float, default=5.8, help="CFG guidance scale.")
    parser.add_argument("--width", type=int, default=768, help="Output width.")
    parser.add_argument("--height", type=int, default=768, help="Output height.")
    parser.add_argument("--seed-base", type=int, default=20260221, help="Base seed.")
    parser.add_argument("--num-images", type=int, default=1, help="Images per prompt.")
    parser.add_argument("--lora-scale", type=float, default=0.9, help="LoRA fusion scale.")
    parser.add_argument(
        "--dtype",
        choices=["auto", "float16", "float32"],
        default="auto",
        help="Torch dtype selection.",
    )
    parser.add_argument(
        "--max-dark-pct",
        type=float,
        default=99.5,
        help="If a render is >= this percent near-black pixels on MPS, retry with safer params.",
    )
    return parser.parse_args()


def resolve_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def resolve_dtype(device: str, requested: str) -> torch.dtype:
    if requested == "float16":
        return torch.float16
    if requested == "float32":
        return torch.float32
    if device == "mps":
        return torch.float32  # Force float32 for MPS due to potential issues
    if device == "cuda":
        return torch.float16 # Keep float16 for CUDA
    return torch.float32


def load_prompts(args: argparse.Namespace) -> list[str]:
    prompts = [p.strip() for p in args.prompt if p and p.strip()]

    if args.prompt_file:
        raw = Path(args.prompt_file).read_text(encoding="utf-8")
        for line in raw.splitlines():
            cleaned = line.strip()
            if not cleaned or cleaned.startswith("#"):
                continue
            prompts.append(cleaned)

    deduped: list[str] = []
    seen = set()
    for p in prompts:
        if p not in seen:
            deduped.append(p)
            seen.add(p)

    if not deduped:
        raise ValueError("No prompts provided. Use --prompt or --prompt-file.")
    return deduped


def resolve_base_model_identifier(configured: str) -> tuple[str, str]:
    configured = (configured or "").strip()
    if not configured:
        return DEFAULT_BASE_MODEL, "default"

    candidate = Path(configured).expanduser()
    if candidate.exists():
        return str(candidate.resolve()), "configured-path"

    # If a local safetensors path was configured but moved/renamed, try known workspace locations.
    if configured.endswith("sd_xl_base_1.0.safetensors"):
        for known_path in COMMON_BASE_MODEL_PATHS:
            if known_path.exists():
                return str(known_path.resolve()), "known-path-fallback"

    looks_like_path = (
        configured.startswith("/")
        or configured.startswith("~")
        or configured.endswith(".safetensors")
        or configured.endswith(".ckpt")
    )
    if looks_like_path:
        print(
            f"[warn] base model path not found: {configured}; falling back to {DEFAULT_BASE_MODEL}",
            file=sys.stderr,
        )
        return DEFAULT_BASE_MODEL, "repo-fallback"

    return configured, "configured-id"


def dark_pct(image) -> float:
    arr = np.asarray(image.convert("RGB"), dtype=np.uint8)
    return float(np.mean(np.all(arr <= 8, axis=2)) * 100.0)


def build_pipe(base_model: str, lora_path: Path, device: str, dtype: torch.dtype, lora_scale: float):
    pipe = StableDiffusionXLPipeline.from_pretrained(base_model, torch_dtype=dtype)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe.load_lora_weights(str(lora_path))
    pipe.fuse_lora(lora_scale=lora_scale)
    pipe.enable_attention_slicing()
    pipe.to(device)
    return pipe


def render_image(
    pipe,
    prompt: str,
    negative_prompt: str,
    steps: int,
    guidance: float,
    width: int,
    height: int,
    seed: int,
):
    generator = torch.Generator(device="cpu").manual_seed(seed)
    return pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_inference_steps=steps,
        guidance_scale=guidance,
        width=width,
        height=height,
        generator=generator,
    ).images[0]


def main() -> None:
    args = parse_args()
    lora_path = Path(args.lora).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not lora_path.exists():
        raise FileNotFoundError(f"LoRA file not found: {lora_path}")

    prompts = load_prompts(args)
    device = resolve_device()
    dtype = resolve_dtype(device, args.dtype)
    resolved_base_model, base_model_source = resolve_base_model_identifier(args.base_model)

    pipe = build_pipe(resolved_base_model, lora_path, device, dtype, args.lora_scale)
    cpu_pipe = None

    records = []
    for prompt_index, prompt in enumerate(prompts, start=1):
        for image_index in range(1, args.num_images + 1):
            seed = args.seed_base + (prompt_index * 1000) + image_index
            used = {
                "steps": args.steps,
                "guidance": args.guidance,
                "width": args.width,
                "height": args.height,
                "loraScale": args.lora_scale,
                "device": device,
            }
            image = render_image(
                pipe,
                prompt,
                args.negative_prompt,
                used["steps"],
                used["guidance"],
                used["width"],
                used["height"],
                seed,
            )
            dark = dark_pct(image)

            if device == "mps" and dark >= args.max_dark_pct:
                print(
                    f"[warn] near-black render (dark={dark:.2f}%) for prompt {prompt_index}; "
                    "retrying with safer MPS settings",
                    file=sys.stderr,
                )
                safe = {
                    "steps": min(args.steps, 28),
                    "guidance": min(args.guidance, 3.2),
                    "width": min(args.width, 600),
                    "height": min(args.height, 600),
                    "loraScale": min(args.lora_scale, 0.65),
                    "device": "mps",
                }
                safe_pipe = build_pipe(
                    resolved_base_model,
                    lora_path,
                    "mps",
                    torch.float32,
                    safe["loraScale"],
                )
                image = render_image(
                    safe_pipe,
                    prompt,
                    args.negative_prompt,
                    safe["steps"],
                    safe["guidance"],
                    safe["width"],
                    safe["height"],
                    seed,
                )
                dark = dark_pct(image)
                used = safe
                del safe_pipe

                if dark >= args.max_dark_pct:
                    print(
                        f"[warn] still near-black on MPS (dark={dark:.2f}%), "
                        "retrying on CPU fallback",
                        file=sys.stderr,
                    )
                    if cpu_pipe is None:
                        cpu_pipe = build_pipe(
                            resolved_base_model,
                            lora_path,
                            "cpu",
                            torch.float32,
                            used["loraScale"],
                        )
                    image = render_image(
                        cpu_pipe,
                        prompt,
                        args.negative_prompt,
                        used["steps"],
                        used["guidance"],
                        used["width"],
                        used["height"],
                        seed,
                    )
                    dark = dark_pct(image)
                    used = {**used, "device": "cpu"}

            filename = f"logo-p{prompt_index:02d}-v{image_index:02d}-s{seed}.png"
            image_path = out_dir / filename
            image.save(image_path)

            records.append(
                {
                    "promptIndex": prompt_index,
                    "variantIndex": image_index,
                    "seed": seed,
                    "prompt": prompt,
                    "file": str(image_path),
                    "darkPct": dark,
                    "renderConfig": used,
                }
            )

    manifest = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "baseModel": resolved_base_model,
        "baseModelConfigured": args.base_model,
        "baseModelSource": base_model_source,
        "loraPath": str(lora_path),
        "device": device,
        "dtype": str(dtype).replace("torch.", ""),
        "config": {
            "steps": args.steps,
            "guidance": args.guidance,
            "width": args.width,
            "height": args.height,
            "negativePrompt": args.negative_prompt,
            "seedBase": args.seed_base,
            "numImagesPerPrompt": args.num_images,
            "loraScale": args.lora_scale,
        },
        "promptCount": len(prompts),
        "imageCount": len(records),
        "images": records,
    }
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"Generated {len(records)} image(s)")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
