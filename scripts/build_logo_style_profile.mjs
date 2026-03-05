#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";

const DEFAULT_INFLUENCE_ROOT = "/Users/calbotsman/clawd/data/logo-influences";
const DEFAULT_STYLE_SET = process.env.LOGO_STYLE_SET || "sun-daughter";
const DEFAULT_INPUT_DIR = path.join(DEFAULT_INFLUENCE_ROOT, DEFAULT_STYLE_SET);
const LEGACY_INPUT_DIR = "/Users/calbotsman/clawd/models/lora/studio-logo-lora-training-data";
const DEFAULT_OUTPUT = "/Users/calbotsman/clawd/data/logo-style-profile/latest.json";
const SUPPORTED_IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|svg)$/i;

function parseArgs(argv) {
  const args = {
    inputDir: DEFAULT_INPUT_DIR,
    outputPath: DEFAULT_OUTPUT,
    maxFiles: 120,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" || arg === "--input-dir") {
      args.inputDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output" || arg === "--output-path") {
      args.outputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--max-files") {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error("--max-files must be a positive integer");
      }
      args.maxFiles = parsed;
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
  }

  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/build_logo_style_profile.mjs [options]

Options:
  --input <dir>        Source style-folder (default: ${DEFAULT_INPUT_DIR})
  --output <file>      Output profile path (default: ${DEFAULT_OUTPUT})
  --max-files <n>      Max samples from folder (default: 120)
`);
}

function toSupportedFormat(filePath) {
  return path.extname(filePath).toLowerCase().replace(/^\./, "");
}

function isSupportedImage(fileName) {
  return SUPPORTED_IMAGE_EXTENSIONS.test(fileName);
}

function readSipsInfo(filePath) {
  const output = execFileSync(
    "sips",
    ["-g", "pixelWidth", "-g", "pixelHeight", "-g", "hasAlpha", "-g", "typeIdentifier", "-g", "space", filePath],
    { encoding: "utf8" }
  );
  const info = {};
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.includes(":")) {
      continue;
    }
    const parts = trimmed.split(":");
    if (parts.length < 2) {
      continue;
    }
    const key = parts[0].trim();
    const value = parts.slice(1).join(":").trim();
    info[key] = value;
  }

  const width = Number.parseInt(info.pixelWidth || "0", 10);
  const height = Number.parseInt(info.pixelHeight || "0", 10);
  if (!width || !height) {
    throw new Error(`Could not parse dimensions for ${filePath}`);
  }
  return {
    width,
    height,
    hasAlpha: String(info.hasAlpha || "no").toLowerCase() === "yes",
    type: info.typeIdentifier || "unknown",
    colorSpace: info.space || "unknown",
  };
}

async function readImageInfo(filePath) {
  const extension = toSupportedFormat(filePath);
  if (extension === "svg") {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawd-logo-style-svg-"));
    const tmpPng = path.join(tempDir, `${path.parse(filePath).name}.png`);
    try {
      execFileSync("sips", ["-s", "format", "png", filePath, "--out", tmpPng], { encoding: "utf8" });
      const raster = readSipsInfo(tmpPng);
      return {
        file: filePath,
        width: raster.width,
        height: raster.height,
        hasAlpha: raster.hasAlpha,
        type: raster.type,
        colorSpace: raster.colorSpace,
        format: "svg",
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  const info = readSipsInfo(filePath);
  return {
    ...info,
    file: filePath,
    format: extension,
  };
}

function aspectBucket(width, height) {
  const ratio = width / height;
  if (ratio >= 0.95 && ratio <= 1.05) {
    return "square";
  }
  return ratio > 1.05 ? "landscape" : "portrait";
}

function makeProfile(files, stats) {
  const bucketCounts = {
    square: 0,
    landscape: 0,
    portrait: 0,
  };

  const formatCounts = {};
  const alphaCount = stats.filter((entry) => entry.hasAlpha).length;

  const widths = [];
  const heights = [];
  let hasAny = false;

  for (const entry of stats) {
    hasAny = true;
    const bucket = aspectBucket(entry.width, entry.height);
    bucketCounts[bucket] += 1;
    widths.push(entry.width);
    heights.push(entry.height);
    formatCounts[entry.format] = (formatCounts[entry.format] || 0) + 1;
  }

  const total = stats.length || 1;
  const maxBucket = Object.entries(bucketCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "square";
  const alphaRatio = Number((alphaCount / total).toFixed(4));

  const avg = (values) => values.reduce((acc, value) => acc + value, 0) / values.length;
  const widthAvg = Number(avg(widths).toFixed(2));
  const heightAvg = Number(avg(heights).toFixed(2));

  const profile = {
    createdAt: new Date().toISOString(),
    source: {
      dir: path.resolve(stats.length ? path.dirname(stats[0].file) : "/tmp"),
      fileCount: files.length,
      usedCount: stats.length,
      truncated: files.length > stats.length,
      maxFiles: Math.min(stats.length, Number.MAX_SAFE_INTEGER),
    },
    dimensions: {
      widthMin: Math.min(...widths),
      widthMax: Math.max(...widths),
      widthAvg,
      heightMin: Math.min(...heights),
      heightMax: Math.max(...heights),
      heightAvg,
      total,
    },
    composition: {
      square: bucketCounts.square,
      landscape: bucketCounts.landscape,
      portrait: bucketCounts.portrait,
      dominant: maxBucket,
      alphaRatio,
      alphaDriven: alphaRatio >= 0.2,
      hasSquareDominance: bucketCounts.square / total >= 0.55,
      hasLandscapeDominance: bucketCounts.landscape / total >= 0.55,
      hasPortraitDominance: bucketCounts.portrait / total >= 0.55,
    },
    fileFormats: formatCounts,
    sampleFiles: stats.slice(0, 10).map((entry) => entry.file),
    styleHintSeed: crypto.createHash("sha256").update(stats.map((entry) => `${entry.file}|${entry.width}|${entry.height}`).join("\n")).digest("hex"),
  };

  if (!hasAny) {
    throw new Error("No usable images found in source folder");
  }

  const hints = [
    "minimal logo mark",
    "vector-friendly edges",
    "plain background",
    "high contrast",
    "scalable geometry",
  ];

  if (profile.composition.hasSquareDominance) {
    hints.push("centered circular geometry");
    hints.push("compact emblem");
  }
  if (profile.composition.hasLandscapeDominance) {
    hints.push("horizontal lockup friendly");
  }
  if (profile.composition.hasPortraitDominance) {
    hints.push("tall mark stack");
  }
  if (profile.composition.alphaDriven) {
    hints.push("transparent shape logic");
  }
  if (String((formatCounts["jpeg"] || 0) + (formatCounts["jpg"] || 0) + (formatCounts["public.jpeg"] || 0) + (formatCounts["public.jpg"] || 0)) !== "0") {
    hints.push("strong contour edges");
  }
  if (String(formatCounts["png"] || 0) !== "0") {
    hints.push("icon-style silhouette");
  }
  if (String(formatCounts["svg"] || 0) !== "0") {
    hints.push("clean path-like logo silhouette");
  }

  profile.styleHints = [...new Set(hints)];
  return profile;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let inputDir = path.resolve(args.inputDir);
  if (!(await isDirectory(inputDir))) {
    const fallbackInput = path.resolve(LEGACY_INPUT_DIR);
    if (inputDir === path.resolve(DEFAULT_INPUT_DIR) && (await isDirectory(fallbackInput))) {
      console.log(`INFO: default influence directory not found; using legacy fallback ${fallbackInput}`);
      inputDir = fallbackInput;
    } else {
      throw new Error(`No supported images found in ${args.inputDir}`);
    }
  }
  if (!(await hasSupportedImages(inputDir))) {
    const fallbackInput = path.resolve(LEGACY_INPUT_DIR);
    if (inputDir === path.resolve(DEFAULT_INPUT_DIR) && (await hasSupportedImages(fallbackInput))) {
      console.log(`INFO: default influence directory has no supported images; using legacy fallback ${fallbackInput}`);
      inputDir = fallbackInput;
    } else {
      throw new Error(`No supported images found in ${inputDir}`);
    }
  }
  const outputPath = path.resolve(args.outputPath);

  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isSupportedImage)
    .sort()
    .slice(0, args.maxFiles)
    .map((name) => path.join(inputDir, name));

  if (files.length === 0) {
    throw new Error(`No supported images found in ${inputDir}`);
  }

  const stats = [];
  const skipped = [];
  for (const file of files) {
    try {
      stats.push(await readImageInfo(file));
    } catch (error) {
      skipped.push({
        file,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const profile = makeProfile(files, stats);
  profile.skipped = skipped;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");

  console.log(`Style profile generated: ${outputPath}`);
  console.log(`Used ${stats.length} images from ${inputDir}`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} files.`);
  }
}

async function isDirectory(candidate) {
  try {
    const stat = await fs.stat(candidate);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function hasSupportedImages(candidate) {
  try {
    const entries = await fs.readdir(candidate, { withFileTypes: true });
    return entries.some(
      (entry) => entry.isFile() && isSupportedImage(entry.name)
    );
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
