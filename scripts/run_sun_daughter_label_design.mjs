#!/usr/bin/env node

import { promises as fs } from "node:fs";
import { readFile, writeFile, stat, mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const WORKSPACE_ROOT = path.resolve("/Users/calbotsman/clawd");
const DEFAULT_BOTTLE_REFERENCE_PRIMARY = path.join(
  WORKSPACE_ROOT,
  "output",
  "supplement-design",
  "pill-gemini-reference",
  "pill-matte-reference-gemini.png"
);
const DEFAULT_BOTTLE_REFERENCE_FALLBACK = path.join(
  WORKSPACE_ROOT,
  "data",
  "bottles",
  "pill-matte-reference-guide.png"
);
const DEFAULT_BOTTLE_WRAP_PROFILE = {
  left: 0.315,
  top: 0.345,
  width: 0.405,
  maxHeight: 0.62,
  aspect: 1.7,
  perspective: 0.12,
  perspectivePower: 1.9,
  bulge: 0.028,
  warpAmp: 0.014,
  shadow: 0.22,
  highlight: 0.14,
  stripCount: 168,
  frontOnly: true,
  frontOffset: 0.5,
  frontWidth: 0.98,
  sourceFromReference: false,
};

const DEFAULT_BOTTLE_IMAGE_PROMPT =
  "Photoreal matte white supplement bottle with brushed-gold cap, strict orthographic front elevation, telephoto compression look, zero yaw, zero roll, perfectly centered, no visible side faces, no perspective distortion, front plane dominant, plain neutral studio background, no label, no text, no logo, no watermark.";

const DEFAULT_GEMINI_SCENE_DESCRIPTION =
  "Dead-center studio hero shot. Bottle faces camera perfectly front-on with zero side-panel visibility. Front label area centered and fully readable.";

const DEFAULT_GEMINI_ZERO_SIDE_PROMPT = [
  "CRITICAL LABEL PRESERVATION:",
  "- Preserve label reference exactly (text/layout/colors/logo).",
  "",
  "BOTTLE/CAMERA LOCK:",
  "- Keep bottle in strict orthographic front view.",
  "- Zero yaw and no side faces visible.",
  "- Front panel centered and flat to camera.",
  "",
  "LABEL VISIBILITY:",
  "- Show only front panel print.",
  "- Side areas must remain blank (no side text).",
  "",
  "PHYSICAL:",
  "- Realistic lighting and shadows.",
  "- No cutout/sticker artifacts.",
  "",
  "TASK:",
  "- Apply image 1 label to image 2 bottle.",
  "- Product hero realism, front-panel legibility.",
  "",
  "NEGATIVE:",
  "- no 3/4 angle",
  "- no side-panel copy",
  "- no rewritten text",
  "- no watermark",
  "",
  "SCENE DESCRIPTION: Strict front orthographic studio bottle shot; centered frontal label only.",
  "Output 1:1 aspect ratio.",
].join("\n");

function usage() {
  console.log(`Usage:
  node scripts/run_sun_daughter_label_design.mjs [options]

Options:
  --concept <path>        Concept JSON path (default: /Users/calbotsman/clawd/temp-sundaughter-concept.json)
  --out-dir <path>        Optional supplement output directory
  --logo-source <path>    Explicit logo path (png/svg; bypasses latest style discovery)
  --logo-index <n>        Style logo index to use (default: 1)
  --style-root <path>     Style logo collection root
                          (default: /Users/calbotsman/clawd/output/logo/style/sun-daughter)
  --logo-max-width <n>    brandLogo.maxWidthPx (optional)
  --logo-max-height <n>   brandLogo.maxHeightPx (optional)
  --logo-fit <contain|cover|fill|scale-down|none>  brandLogo.fit (default: contain)
  --help                  Show this help
`);
}

function parseArgs(argv) {
  const args = {
    concept: "/Users/calbotsman/clawd/temp-sundaughter-concept.json",
    styleRoot: "/Users/calbotsman/clawd/output/logo/style/sun-daughter",
    logoIndex: 1,
    logoFit: "contain",
    outDir: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--concept") {
      args.concept = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--out-dir") {
      args.outDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--logo-source") {
      args.logoSource = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--logo-index") {
      const value = Number.parseInt(argv[i + 1], 10);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error("--logo-index must be a positive integer");
      }
      args.logoIndex = value;
      i += 1;
      continue;
    }
    if (arg === "--style-root") {
      args.styleRoot = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--logo-max-width") {
      const value = Number.parseInt(argv[i + 1], 10);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error("--logo-max-width must be a positive integer");
      }
      args.logoMaxWidth = value;
      i += 1;
      continue;
    }
    if (arg === "--logo-max-height") {
      const value = Number.parseInt(argv[i + 1], 10);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error("--logo-max-height must be a positive integer");
      }
      args.logoMaxHeight = value;
      i += 1;
      continue;
    }
    if (arg === "--logo-fit") {
      const value = String(argv[i + 1]);
      if (!["contain", "cover", "fill", "scale-down", "none"].includes(value)) {
        throw new Error("--logo-fit must be one of contain|cover|fill|scale-down|none");
      }
      args.logoFit = value;
      i += 1;
      continue;
    }
  }

  return args;
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectManifests(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      if ((error && error.code) === "ENOENT") {
        return out;
      }
      throw error;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name === "manifest.json") {
        out.push(full);
      }
    }
  }
  return out;
}

function formatStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(
    2,
    "0"
  )}${String(now.getSeconds()).padStart(2, "0")}`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function applySunDaughterBottleWrapDefaults(concept) {
  concept.render = {
    ...(concept.render || {}),
  };
  concept.boardTemplateMode = "cyborg";
  concept.render.boardTemplateMode = "cyborg";

  concept.render.bottleImageEngine = "gemini";
  concept.render.productMockEngine = "gemini-labeled-composition";
  if (!concept.render.recraftStyle) {
    concept.render.recraftStyle = "natural";
  }
  if (!concept.render.bottleImagePrompt) {
    concept.render.bottleImagePrompt = DEFAULT_BOTTLE_IMAGE_PROMPT;
  }
  if (!concept.render.geminiSceneDescription) {
    concept.render.geminiSceneDescription = DEFAULT_GEMINI_SCENE_DESCRIPTION;
  }
  if (!concept.render.geminiAdvancedCompositionPrompt) {
    concept.render.geminiAdvancedCompositionPrompt = DEFAULT_GEMINI_ZERO_SIDE_PROMPT;
  }

  const existingWrap = concept.render.bottleMockup || {};
  concept.render.bottleMockup = {
    ...DEFAULT_BOTTLE_WRAP_PROFILE,
    ...existingWrap,
    sourceFromReference:
      typeof existingWrap.sourceFromReference === "boolean"
        ? existingWrap.sourceFromReference
        : false,
  };
}

async function findLatestStyleManifest(styleRoot) {
  const manifests = await collectManifests(styleRoot);
  if (manifests.length === 0) {
    throw new Error(`No manifests found in ${styleRoot}`);
  }

  const withStat = [];
  for (const manifest of manifests) {
    const s = await fs.stat(manifest);
    const dataText = await readFile(manifest, "utf8").catch(() => "");
    let parsed = null;
    if (dataText) {
      try {
        parsed = JSON.parse(dataText);
      } catch {
        parsed = null;
      }
    }
    withStat.push({
      path: manifest,
      statMtime: s.mtimeMs,
      manifest: parsed,
    });
  }

  withStat.sort((a, b) => b.statMtime - a.statMtime);

  const styleManifest = withStat.find((entry) =>
    String(entry.manifest?.generator || "").includes("logo-style-influenced-deterministic")
  );
  if (styleManifest) {
    return styleManifest.path;
  }

  return withStat[0]?.path || "";
}

async function resolveLogoPath(manifestPath, manifest, logoIndex) {
  const outputDir = manifest?.outputDir
    ? path.resolve(manifest.outputDir)
    : path.dirname(manifestPath);
  const stem = `logo-${String(logoIndex).padStart(2, "0")}`;
  const outputs = Array.isArray(manifest?.outputs) ? manifest.outputs : [];

  const exactOutput = outputs.find((item) => (typeof item?.svg === "string" && item.svg.includes(stem)) || (typeof item?.png === "string" && item.png.includes(stem)));
  if (exactOutput?.svg && (await fileExists(exactOutput.svg))) {
    return exactOutput.svg;
  }
  if (exactOutput?.png && (await fileExists(exactOutput.png))) {
    return exactOutput.png;
  }

  const outputsByIndex = outputs.find((item) => Number(item?.index) === logoIndex - 1);
  if (outputsByIndex?.svg && (await fileExists(outputsByIndex.svg))) {
    return outputsByIndex.svg;
  }
  if (outputsByIndex?.png && (await fileExists(outputsByIndex.png))) {
    return outputsByIndex.png;
  }

  const exactPreview = path.join(outputDir, "previews", `${stem}.png`);
  if (await fileExists(exactPreview)) {
    return exactPreview;
  }

  const exactRoot = path.join(outputDir, `${stem}.png`);
  if (await fileExists(exactRoot)) {
    return exactRoot;
  }

  const exactRootSvg = path.join(outputDir, `${stem}.svg`);
  if (await fileExists(exactRootSvg)) {
    return exactRootSvg;
  }

  return "";
}

function isLikelyWorkflowSummary(filePath) {
  return path.basename(filePath) === "workflow-summary.json";
}

async function findLatestWorkflowSummary(rootDir, conceptSlug, startTimeMs) {
  const candidateDir = path.join(rootDir, conceptSlug || "");
  const searchRoots = [];
  try {
    await stat(candidateDir);
    searchRoots.push(candidateDir);
  } catch {
    searchRoots.push(rootDir);
  }

  let latest = {
    path: "",
    mtimeMs: 0,
  };

  const stack = [...searchRoots];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!isLikelyWorkflowSummary(entry.name)) {
        continue;
      }

      const summaryStat = await fs.stat(full).catch(() => null);
      if (!summaryStat) {
        continue;
      }

      if (summaryStat.mtimeMs < startTimeMs) {
        continue;
      }
      if (summaryStat.mtimeMs > latest.mtimeMs) {
        latest = { path: full, mtimeMs: summaryStat.mtimeMs };
      }
    }
  }

  if (!latest.path) {
    return "";
  }
  return latest.path;
}

async function copyLogoIntoRunFolder(logoSource, runDir, preferredExt) {
  const normalizedExt = preferredExt === ".svg" ? ".svg" : ".png";
  const targetName = `brand-logo${normalizedExt}`;
  const targetPath = path.join(runDir, targetName);
  await copyFile(logoSource, targetPath);
  return targetPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const conceptPath = path.resolve(args.concept);
  const conceptDir = path.dirname(conceptPath);
  const styleRoot = path.resolve(args.styleRoot);
  const logoIndex = args.logoIndex;

  if (!(await fileExists(conceptPath))) {
    throw new Error(`Concept file not found: ${conceptPath}`);
  }
  if (!path.isAbsolute(styleRoot)) {
    throw new Error(`--style-root must be an absolute path: ${styleRoot}`);
  }

  const rawConcept = JSON.parse(await readFile(conceptPath, "utf8"));
  const concept = { ...rawConcept };
  applySunDaughterBottleWrapDefaults(concept);

  const configuredBottleReference = String(concept.render?.bottleReferenceImage || "");
  if (!configuredBottleReference || !(await fileExists(configuredBottleReference))) {
    const primaryExists = await fileExists(DEFAULT_BOTTLE_REFERENCE_PRIMARY);
    concept.render.bottleReferenceImage = primaryExists
      ? DEFAULT_BOTTLE_REFERENCE_PRIMARY
      : DEFAULT_BOTTLE_REFERENCE_FALLBACK;
  }

  const generationStartTime = Date.now();
  const outRoot = args.outDir ? path.resolve(args.outDir) : path.join(process.cwd(), "output", "supplement-design");

  let logoSource = args.logoSource ? path.resolve(args.logoSource) : "";
  if (!logoSource) {
    const preferredLogo = String(concept.brandLogo?.source || "").trim();
    if (preferredLogo) {
      const preferredLogoPath = path.isAbsolute(preferredLogo)
        ? preferredLogo
        : path.resolve(conceptDir, preferredLogo);
      if (await fileExists(preferredLogoPath)) {
        logoSource = preferredLogoPath;
      }
    }
  }
  if (!logoSource) {
    const manifestPath = await findLatestStyleManifest(styleRoot);
    if (!manifestPath) {
      throw new Error(`No style manifest found in ${styleRoot}`);
    }
    const manifestText = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(manifestText);
    logoSource = await resolveLogoPath(manifestPath, manifest, logoIndex);
    if (!logoSource || !(await fileExists(logoSource))) {
      throw new Error(`Could not resolve logo source from ${manifestPath}`);
    }
  }

  if (!logoSource) {
    throw new Error("No logo source found");
  }

  const resolvedLogoSource = path.isAbsolute(logoSource) ? logoSource : path.resolve(process.cwd(), logoSource);
  if (!(await fileExists(resolvedLogoSource))) {
    throw new Error(`Logo source missing: ${resolvedLogoSource}`);
  }

  concept.brandLogo = {
    ...(concept.brandLogo || {}),
    source: resolvedLogoSource,
    alt: concept.brandLogo?.alt || concept.brandName || "Sun Daughter",
    fit: args.logoFit || concept.brandLogo?.fit || "contain",
  };
  if (args.logoMaxWidth) concept.brandLogo.maxWidthPx = args.logoMaxWidth;
  if (args.logoMaxHeight) concept.brandLogo.maxHeightPx = args.logoMaxHeight;

  const conceptOutDir = path.join(process.cwd(), "output", "supplement-design", `_generated-${formatStamp()}`);
  await mkdir(conceptOutDir, { recursive: true });
  const logoConceptPath = path.join(conceptOutDir, "sundaughter-concept.with-logo.json");
  await writeFile(logoConceptPath, `${JSON.stringify(concept, null, 2)}\n`, "utf8");

  const command = [path.join(WORKSPACE_ROOT, "studio/tools/generate_supplement_design_set_recraft_v4.mjs"), "--config", logoConceptPath];
  if (args.outDir) {
    command.push("--out-dir", args.outDir);
  }

  const generate = spawnSync("node", command, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
  });

  if (generate.status !== 0) {
    throw new Error(`Supplement generation failed: status=${generate.status}`);
  }

  const conceptSlug = slugify(concept.conceptId || "sun-daughter");
  const workflowSummary = await findLatestWorkflowSummary(outRoot, conceptSlug, generationStartTime - 5_000);
  if (!workflowSummary) {
    throw new Error("Could not find workflow-summary.json for the generated supplement run");
  }
  const summary = JSON.parse(await readFile(workflowSummary, "utf8"));
  const runDir = summary.runDir ? path.resolve(summary.runDir) : path.dirname(workflowSummary);

  const canonicalRunLink = path.join(outRoot, "run");
  try {
    await fs.rm(canonicalRunLink, { force: true });
  } catch {
    // keep run-link deterministic; remove stale target if present
  }
  try {
    await fs.symlink(path.relative(path.dirname(canonicalRunLink), runDir), canonicalRunLink);
  } catch {
    // best-effort; sender can still discover run by direct path
  }

  const logoExt = path.extname(resolvedLogoSource).toLowerCase();
  const copiedLogo = await copyLogoIntoRunFolder(resolvedLogoSource, runDir, logoExt);
  const conceptSnapshotPath = path.join(runDir, "concept.input.json");
  const runConceptText = await readFile(conceptSnapshotPath, "utf8").catch(() => "{}");
  const runConcept = JSON.parse(runConceptText || "{}");
  runConcept.brandLogo = {
    ...(runConcept.brandLogo || {}),
    source: path.basename(copiedLogo),
  };
  await writeFile(conceptSnapshotPath, `${JSON.stringify(runConcept, null, 2)}\n`, "utf8");
  const manifestPath = path.join(runDir, "manifest.json");
  const validator = spawnSync(process.execPath, [path.join(WORKSPACE_ROOT, "scripts/validate_supplement_design.mjs"), "--manifest", manifestPath, "--strict"], {
    encoding: "utf8",
    stdio: "inherit",
  });
  if (validator.status !== 0) {
    throw new Error(`Cyborg quality gate failed for ${runDir}`);
  }

  const boardPngPath = path.join(runDir, "brand-board.png");
  const labelPngPath = path.join(runDir, "label.png");

  console.log("Execution order (deterministic, tactical):");
  console.log(`1) logo source selected: ${resolvedLogoSource}`);
  console.log(`2) brand board: ${boardPngPath}`);
  console.log(`3) label: ${labelPngPath}`);
  console.log(`- concept with logo: ${logoConceptPath}`);
  console.log(`- brandLogo.source: ${resolvedLogoSource}`);
  console.log(`- logo copied to run folder: ${copiedLogo}`);
  console.log(`- run dir: ${runDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
