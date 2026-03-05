#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const options = new Map();
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (!arg.startsWith("--")) {
    continue;
  }
  const key = arg.slice(2);
  const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "";
  options.set(key, value);
  if (value) {
    i += 1;
  }
}

const ROOT = process.env.CLAWD_ROOT || "/Users/calbotsman/clawd";
const DEFAULT_CATALOG = `${ROOT}/data/logo-influences/meta/logo-catalog.jsonl`;
const DEFAULT_SUMMARY_MARKDOWN = `${ROOT}/studio/PIPELINE/creative-loop/ARTIFACTS/signals/logo-influence-tag-packet.md`;
const DEFAULT_SUMMARY_JSON = `${ROOT}/studio/PIPELINE/creative-loop/ARTIFACTS/signals/logo-influence-tag-packet.json`;

const catalogPath = options.get("catalog") || DEFAULT_CATALOG;
const markdownPath = options.get("markdown") || DEFAULT_SUMMARY_MARKDOWN;
const jsonPath = options.get("json") || DEFAULT_SUMMARY_JSON;
const maxExamples = Number.parseInt(options.get("max-examples") || "6", 10);
const topTagsLimit = Number.parseInt(options.get("top-tags") || "12", 10);

function normalizeTag(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function readCatalog(rawLines) {
  return rawLines
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
    .filter(Boolean);
}

function pickExamplesByTag(tag, tagMap, cap = maxExamples) {
  return tagMap.get(tag)?.examples?.slice(0, cap) || [];
}

function ratio(value, total) {
  if (!total) {
    return 0;
  }
  return Number((value / total).toFixed(3));
}

function scoreTags(tagStats) {
  return [...tagStats.entries()]
    .filter(([tag, entry]) => entry.count > 0)
    .map(([tag, entry]) => ({
      tag,
      count: entry.count,
      examples: entry.examples,
      confidenceAvg: Number((entry.totalConfidence / Math.max(entry.count, 1)).toFixed(3)),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.confidenceAvg - a.confidenceAvg;
    });
}

async function main() {
  const rawCatalog = await fs.readFile(catalogPath, "utf8");
  const entries = readCatalog(rawCatalog);

  if (!entries.length) {
    throw new Error(`No records found in catalog: ${catalogPath}`);
  }

  const baseTags = new Set(["sun-daughter", "logo-influence"]);
  const tagStats = new Map();
  const reviewRows = [];

  for (const entry of entries) {
    const tags = Array.isArray(entry.tags) ? entry.tags.map(normalizeTag).filter(Boolean) : [];
    const confidence = Number(entry?.metadata?.visionConfidence);

    for (const tag of tags) {
      if (!tagStats.has(tag)) {
        tagStats.set(tag, { count: 0, examples: [], totalConfidence: 0, lowConfidence: 0 });
      }
      const item = tagStats.get(tag);
      item.count += 1;
      item.totalConfidence += Number.isFinite(confidence) ? confidence : 0;
      if (item.examples.length < maxExamples && entry.file) {
        item.examples.push(entry.file);
      }
      if (Number.isFinite(confidence) && confidence < 0.7) {
        item.lowConfidence += 1;
      }
    }

    if (!Number.isFinite(Number(confidence)) || confidence < 0.78 || tags.includes("needs-review")) {
      reviewRows.push(entry.file || "(unknown)");
    }
  }

  const scored = scoreTags(tagStats).filter((entry) => !baseTags.has(entry.tag));
  const total = entries.length;
  const totalNeedsReview = new Set(reviewRows).size;
  const topTags = scored.slice(0, topTagsLimit).map((entry) => ({
    tag: entry.tag,
    count: entry.count,
    ratio: ratio(entry.count, total),
    examples: entry.examples,
    confidenceAvg: entry.confidenceAvg,
    lowConfidenceCount: tagStats.get(entry.tag)?.lowConfidence || 0,
  }));

  const tagsByRatio = new Map(topTags.map((entry) => [entry.tag, entry.ratio]));

  const recommendations = [];
  const geometricRatio = tagsByRatio.get("geometric") || 0;
  const serifRatio = tagsByRatio.get("serif") || 0;
  const handDrawnRatio = tagsByRatio.get("hand-drawn") || 0;
  const typographicRatio = tagsByRatio.get("typographic") || 0;
  const iconOnlyRatio = tagsByRatio.get("icon-only") || 0;

  if (geometricRatio >= 0.35) {
    recommendations.push("Priority cue: geometric language appears dominant. Anchor concept development in modular geometric geometry and clean contour systems.");
  }
  if (typographicRatio >= 0.25 && typographicRatio > iconOnlyRatio) {
    recommendations.push("Typographic direction is strongly present. Keep wordmark readability and letter-shape hierarchy in first-pass concepts.");
  }
  if (iconOnlyRatio >= 0.35) {
    recommendations.push("Strong icon-only set signal. Keep mark clarity primary and use optional text lock-up as secondary state, not default.");
  }
  if (serifRatio >= 0.15) {
    recommendations.push("Serif family signal is present; allocate a serif treatment lane for alternate direction variants.");
  }
  if (handDrawnRatio >= 0.10) {
    recommendations.push("Small hand-drawn signal exists; if needed, test a separate exploration lane, but prevent full bleed drift.");
  }
  if (recommendations.length === 0) {
    recommendations.push("No single high-momentum signal exceeds threshold; run a balanced batch across geometric, typographic, and mark-first variants.");
  }

  const markdown = [
    "# Logo Influence Signal Packet",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Catalog: ${path.resolve(catalogPath)}`,
    `Total references: ${total}`,
    `Low-confidence refs: ${totalNeedsReview}`,
    "",
    "## Top Tags",
    ...topTags.map((entry) => `- ${entry.tag}: ${entry.count} (${(entry.ratio * 100).toFixed(1)}%)`),
    "",
    "## Evidence (Top examples per tag)",
    ...topTags.map((entry) => `- ${entry.tag}: ${entry.examples.slice(0, 4).join(", ") || "(no examples)"}`),
    "",
    "## Suggested direction constraints",
    ...recommendations.map((line) => `- ${line}`),
    "",
    "## Low-confidence review list",
    ...reviewRows.slice(0, 20).map((name) => `- ${name}`),
    "",
  ].join("\n");

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceCatalog: path.resolve(catalogPath),
    totalRefs: total,
    lowConfidenceRefs: totalNeedsReview,
    topTags,
    recommendations,
  };

  await fs.mkdir(path.dirname(markdownPath), { recursive: true });
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.writeFile(markdownPath, `${markdown}\n`, "utf8");
  await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`Wrote signal packet: ${markdownPath}`);
  console.log(`Wrote signal JSON: ${jsonPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
