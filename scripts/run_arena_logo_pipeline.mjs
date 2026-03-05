#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_ROOT = "/Users/calbotsman/clawd";
const DEFAULT_BOARD = process.env.ARENA_BOARD_URL || process.env.ARENA_BOARD || "";
const DEFAULT_OUTPUT_DIR = "/Users/calbotsman/clawd/data/logo-influences/sun-daughter";
const DEFAULT_MAX = Number(process.env.ARENA_SYNC_MAX || "200");
const DEFAULT_CATALOG = "/Users/calbotsman/clawd/data/logo-influences/meta/logo-catalog.jsonl";
const DEFAULT_REVIEW = "/Users/calbotsman/clawd/data/logo-influences/meta/logo-tag-review.md";

function usage() {
  console.log(`Usage:
  node scripts/run_arena_logo_pipeline.mjs [board_or_url] [options]

Options:
  --board <value>      Board URL or user/board slug (defaults to ARENA_BOARD_URL/ARENA_BOARD or 1P fallback)
  --output <dir>       Destination directory for downloaded images (default: ${DEFAULT_OUTPUT_DIR})
  --max <n>            Max images to download (default: ${DEFAULT_MAX})
  --tag-only-missing    Tag only images not already in the catalog (default: true)
  --no-tag             Skip vision tagging step
  --help               Show this help
`);
}

function parseArgs(argv) {
  const parsed = {
    board: DEFAULT_BOARD,
    outputDir: DEFAULT_OUTPUT_DIR,
    max: DEFAULT_MAX,
    noTag: false,
    tagOnlyMissing: true,
    help: false,
  };
  let positionalSet = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--board") {
      parsed.board = argv[i + 1] || parsed.board;
      i += 1;
      continue;
    }

    if (arg === "--output") {
      parsed.outputDir = argv[i + 1] || parsed.outputDir;
      i += 1;
      continue;
    }

    if (arg === "--max") {
      const parsedMax = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(parsedMax) && parsedMax > 0) {
        parsed.max = parsedMax;
      }
      i += 1;
      continue;
    }

    if (arg === "--tag-only-missing") {
      parsed.tagOnlyMissing = true;
      continue;
    }

    if (arg === "--no-tag") {
      parsed.noTag = true;
      continue;
    }

    if (arg.startsWith("--") && arg.includes("=")) {
      const [key, value] = arg.split("=", 2);
      if (key === "--board") {
        parsed.board = value || parsed.board;
        continue;
      }
      if (key === "--output") {
        parsed.outputDir = value || parsed.outputDir;
        continue;
      }
      if (key === "--max") {
        const parsedMax = Number.parseInt(value, 10);
        if (Number.isFinite(parsedMax) && parsedMax > 0) {
          parsed.max = parsedMax;
        }
        continue;
      }
      if (key === "--tag-only-missing") {
        parsed.tagOnlyMissing = (value || "true") !== "false";
        continue;
      }
      if (key === "--no-tag") {
        parsed.noTag = value === "true";
        continue;
      }
      continue;
    }

    if (!positionalSet && !arg.startsWith("--")) {
      parsed.board = arg;
      positionalSet = true;
    }
  }

  return parsed;
}

function runNode(script, args, opts = {}) {
  const result = spawnSync("node", [script, ...args], {
    cwd: DEFAULT_ROOT,
    stdio: "inherit",
    encoding: "utf8",
    ...opts,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const status = result.status ?? "unknown";
    throw new Error(`Command failed (${script}) exit ${status}`);
  }
  return result;
}

async function findLatestManifest(outputDir) {
  const target = path.resolve(outputDir);
  const files = await fs.readdir(target, { withFileTypes: true });
  let latest = null;

  for (const entry of files) {
    if (!entry.isFile()) continue;
    if (!/^arena-(sync|direct)-manifest-/.test(entry.name)) continue;
    const full = path.join(target, entry.name);
    const stat = await fs.stat(full);
    if (!latest || stat.mtimeMs > latest.mtimeMs) {
      latest = { path: full, mtimeMs: stat.mtimeMs };
    }
  }

  if (!latest) {
    throw new Error(`No arena sync manifest found in ${target}`);
  }
  return latest.path;
}

function uniqueByFileName(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const base = path.basename(value || "");
    if (!base || seen.has(base)) continue;
    seen.add(base);
    out.push(value);
  }
  return out;
}

function extractDownloadedPaths(manifest) {
  const direct = manifest?.downloaded;
  if (Array.isArray(direct)) {
    return direct.map((entry) => (typeof entry === "string" ? entry : entry?.path)).filter(Boolean);
  }

  if (Array.isArray(manifest?.files)) {
    return manifest.files.map((entry) => entry?.path).filter(Boolean);
  }

  return [];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    process.exit(0);
  }

  if (!options.board) {
    throw new Error("No board provided. Set ARENA_BOARD_URL or ARENA_BOARD or pass --board.");
  }

  const outputDir = path.resolve(options.outputDir);
  await fs.mkdir(outputDir, { recursive: true });

  const syncArgs = [
    "scripts/sync_arena_to_lora.mjs",
    "--board",
    options.board,
    "--output",
    outputDir,
    "--max",
    String(options.max),
  ];

  console.log(`[1/2] Syncing board: ${options.board}`);
  console.log(`[1/2] Output folder: ${outputDir}`);
  runNode("scripts/sync_arena_to_lora.mjs", [
    "--board",
    options.board,
    "--output",
    outputDir,
    "--max",
    String(options.max),
  ]);

  const manifestPath = await findLatestManifest(outputDir);
  const manifestRaw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const downloaded = uniqueByFileName(extractDownloadedPaths(manifest));
  const newFiles = uniqueByFileName(downloaded);
  const downloadedCount = typeof manifest?.downloaded === "number" ? manifest.downloaded : newFiles.length;

  console.log(`Downloaded new files: ${downloadedCount}`);
  if (newFiles.length === 0) {
    console.log("No new files to tag. Pipeline complete.");
    console.log(`Manifest: ${manifestPath}`);
    return;
  }

  if (options.noTag) {
    console.log("Skipping tag step due to --no-tag.");
    console.log(`Manifest: ${manifestPath}`);
    return;
  }

  const tagArgs = [
    "--root",
    outputDir,
    "--catalog",
    DEFAULT_CATALOG,
    "--review",
    DEFAULT_REVIEW,
  ];

  if (options.tagOnlyMissing) {
    tagArgs.push("--only-missing");
  }

  for (const file of newFiles) {
    tagArgs.push("--file", file);
  }

  console.log(`[2/2] Tagging ${newFiles.length} new files`);
  runNode("scripts/tag_logo_influences_vision.mjs", tagArgs);

  console.log(`Sync manifest: ${manifestPath}`);
  console.log(`Catalog: ${DEFAULT_CATALOG}`);
  console.log(`Review: ${DEFAULT_REVIEW}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
