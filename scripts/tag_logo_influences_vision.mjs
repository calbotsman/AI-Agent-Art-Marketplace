#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const DEFAULT_ROOT = "/Users/calbotsman/clawd/data/logo-influences";
const DEFAULT_META_DIR = path.join(DEFAULT_ROOT, "meta");
const DEFAULT_CATALOG_PATH = process.env.LOGO_CATALOG_PATH || path.join(DEFAULT_META_DIR, "logo-catalog.jsonl");
const DEFAULT_REVIEW_PATH = process.env.LOGO_REVIEW_PATH || path.join(DEFAULT_META_DIR, "logo-tag-review.md");
const API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
const MAX_TOKENS = 450;
const REVIEW_THRESHOLD = Number(process.env.LOGO_REVIEW_THRESHOLD || "0.78");

function parseArgs(argv) {
  const parsed = {
    rootDir: process.env.LOGO_INFLUENCE_DIR || DEFAULT_ROOT,
    catalogPath: DEFAULT_CATALOG_PATH,
    reviewPath: DEFAULT_REVIEW_PATH,
    files: [],
    onlyMissing: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--output" || arg === "--root" || arg === "--input" || arg === "-i") {
      parsed.rootDir = argv[i + 1] || parsed.rootDir;
      i += 1;
      continue;
    }

    if (arg === "--catalog") {
      parsed.catalogPath = argv[i + 1] || parsed.catalogPath;
      i += 1;
      continue;
    }

    if (arg === "--review") {
      parsed.reviewPath = argv[i + 1] || parsed.reviewPath;
      i += 1;
      continue;
    }

    if (arg === "--file" || arg === "--files") {
      const raw = argv[i + 1] || "";
      parsed.files.push(
        ...raw
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      );
      i += 1;
      continue;
    }

    if (arg === "--only-missing") {
      parsed.onlyMissing = true;
      continue;
    }

    if (arg.startsWith("--")) {
      if (arg.includes("=")) {
        const [key, value] = arg.split("=", 2);
        if (key === "--catalog") {
          parsed.catalogPath = value || parsed.catalogPath;
          continue;
        }
        if (key === "--review") {
          parsed.reviewPath = value || parsed.reviewPath;
          continue;
        }
        if (key === "--output" || key === "--root" || key === "--input") {
          parsed.rootDir = value || parsed.rootDir;
          continue;
        }
        if (key === "--file" || key === "--files") {
          parsed.files.push(
            ...((value || "")
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean))
          );
          continue;
        }
      }

      continue;
    }

    if (!parsed._rootSet) {
      parsed.rootDir = arg;
      parsed._rootSet = true;
      continue;
    }

    // Treat trailing bare values as explicit file paths for this run.
    parsed.files.push(arg);
  }

  return parsed;
}

function usage() {
  console.log(`Usage:
  node scripts/tag_logo_influences_vision.mjs <root-dir> [options]

Options:
  --only-missing             Only tag image files not already present in catalog
  --catalog <path>           Catalog output path (default: ${DEFAULT_CATALOG_PATH})
  --review <path>            Review output path (default: ${DEFAULT_REVIEW_PATH})
  --file <path[,path...]>    Tag explicit files only (comma-separated)
  --files <path[,path...]>   Same as --file
  --output <dir>             Alias for <root-dir>
  --help                     Show help
`);
}

const args = parseArgs(process.argv.slice(2));
const rootDir = path.resolve(args.rootDir);
const outputCatalog = path.resolve(args.catalogPath);
const outputReview = path.resolve(args.reviewPath);
const explicitFiles = args.files.map((entry) => path.resolve(entry));
const onlyMissing = args.onlyMissing;

if (args.help) {
  usage();
  process.exit(0);
}

const supportedExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

const baseTags = ["sun-daughter", "logo-influence"];

const visionPrompt = [
  "Classify this logo image.",
  "Return strict JSON only with these fields:",
  '{ "tags": [array], "confidence": number 0-1, "notes": string, "uncertain": bool }',
  "Allowed tags: geometric, geometric-heavy, serif, sans, script, hand-drawn, ornamental, minimal, icon, icon-only, typographic, wordmark, monogram, emblem, badge, circular, square, emblematic, organic, decorative, distressed, vintage, flat, realistic, transparent-bg.",
  "Use only lowercase kebab-case tags.",
  "Include wordmark and typographic only when readable letterforms dominate.",
  "Include icon-only when it is mostly symbol-only.",
  "Mark uncertain true when you're not confident.",
  "Do not mention tool instructions or assumptions.",
  "If transparent background is visible, include transparent-bg.",
].join(" ");

async function collectImages(dir, explicitPaths = []) {
  if (explicitPaths.length > 0) {
    const files = [];
    for (const item of explicitPaths) {
      const full = path.isAbsolute(item) ? item : path.join(dir, item);
      try {
        const stat = await fs.stat(full);
        if (!stat.isFile()) continue;
      } catch (_error) {
        continue;
      }

      const ext = path.extname(full).toLowerCase();
      if (!supportedExt.has(ext)) continue;
      const name = path.basename(full);
      if (name.startsWith(".DS_Store")) continue;
      if (/manifest/i.test(name)) continue;
      files.push(full);
    }
    return files.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(dir, entry.name);
    const ext = path.extname(entry.name).toLowerCase();
    if (!supportedExt.has(ext)) continue;
    if (entry.name.startsWith(".DS_Store")) continue;
    if (/manifest|manifest/i.test(entry.name)) continue;
    files.push(fullPath);
  }

  return files.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

function getMimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "jpeg";
  if (ext === ".webp") return "webp";
  if (ext === ".png") return "png";
  return "jpeg";
}

function getImageInfo(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".svg") {
    return { width: null, height: null, hasAlpha: true, format: "svg" };
  }

  try {
    const output = execSync(
      `sips -g pixelWidth -g pixelHeight -g hasAlpha ${JSON.stringify(filePath)}`,
      { encoding: "utf8" }
    );
    const lines = output.split("\n").map((line) => line.trim());
    const width = Number.parseInt(lines.find((line) => line.startsWith("pixelWidth:") || line.includes("pixelWidth"))?.split(":").slice(1).join(":").trim() || "0", 10);
    const height = Number.parseInt(lines.find((line) => line.startsWith("pixelHeight:") || line.includes("pixelHeight"))?.split(":").slice(1).join(":").trim() || "0", 10);
    const hasAlphaRaw = lines.find((line) => line.startsWith("hasAlpha:") || line.includes("hasAlpha"));
    const hasAlpha = String(hasAlphaRaw || "").split(":").slice(1).join(":").trim().toLowerCase() === "yes";
    return { width: Number.isFinite(width) ? width : null, height: Number.isFinite(height) ? height : null, hasAlpha, format: ext.replace(".", "") };
  } catch (error) {
    return { width: null, height: null, hasAlpha: null, format: ext.replace(".", "") };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseVisionJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) return null;
    try {
      return JSON.parse(text.slice(first, last + 1));
    } catch (_inner) {
      return null;
    }
  }
}

async function callVision(filePath, imageBase64) {
  const imagePayload = `data:image/${getMimeFromExt(filePath)};base64,${imageBase64}`;
  const attempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          max_tokens: MAX_TOKENS,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: visionPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Classify this logo style for style-folder tagging. Return strict JSON only.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imagePayload,
                    detail: "low",
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vision API failed (${response.status}): ${errorText}`);
      }

      const payload = await response.json();
      const raw = payload?.choices?.[0]?.message?.content;
      const parsed = parseVisionJson(raw);
      if (!parsed) {
        return {
          tags: ["needs-review"],
          confidence: 0,
          notes: "Could not parse response from vision model",
          uncertain: true,
          raw,
        };
      }

      const normalized = Array.isArray(parsed.tags)
        ? parsed.tags
            .map((value) => String(value || "").trim().toLowerCase())
            .filter((value) => /^[a-z0-9-]+$/.test(value))
        : [];
      const confidence = Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0;

      return {
        tags: normalized,
        confidence: Math.max(0, Math.min(1, confidence)),
        notes: String(parsed.notes || ""),
        uncertain: Boolean(parsed.uncertain) || confidence < REVIEW_THRESHOLD,
        raw,
      };
    } catch (error) {
      lastError = error;
      await sleep(600 * attempt);
    }
  }

  return {
    tags: ["needs-review"],
    confidence: 0,
    notes: `vision-call-failed: ${lastError?.message || "unknown"}`,
    uncertain: true,
    raw: "",
  };
}

async function readCatalog(catalogPath) {
  try {
    const raw = await fs.readFile(catalogPath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_error) {
          return null;
        }
      })
      .filter((entry) => entry && typeof entry === "object");
  } catch (_error) {
    return [];
  }
}

async function main() {
  const images = await collectImages(rootDir, explicitFiles);
  if (images.length === 0) {
    console.error(`No supported logo images found in ${rootDir}`);
    process.exit(1);
  }

  const existingRows = await readCatalog(outputCatalog);
  const existingFiles = new Set(
    existingRows
      .map((entry) => (typeof entry.file === "string" ? path.basename(entry.file) : ""))
      .filter(Boolean)
  );

  const todo = onlyMissing
    ? images.filter((item) => !existingFiles.has(path.basename(item)))
    : images;

  if (onlyMissing && todo.length === 0) {
    console.log(`No untagged files found in ${rootDir}; catalog already up to date.`);
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set");
    process.exit(1);
  }

  const rows = [];
  const reviewRows = [];

  console.log(`Tagging ${todo.length} images with vision from ${rootDir}`);

  for (let idx = 0; idx < todo.length; idx += 1) {
    const imagePath = todo[idx];
    const fileName = path.basename(imagePath);
    const ext = path.extname(imagePath).toLowerCase();

    if (!supportedExt.has(ext) || fileName.startsWith("arena-sync-manifest") || fileName.endsWith(".jsonl") || fileName.endsWith(".md")) {
      continue;
    }

    if (fileName.startsWith("arena-sync-manifest") || /manifest\d*\.json$/i.test(fileName)) {
      continue;
    }

    const imageInfo = getImageInfo(imagePath);
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString("base64");

    const vision = await callVision(imagePath, imageBase64);

    const tagsSet = new Set(baseTags);
    for (const t of vision.tags) {
      tagsSet.add(t);
    }

    if (imageInfo.hasAlpha) {
      tagsSet.add("transparent-bg");
    }

    const tags = [...tagsSet].sort();

    const row = {
      file: fileName,
      tags,
      notes: vision.notes || "vision-ok",
      metadata: {
        width: imageInfo.width,
        height: imageInfo.height,
        hasAlpha: imageInfo.hasAlpha,
        visionConfidence: vision.confidence,
        visionUncertain: Boolean(vision.uncertain),
        source: "vision-classification",
      },
    };

    rows.push(row);

    if (vision.confidence < REVIEW_THRESHOLD || vision.uncertain || tags.includes("needs-review")) {
      reviewRows.push({
        file: fileName,
        tags,
        confidence: vision.confidence,
        notes: vision.notes,
        raw: vision.raw,
      });
    }

    console.log(`[${idx + 1}/${todo.length}] ${fileName}`);
    await sleep(300);
  }

  const mergedRows = onlyMissing ? [...existingRows, ...rows] : rows;

  const lineOutput = mergedRows
    .map((row) => JSON.stringify(row))
    .join("\n");

  await fs.mkdir(path.dirname(outputCatalog), { recursive: true });
  await fs.writeFile(outputCatalog, `${lineOutput}\n`, "utf8");

  const reviewContent = [
    "# Logo Tag Review",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Model: ${MODEL}`,
    `Review threshold: ${REVIEW_THRESHOLD}`,
    "",
    "Files needing manual checks:",
    "",
    ...reviewRows.map((entry) =>
      `- ${entry.file} :: conf=${entry.confidence.toFixed(2)} :: ${entry.tags.join(", ")} :: ${entry.notes || ""}`
    ),
    "",
  ].join("\n");

  await fs.mkdir(path.dirname(outputReview), { recursive: true });
  await fs.writeFile(outputReview, reviewContent, "utf8");

  console.log(`Wrote catalog: ${outputCatalog}`);
  console.log(`Wrote review: ${outputReview}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
