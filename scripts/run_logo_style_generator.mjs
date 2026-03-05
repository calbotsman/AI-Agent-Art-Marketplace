#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PROFILE = "/Users/calbotsman/clawd/data/logo-style-profile/latest.json";
const DEFAULT_BRAND = "Sun Daughter";
const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const SVG_SIZE = 1024;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIR, "..");

function parseArgs(argv) {
  const args = {
    brand: DEFAULT_BRAND,
    profilePath: DEFAULT_PROFILE,
    outDir: "",
    promptCount: 3,
    recraftModel: "recraft/recraft-v4",
    recraftStyle: "vivid",
    recraftSize: "1024x1024",
    allowFallbackSvg: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--brand") {
      args.brand = argv[i + 1] || DEFAULT_BRAND;
      i += 1;
      continue;
    }
    if (arg === "--style-profile") {
      args.profilePath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--out-dir") {
      args.outDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--prompts") {
      const value = Number.parseInt(argv[i + 1], 10);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error("--prompts must be a positive integer");
      }
      args.promptCount = value;
      i += 1;
      continue;
    }
    if (arg === "--recraft-model") {
      args.recraftModel = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--recraft-style") {
      args.recraftStyle = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--recraft-size") {
      args.recraftSize = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--no-fallback") {
      args.allowFallbackSvg = false;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
  }

  if (!args.outDir) {
    throw new Error("--out-dir is required");
  }
  if (!/^\d+x\d+$/.test(args.recraftSize)) {
    throw new Error("Invalid --recraft-size. Expected e.g. 1024x1024");
  }
  if (!["vivid", "natural"].includes(args.recraftStyle)) {
    throw new Error("Invalid --recraft-style. Use vivid or natural");
  }

  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/run_logo_style_generator.mjs --out-dir <dir> [options]

Options:
  --brand <name>               Brand name for prompt conditioning (default: ${DEFAULT_BRAND})
  --style-profile <file>       Path to build output from scripts/build_logo_style_profile.mjs
  --out-dir <dir>              Output directory (required)
  --prompts <n>                Number of variants to generate (default: 3)
  --recraft-model <id>         Recraft model id
  --recraft-style vivid|natural Default: vivid
  --recraft-size <WxH>         Recraft size (default: 1024x1024)
  --no-fallback                Skip deterministic fallback generation
`);
}

function parseEnvFile(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function loadLocalEnvFiles() {
  const envPaths = [
    path.join(WORKSPACE_ROOT, ".env"),
    path.join(os.homedir(), ".openclaw", ".env"),
  ];
  for (const envPath of envPaths) {
    try {
      const content = await fs.readFile(envPath, "utf8");
      const parsed = parseEnvFile(content);
      for (const [key, value] of Object.entries(parsed)) {
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    } catch {
      // missing env file is acceptable
    }
  }
}

function getAIGatewayKey() {
  return process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || "";
}

function normalizePrompt(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return clamp01(((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}

function hashSeed(value) {
  return createHash("sha256").update(String(value)).digest().readUInt32LE(0);
}

function buildPrompts(profile, brand, count) {
  const baseHints = Array.isArray(profile.styleHints) ? profile.styleHints.slice(0, 6) : [];
  const seedHint = profile.styleHintSeed?.slice(0, 10) || "studio";
  const compositionBias = profile.composition || {};
  const geometryBias = [];
  if (compositionBias.hasSquareDominance) {
    geometryBias.push("compact circular geometry", "radial symmetry");
  }
  if (compositionBias.hasLandscapeDominance) {
    geometryBias.push("horizontal lockup", "wide pacing");
  }
  if (compositionBias.hasPortraitDominance) {
    geometryBias.push("stacked mark shape", "tall silhouette");
  }

  const paletteBias = `${compositionBias.alphaDriven ? "hard-edge silhouettes and clean fills" : "strong contrast and clear shapes"}`;
  const outputConstraints = "transparent background, no gradients, no shadows, no 3d, no lighting effects, no texture, no photorealism, no mockup, no watermark, no text";
  const brandToken = normalizePrompt(brand);
  const hintText = [...baseHints, ...geometryBias, paletteBias, outputConstraints, `style-fingerprint ${seedHint}`]
    .filter(Boolean)
    .join(", ");

  const seeds = [
    `${brandToken} logo mark, centered composition, ${hintText}, flat vector style, high contrast, icon-first, premium utility aesthetic`,
    `${brandToken} emblem, abstract symbol + geometric rhythm, ${hintText}, isolated symbol, balanced proportion`,
    `${brandToken} wordmark lockup concept, strong mark geometry, ${hintText}, icon-first, compact symbol lockup`,
  ];

  const out = [];
  for (let i = 0; i < count; i += 1) {
    const source = seeds[i % seeds.length];
    const seedModifier = `${profile.styleHintSeed || "seed"}-${i}`;
    out.push(normalizePrompt(`${source}, variant ${i + 1}, ${seedModifier}`));
  }
  return out;
}

async function ensureModelAvailable(apiKey, model) {
  const response = await fetch(`${AI_GATEWAY_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Model check failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const payload = await response.json();
  const data = Array.isArray(payload?.data) ? payload.data : [];
  if (!data.some((entry) => entry?.id === model)) {
    throw new Error(`Model ${model} is unavailable in gateway`);
  }
}

async function generateRecraftImage({ apiKey, model, prompt, style, size }) {
  const response = await fetch(`${AI_GATEWAY_BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: normalizePrompt(prompt),
      n: 1,
      size,
      style,
      response_format: "b64_json",
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Recraft image generation failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const payload = await response.json();
  const item = Array.isArray(payload?.data) ? payload.data[0] : null;
  if (item?.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  throw new Error("Recraft response missing image bytes");
}

function fallbackColor(seedText) {
  const seed = hashSeed(seedText);
  const hue = Math.floor(seed % 360);
  const sat = 58 + (seed % 26);
  const light = 24 + ((seed >> 2) % 26);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function circlePath(cx, cy, r) {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
}

function buildFallbackSvg({ brand, index, profile, seedText }) {
  const seed = hashSeed(seedText);
  const rand = mulberry32(seed);
  const center = SVG_SIZE / 2;
  const maxR = 240 + Math.floor(rand() * 160);
  const stroke = fallbackColor(seedText);
  const accent = fallbackColor(`${seedText}-accent`);
  const isSun = /sun/i.test(brand);
  const hasSquare = profile.composition?.dominant === "square";

  const rays = hasSquare ? 8 + Math.floor(rand() * 6) : 5 + Math.floor(rand() * 4);
  const rayWidth = 4 + Math.floor(rand() * 10);

  const rayElements = [];
  for (let i = 0; i < rays; i += 1) {
    const angle = (Math.PI * 2 * i) / rays;
    const rad1 = maxR - 60;
    const rad2 = maxR + 25 + Math.floor(rand() * 45);
    const x1 = center + Math.cos(angle) * rad1;
    const y1 = center + Math.sin(angle) * rad1;
    const x2 = center + Math.cos(angle) * rad2;
    const y2 = center + Math.sin(angle) * rad2;
    rayElements.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${accent}" stroke-width="${rayWidth}" stroke-linecap="round"/>`
    );
  }

  const orbit = isSun ? `<path d="${circlePath(center, center, maxR)}" fill="none" stroke="${stroke}" stroke-width="7" stroke-linejoin="round"/>` : "";
  const coreR = Math.max(38, Math.floor(maxR * 0.43));
  const variants = [
    `<circle cx="${center}" cy="${center}" r="${coreR}" fill="none" stroke="${stroke}" stroke-width="12"/>`,
    `<circle cx="${center}" cy="${center}" r="${coreR * 0.42}" fill="${accent}" />`,
    `<path d="${circlePath(center - 58, center - 22, coreR * 0.55)}" fill="${accent}" fill-opacity="0.18"/>`,
  ];
  const bars = [];
  for (let i = 0; i < 6; i += 1) {
    const localAngle = (Math.PI * 2 * i) / 6 + rand() * 0.35;
    const offset = 44 + Math.floor(rand() * 90);
    const len = 24 + Math.floor(rand() * 24);
    bars.push(
      `<line x1="${(center + Math.cos(localAngle) * offset).toFixed(2)}" y1="${(center + Math.sin(localAngle) * offset).toFixed(2)}" x2="${(center + Math.cos(localAngle) * (offset + len)).toFixed(2)}" y2="${(center + Math.sin(localAngle) * (offset + len)).toFixed(2)}" stroke="${accent}" stroke-width="7" stroke-linecap="round" />`
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_SIZE}" height="${SVG_SIZE}" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}">`,
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`,
    orbit,
    ...rayElements,
    ...bars,
    ...variants,
    `<circle cx="${center}" cy="${center}" r="${coreR * 0.18}" fill="${accent}" />`,
    `<circle cx="${center}" cy="${center}" r="${coreR * 0.75}" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="12 12" />`,
    `</g>`,
    `</svg>`,
  ]
    .join("");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function writeImageFromSvg(svgPath, pngPath) {
  const command = ["sips", "-s", "format", "png", svgPath, "--out", pngPath];
  const result = spawnSync(command[0], command.slice(1), {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`SVG->PNG conversion failed for ${pngPath}: ${output}`);
  }
}

async function writeSvgFromPngBytes(pngPath, svgPath) {
  const pngBytes = await fs.readFile(pngPath);
  const b64 = pngBytes.toString("base64");
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_SIZE}" height="${SVG_SIZE}" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}">`,
    `  <image href="data:image/png;base64,${b64}" x="0" y="0" width="${SVG_SIZE}" height="${SVG_SIZE}" />`,
    `</svg>`,
    "",
  ].join("\n");
  await fs.writeFile(svgPath, `${svg}\n`, "utf8");
}

async function makeBackgroundTransparent(pngPath) {
  const check = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (check.status !== 0) {
    return false;
  }

  const tmpPath = `${pngPath}.transparent.png`;
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      pngPath,
      "-vf",
      "colorkey=0xFFFFFF:0.08:0.0,format=rgba",
      "-frames:v",
      "1",
      "-update",
      "1",
      tmpPath,
    ],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
    try {
      await fs.unlink(tmpPath);
    } catch {
      // ignore cleanup failures
    }
    return false;
  }

  await fs.rename(tmpPath, pngPath);
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadLocalEnvFiles();

  const profile = JSON.parse(await fs.readFile(path.resolve(args.profilePath), "utf8"));
  const outRoot = path.resolve(args.outDir);
  const svgDir = path.join(outRoot, "svg");
  const previewDir = path.join(outRoot, "previews");
  await fs.mkdir(svgDir, { recursive: true });
  await fs.mkdir(previewDir, { recursive: true });

  const prompts = buildPrompts(profile, args.brand, args.promptCount);
  const outputs = [];
  let recraftError = null;
  let recraftAvailable = false;
  let recraftAnySuccess = false;
  const key = getAIGatewayKey();
  if (key) {
    try {
      await ensureModelAvailable(key, args.recraftModel);
      recraftAvailable = true;
    } catch (error) {
      recraftError = error instanceof Error ? error.message : String(error);
    }
  }

  for (let index = 0; index < prompts.length; index += 1) {
    const prompt = prompts[index];
    const stem = `logo-${String(index + 1).padStart(2, "0")}`;
    const svgPath = path.join(svgDir, `${stem}.svg`);
    const pngPath = path.join(previewDir, `${stem}.png`);
    const promptSeed = `${args.brand}|${index}|${profile.styleHintSeed}`;
    let pngBytes;
    let source = "fallback-svg";

    if (recraftAvailable && args.promptCount > 0) {
      try {
        pngBytes = await generateRecraftImage({
          apiKey: key,
          model: args.recraftModel,
          prompt,
          style: args.recraftStyle,
          size: args.recraftSize,
        });
        await fs.writeFile(pngPath, pngBytes);
        await makeBackgroundTransparent(pngPath);
        source = "recraft-v4";
      } catch (error) {
        recraftError = error instanceof Error ? error.message : String(error);
      }
      if (pngBytes) {
        recraftAnySuccess = true;
        await writeSvgFromPngBytes(pngPath, svgPath);
        source = "recraft-v4";
      }
    }

    if (!pngBytes) {
      if (!args.allowFallbackSvg) {
        throw new Error(`No image generated for ${stem} (fallback disabled). ${recraftError || "No gateway key."}`);
      }
      const svgContent = buildFallbackSvg({
        brand: args.brand,
        index,
        profile,
        seedText: promptSeed,
      });
      await fs.writeFile(svgPath, svgContent, "utf8");
      await writeImageFromSvg(svgPath, pngPath);
      source = "fallback-svg";
    }

    const pngStat = await fs.stat(pngPath).catch(() => null);
    if (!pngStat || pngStat.size === 0) {
      throw new Error(`Generated PNG is empty: ${pngPath}`);
    }

    outputs.push({
      index,
      stem,
      prompt,
      promptSource: source,
      svg: svgPath,
      png: pngPath,
    });
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    brand: args.brand,
    styleProfile: path.resolve(args.profilePath),
    outputDir: outRoot,
    generator: "logo-style-influenced-deterministic",
    recraft: {
      enabled: Boolean(getAIGatewayKey()),
      model: args.recraftModel,
      style: args.recraftStyle,
      size: args.recraftSize,
      used: recraftAnySuccess,
      error: recraftError,
    },
    outputs,
  };
  await fs.writeFile(path.join(outRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Sun Daughter logo style candidates written to ${outRoot}`);
  outputs.forEach((output) => {
    console.log(`- ${output.stem}:`);
    console.log(`  prompt: ${escapeXml(output.prompt)}`);
    console.log(`  png: ${output.png}`);
    console.log(`  svg: ${output.svg}`);
  });
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
