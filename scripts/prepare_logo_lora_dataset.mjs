#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_INPUT = "/Users/calbotsman/clawd/models/lora/studio-logo-lora-training-data";
const DEFAULT_OUTPUT = "/Users/calbotsman/clawd/models/lora/studio-logo-lora-ready";

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    token: "studiologo",
    repeats: 10,
    maxSize: 1024,
    minSide: 640,
    styleHint: "logo mark, clean vector style, high contrast, centered symbol",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") {
      args.input = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output") {
      args.output = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--token") {
      args.token = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--repeats") {
      args.repeats = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === "--max-size") {
      args.maxSize = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === "--min-side") {
      args.minSide = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === "--style-hint") {
      args.styleHint = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return args;
}

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/prepare_logo_lora_dataset.mjs [options]",
      "",
      "Options:",
      `  --input <dir>       Source images (default: ${DEFAULT_INPUT})`,
      `  --output <dir>      Output root (default: ${DEFAULT_OUTPUT})`,
      "  --token <word>      Trigger token (default: studiologo)",
      "  --repeats <n>       Repeat folder prefix (default: 10)",
      "  --max-size <n>      Max edge after resize (default: 1024)",
      "  --min-side <n>      Skip images with min edge below this (default: 640)",
      '  --style-hint <txt>  Extra caption text (default: "logo mark, clean vector style, high contrast, centered symbol")',
    ].join("\n")
  );
}

function readImageSize(filePath) {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath], {
    encoding: "utf8",
  });
  const widthMatch = out.match(/pixelWidth:\s+(\d+)/);
  const heightMatch = out.match(/pixelHeight:\s+(\d+)/);
  if (!widthMatch || !heightMatch) {
    throw new Error(`Could not read image dimensions for ${filePath}`);
  }
  return {
    width: Number.parseInt(widthMatch[1], 10),
    height: Number.parseInt(heightMatch[1], 10),
  };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function timeStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    return;
  }

  if (!Number.isFinite(args.repeats) || args.repeats < 1) {
    throw new Error("--repeats must be a positive integer");
  }
  if (!Number.isFinite(args.maxSize) || args.maxSize < 256) {
    throw new Error("--max-size must be >= 256");
  }
  if (!Number.isFinite(args.minSide) || args.minSide < 64) {
    throw new Error("--min-side must be >= 64");
  }
  if (!/^[a-z0-9_-]+$/i.test(args.token)) {
    throw new Error("--token must be alphanumeric/underscore/hyphen");
  }

  const inputDir = path.resolve(args.input);
  const outputRoot = path.resolve(args.output);
  const trainDirName = `${args.repeats}_${args.token}`;
  const trainDir = path.join(outputRoot, trainDirName);

  await ensureDir(outputRoot);
  await ensureDir(trainDir);

  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const sourceFiles = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
    .sort();

  if (sourceFiles.length === 0) {
    throw new Error(`No source images found in ${inputDir}`);
  }

  const kept = [];
  const skipped = [];
  let index = 1;

  for (const name of sourceFiles) {
    const sourcePath = path.join(inputDir, name);
    let width;
    let height;
    try {
      ({ width, height } = readImageSize(sourcePath));
    } catch (err) {
      skipped.push({
        source: sourcePath,
        reason: err instanceof Error ? err.message : "size_read_failed",
      });
      continue;
    }

    if (Math.min(width, height) < args.minSide) {
      skipped.push({
        source: sourcePath,
        reason: `min_side_${Math.min(width, height)}_lt_${args.minSide}`,
      });
      continue;
    }

    const base = `logo-${String(index).padStart(4, "0")}`;
    const outPng = path.join(trainDir, `${base}.png`);
    const outTxt = path.join(trainDir, `${base}.txt`);

    try {
      execFileSync(
        "sips",
        ["-s", "format", "png", "-Z", String(args.maxSize), sourcePath, "--out", outPng],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
      const caption = `${args.token} ${args.styleHint}`;
      await fs.writeFile(outTxt, `${caption}\n`, "utf8");

      const resized = readImageSize(outPng);
      kept.push({
        source: sourcePath,
        image: outPng,
        caption: outTxt,
        original: { width, height },
        resized,
      });
      index += 1;
    } catch (err) {
      skipped.push({
        source: sourcePath,
        reason: err instanceof Error ? err.message : "conversion_failed",
      });
    }
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    inputDir,
    outputRoot,
    trainDir,
    config: {
      token: args.token,
      repeats: args.repeats,
      maxSize: args.maxSize,
      minSide: args.minSide,
      styleHint: args.styleHint,
    },
    sourceCount: sourceFiles.length,
    keptCount: kept.length,
    skippedCount: skipped.length,
    kept,
    skipped,
  };

  const manifestPath = path.join(outputRoot, `prepare-manifest-${timeStamp()}.json`);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Input: ${inputDir}`);
  console.log(`Output: ${outputRoot}`);
  console.log(`Train dir: ${trainDir}`);
  console.log(`Kept: ${kept.length}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
