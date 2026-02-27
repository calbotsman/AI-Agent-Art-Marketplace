#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RULES = {
  labelWidthPx: 1650,
  labelHeightPx: 600,
  maxIngredientRows: 8,
  minContrastBody: 4.5,
  minContrastHeadline: 3,
  maxSvgDrawingNodes: 200,
  requireRecraftV4: true,
  minOverallScoreStrict: 88,
};

const SCORING = {
  schemaVersion: "1.1",
  categories: {
    rails: { weight: 0.3, base: 100, penalty: 12 },
    typography: { weight: 0.26, base: 100, penalty: 10 },
    contrast: { weight: 0.22, base: 100, penalty: 12 },
    copy: { weight: 0.12, base: 100, penalty: 8 },
    assets: { weight: 0.1, base: 100, penalty: 8 },
  },
};

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPOGRAPHY_TOKENS_PATH = path.join(
  WORKSPACE_ROOT,
  "studio",
  "PIPELINE",
  "design-system",
  "typography-tokens.json"
);
const LAYOUT_TOKENS_PATH = path.join(
  WORKSPACE_ROOT,
  "studio",
  "PIPELINE",
  "design-system",
  "layout-tokens.json"
);

const DEFAULT_TYPOGRAPHY_RULES = {
  minFontSizePx: 8,
  maxFontFamilies: 2,
  bodyLineLengthMinChars: 28,
  bodyLineLengthMaxChars: 58,
  minHierarchyStepRatio: 1.15,
  minBodyContrastRatio: 4.5,
  minHeadlineContrastRatio: 3.0,
};

const DEFAULT_LAYOUT_RULES = {
  requiredCanvasWidthPx: 1650,
  requiredCanvasHeightPx: 600,
  requiredGridTemplateColumns: "1fr 300px 1fr",
  leftPanelPaddingPx: 32,
  centerPanelTopBottomPaddingPx: 24,
  centerPanelLeftRightPaddingPx: 20,
  rightPanelPaddingPx: 32,
  rightPanelGapPx: 20,
};

function usage() {
  console.log(`Usage:
  node scripts/validate_supplement_design.mjs --manifest <path> [--strict]
`);
}

function parseArgs(argv) {
  const args = {
    strict: false,
    manifestPath: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--manifest" && argv[i + 1]) {
      args.manifestPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--strict") {
      args.strict = true;
      continue;
    }
  }

  if (!args.manifestPath) {
    throw new Error("Missing --manifest path");
  }
  return args;
}

function createScoringState() {
  const categories = {};
  for (const [category, config] of Object.entries(SCORING.categories)) {
    categories[category] = {
      weight: config.weight,
      score: config.base,
      rawScore: config.base,
      violations: [],
      pass: true,
      penalty: config.penalty,
    };
  }

  return {
    schemaVersion: SCORING.schemaVersion,
    categories,
    overall: 100,
    details: {},
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function scoreByCategory(report, category, message, penaltyOverride, isBlocking = true) {
  const bucket = report.scoring?.categories?.[category];
  if (!bucket) {
    return;
  }

  const penalty = Number.isFinite(penaltyOverride) ? penaltyOverride : bucket.penalty;
  bucket.rawScore = clampScore(bucket.rawScore - penalty);
  bucket.score = bucket.rawScore;
  bucket.pass = false;
  bucket.violations.push(message);
  report.violations.push(`[${category}] ${message}`);
  if (isBlocking) {
    report.pass = false;
  }
}

function evaluateScoring(report) {
  let weightedTotal = 0;
  const categoryScores = {};

  for (const [category, bucket] of Object.entries(report.scoring.categories || {})) {
    const categoryScore = clampScore(bucket.score);
    weightedTotal += categoryScore * bucket.weight;
    categoryScores[category] = {
      score: categoryScore,
      pass: bucket.pass,
      violations: bucket.violations.length,
    };
  }

  report.scoring.overall = clampScore(weightedTotal);
  report.scoring.summary = {
    weightAdjustedScore: report.scoring.overall,
    categoryScores,
    pass: Object.values(categoryScores).every((entry) => entry.pass) && report.pass,
  };
  report.score = report.scoring.overall;
  report.checks.categoryScores = categoryScores;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function addViolation(report, message, penalty = 8, category = "assets", isBlocking = true) {
  if (!report.scoring) {
    report.scoring = createScoringState();
  }
  scoreByCategory(report, category, message, penalty, isBlocking);
}

async function getImagePixelSize(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  if (fileBuffer.length < 24) {
    return null;
  }

  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = fileBuffer.subarray(0, 8);
  if (!header.equals(pngSignature)) {
    return null;
  }

  return {
    width: fileBuffer.readUInt32BE(16),
    height: fileBuffer.readUInt32BE(20),
  };
}

function hexToRgb(hex) {
  const safe = String(hex || "").replace(/#[0-9a-f]{3}$/i, (match) =>
    match.replace(/(.)/g, "$1$1")
  );
  if (!/^#([0-9a-f]{6})$/i.test(safe)) {
    return null;
  }

  const value = Number.parseInt(safe.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function normalizeChannel(channel) {
  const normalized = channel / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }

  return (
    0.2126 * normalizeChannel(rgb.r) +
    0.7152 * normalizeChannel(rgb.g) +
    0.0722 * normalizeChannel(rgb.b)
  );
}

function contrastRatio(a, b) {
  const lumA = luminance(a);
  const lumB = luminance(b);
  if (lumA === null || lumB === null) {
    return null;
  }
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function isSvgVectorSource(filePath) {
  return path.extname(filePath).toLowerCase() === ".svg";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getStyleBlock(css, selector) {
  if (!css) {
    return "";
  }

  const escaped = escapeRegExp(selector);
  const regex = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "i");
  const match = css.match(regex);
  return match ? match[1] : "";
}

function getStyleProperty(block, property) {
  if (!block) {
    return "";
  }
  const regex = new RegExp(`${escapeRegExp(property)}\\s*:\\s*([^;]+);`, "i");
  const match = block.match(regex);
  return match ? match[1].trim() : "";
}

function parsePx(value) {
  const match = typeof value === "string" ? value.match(/(-?\d+(?:\.\d+)?)px/i) : null;
  if (!match) {
    return null;
  }
  return Number.parseFloat(match[1]);
}

function parseCssFontSize(value) {
  if (!value) {
    return null;
  }

  if (/^\d+%$/.test(value.trim())) {
    const percent = Number.parseFloat(value);
    return Number.isFinite(percent) ? percent : null;
  }

  return parsePx(value);
}

function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function isCyborgBrandFlow(concept, manifest) {
  const checksMode = normalizeToken(manifest?.checks?.boardTemplateMode);
  const conceptMode = normalizeToken(concept?.render?.boardTemplateMode || concept?.boardTemplateMode || concept?.board?.templateMode);
  const conceptBrand = normalizeToken(concept?.brandName);
  const conceptId = normalizeToken(concept?.conceptId);

  if (checksMode === "cyborg" || conceptMode === "cyborg") {
    return true;
  }

  return (
    conceptBrand.includes("sun daughter") ||
    conceptBrand.includes("sundaughter") ||
    conceptId.includes("sun daughter") ||
    conceptId.includes("sun-daughter") ||
    conceptId.includes("sundaughter")
  );
}

async function readDesignTokens() {
  let typography = DEFAULT_TYPOGRAPHY_RULES;
  let layout = DEFAULT_LAYOUT_RULES;

  try {
    const rawTypography = await fs.readFile(TYPOGRAPHY_TOKENS_PATH, "utf8");
    const parsed = JSON.parse(rawTypography);
    typography = {
      ...typography,
      minFontSizePx: parsed?.constraints?.minPx ?? typography.minFontSizePx,
      maxFontFamilies: parsed?.constraints?.maxFontFamilies ?? typography.maxFontFamilies,
      bodyLineLengthMinChars: parsed?.constraints?.lineLength?.bodyMinChars ?? typography.bodyLineLengthMinChars,
      bodyLineLengthMaxChars: parsed?.constraints?.lineLength?.bodyMaxChars ?? typography.bodyLineLengthMaxChars,
      minHierarchyStepRatio: parsed?.constraints?.hierarchyMinStepRatio ?? typography.minHierarchyStepRatio,
      minBodyContrastRatio: parsed?.constraints?.contrastRatioMin ?? typography.minBodyContrastRatio,
      minHeadlineContrastRatio: parsed?.constraints?.headlineContrastRatioMin ?? typography.minHeadlineContrastRatio,
    };
  } catch {
    // Fallback to hardcoded defaults when tokens are temporarily unavailable.
  }

  try {
    const rawLayout = await fs.readFile(LAYOUT_TOKENS_PATH, "utf8");
    const parsed = JSON.parse(rawLayout);
    layout = {
      ...layout,
      requiredCanvasWidthPx: parsed?.canvas?.widthPx ?? layout.requiredCanvasWidthPx,
      requiredCanvasHeightPx: parsed?.canvas?.heightPx ?? layout.requiredCanvasHeightPx,
      requiredGridTemplateColumns: Array.isArray(parsed?.grid?.templateColumns)
        ? parsed.grid.templateColumns.join(" ")
        : layout.requiredGridTemplateColumns,
      leftPanelPaddingPx: parsed?.panels?.left?.paddingPx?.top ?? layout.leftPanelPaddingPx,
      centerPanelTopBottomPaddingPx: parsed?.panels?.center?.paddingPx?.top ?? layout.centerPanelTopBottomPaddingPx,
      centerPanelLeftRightPaddingPx: parsed?.panels?.center?.paddingPx?.left ?? layout.centerPanelLeftRightPaddingPx,
      rightPanelPaddingPx: parsed?.panels?.right?.paddingPx?.top ?? layout.rightPanelPaddingPx,
      rightPanelGapPx: parsed?.panels?.right?.stackGapPx ?? layout.rightPanelGapPx,
    };
  } catch {
    // Fallback to hardcoded defaults when tokens are temporarily unavailable.
  }

  return { typography, layout };
}

async function countSvgDrawingNodes(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const nodeMatches = raw.match(/<\s*(?:path|line|circle|ellipse|polygon|polyline|rect|text|g)\b/gi);
  return nodeMatches ? nodeMatches.length : 0;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function splitFonts(fontsValue) {
  if (!fontsValue || typeof fontsValue !== "string") {
    return [];
  }
  return fontsValue
    .split(",")
    .map((value) => value.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function estimateLineLengthFromPixelBudget(availablePx, fontSizePx) {
  if (!availablePx || !fontSizePx) {
    return 0;
  }

  const approximateCharWidthPx = fontSizePx * 0.52;
  return Math.max(1, Math.floor(availablePx / approximateCharWidthPx));
}

async function validateCyborgRules(report, concept, manifest, runDir, typographyRules, layoutRules) {
  const labelHtmlPath = path.join(runDir, "label.html");
  const labelPngPath = manifest.outputs?.label?.png || "";

  if (!(await fileExists(labelHtmlPath))) {
    addViolation(report, "missing label.html for structural rule checks", 16, "rails");
    return;
  }

  const labelHtml = await fs.readFile(labelHtmlPath, "utf8");

  const labelCssMatch = labelHtml.match(/<style>([\s\S]*?)<\/style>/i);
  const labelCss = labelCssMatch ? labelCssMatch[1] : "";
  if (!labelCss) {
    addViolation(report, "unable to parse label.css from label.html", 14, "rails");
  }

  const containerBlock = getStyleBlock(labelCss, ".label-container");
  const leftPanelBlock = getStyleBlock(labelCss, ".left-panel");
  const centerPanelBlock = getStyleBlock(labelCss, ".center-panel");
  const rightPanelBlock = getStyleBlock(labelCss, ".right-panel");
  const productNameBlock = getStyleBlock(labelCss, ".product-name");
  const productDescriptionBlock = getStyleBlock(labelCss, ".product-description");
  const sectionTitleBlock = getStyleBlock(labelCss, ".section-title");
  const suggestedUseBlock = getStyleBlock(labelCss, ".suggested-use");
  const warningsBlock = getStyleBlock(labelCss, ".warnings");
  const brandLogoBlock = getStyleBlock(labelCss, ".brand-logo");
  const brandLogoWithImageBlock = getStyleBlock(labelCss, ".brand-logo-with-image");
  const brandLogoImageBlock = getStyleBlock(labelCss, ".brand-logo-image");
  const factsHeaderBlock = getStyleBlock(labelCss, ".facts-header");
  const servingSizeInfoBlock = getStyleBlock(labelCss, ".serving-size-info");
  const factsTableBlock = getStyleBlock(labelCss, ".facts-table");
  const factsFooterBlock = getStyleBlock(labelCss, ".facts-footer");
  const footerInfoBlock = getStyleBlock(labelCss, ".footer-info");
  const servingInfoBlock = getStyleBlock(labelCss, ".serving-info");
  const servingCountBlock = getStyleBlock(labelCss, ".serving-count");
  const needsLogoImage = Boolean(concept?.brandLogo?.source && String(concept.brandLogo.source).trim());

  const requiredClassBlocks = [
    ["label-container", containerBlock],
    ["left-panel", leftPanelBlock],
    ["center-panel", centerPanelBlock],
    ["right-panel", rightPanelBlock],
    ["product-name", productNameBlock],
    ["product-description", productDescriptionBlock],
    ["section-title", sectionTitleBlock],
    ["suggested-use", suggestedUseBlock],
    ["warnings", warningsBlock],
    ["serving-size-info", servingSizeInfoBlock],
    ["facts-table", factsTableBlock],
    ["facts-footer", factsFooterBlock],
    ["footer-info", footerInfoBlock],
    ["brand-logo", brandLogoBlock],
    ["facts-header", factsHeaderBlock],
    ["serving-info", servingInfoBlock],
    ["serving-count", servingCountBlock],
  ];
  if (needsLogoImage) {
    requiredClassBlocks.push(["brand-logo-with-image", brandLogoWithImageBlock]);
    requiredClassBlocks.push(["brand-logo-image", brandLogoImageBlock]);
  }
  for (const [selector, block] of requiredClassBlocks) {
    if (!block) {
      addViolation(
        report,
        `missing required style block .${selector} in label.css`,
        10,
        "rails"
      );
    }
    if (!new RegExp(`<[^>]+class=[\"'][^\"']*\\b${selector}\\b[^\"']*[\"']`, "i").test(labelHtml)) {
      addViolation(
        report,
        `missing required HTML node class .${selector}`,
        10,
        "rails"
      );
    }
  }

  const containerWidth = parsePx(getStyleProperty(containerBlock, "width"));
  const containerHeight = parsePx(getStyleProperty(containerBlock, "height"));
  const gridTemplateColumns = getStyleProperty(containerBlock, "grid-template-columns");
  const containerBorder = getStyleProperty(containerBlock, "border");
  const containerOverflow = getStyleProperty(containerBlock, "overflow");
  const containerGap = parsePx(getStyleProperty(containerBlock, "gap"));

  const leftPanelPadding = getStyleProperty(leftPanelBlock, "padding");
  const centerPanelPadding = getStyleProperty(centerPanelBlock, "padding");
  const rightPanelPadding = getStyleProperty(rightPanelBlock, "padding");
  const rightPanelGap = parsePx(getStyleProperty(rightPanelBlock, "gap"));
  const leftPanelDivider = getStyleProperty(leftPanelBlock, "border-right");
  const centerPanelDivider = getStyleProperty(centerPanelBlock, "border-right");
  const containerDisplay = getStyleProperty(containerBlock, "display");
  const leftPanelDisplay = getStyleProperty(leftPanelBlock, "display");
  const centerPanelDisplay = getStyleProperty(centerPanelBlock, "display");
  const rightPanelDisplay = getStyleProperty(rightPanelBlock, "display");
  const servingInfoBorderTop = getStyleProperty(servingInfoBlock, "border-top");
  const servingInfoPaddingTop = getStyleProperty(servingInfoBlock, "padding-top");
  const servingSizeInfoBorderBottom = getStyleProperty(servingSizeInfoBlock, "border-bottom");
  const servingSizeInfoPaddingBottom = getStyleProperty(servingSizeInfoBlock, "padding-bottom");
  const servingCountTransform = getStyleProperty(servingCountBlock, "text-transform");
  const servingCountWeight = getStyleProperty(servingCountBlock, "font-weight");
  const servingCountLetterSpacing = getStyleProperty(servingCountBlock, "letter-spacing");
  const factsHeaderBorderBottom = getStyleProperty(factsHeaderBlock, "border-bottom");
  const servingSizeInfoFontWeight = getStyleProperty(servingSizeInfoBlock, "font-weight");
  const factsTableFontSize = parseCssFontSize(getStyleProperty(factsTableBlock, "font-size"));
  const footerInfoFontSize = parseCssFontSize(getStyleProperty(footerInfoBlock, "font-size"));
  const factsFooterFontSize = parseCssFontSize(getStyleProperty(factsFooterBlock, "font-size"));

  const productNameSize = parseCssFontSize(getStyleProperty(productNameBlock, "font-size"));
  const productDescriptionSize = parseCssFontSize(getStyleProperty(productDescriptionBlock, "font-size"));
  const sectionTitleSize = parseCssFontSize(getStyleProperty(sectionTitleBlock, "font-size"));
  const suggestedUseSize = parseCssFontSize(getStyleProperty(suggestedUseBlock, "font-size"));
  const warningsSize = parseCssFontSize(getStyleProperty(warningsBlock, "font-size"));

  if (containerWidth !== layoutRules.requiredCanvasWidthPx) {
    addViolation(
      report,
      `label style width ${containerWidth} != ${layoutRules.requiredCanvasWidthPx}`,
      20,
      "rails"
    );
  }
  if (containerHeight !== layoutRules.requiredCanvasHeightPx) {
    addViolation(
      report,
      `label style height ${containerHeight} != ${layoutRules.requiredCanvasHeightPx}`,
      20,
      "rails"
    );
  }
  if (gridTemplateColumns !== layoutRules.requiredGridTemplateColumns) {
    addViolation(
      report,
      `label style grid-template-columns "${gridTemplateColumns}" != "${layoutRules.requiredGridTemplateColumns}"`,
      18,
      "rails"
    );
  }
  if (!containerBorder.includes("3px")) {
    addViolation(report, "label outer border must include 3px", 14, "rails");
  }
  if (!containerDisplay || containerDisplay.toLowerCase() !== "grid") {
    addViolation(
      report,
      `label-container display should be grid (got: ${containerDisplay || "missing"})`,
      12,
      "rails"
    );
  }
  if (containerGap !== null && containerGap !== 0) {
    addViolation(
      report,
      `label-container gap should be 0 (got: ${containerGap})`,
      10,
      "rails"
    );
  }
  if (containerOverflow && !containerOverflow.toLowerCase().includes("hidden")) {
    addViolation(
      report,
      `label-container overflow should include hidden (got: ${containerOverflow})`,
      8,
      "rails"
    );
  }
  if (leftPanelDivider && !leftPanelDivider.includes("2px")) {
    addViolation(
      report,
      `left-panel border-right should be 2px divider (got: ${leftPanelDivider})`,
      10,
      "rails"
    );
  }
  if (centerPanelDivider && !centerPanelDivider.includes("2px")) {
    addViolation(
      report,
      `center-panel border-right should be 2px divider (got: ${centerPanelDivider})`,
      10,
      "rails"
    );
  }
  if (leftPanelPadding !== `${layoutRules.leftPanelPaddingPx}px`) {
    addViolation(
      report,
      `left panel padding "${leftPanelPadding}" != "${layoutRules.leftPanelPaddingPx}px"`,
      8,
      "rails"
    );
  }
  if (centerPanelPadding !== `${layoutRules.centerPanelTopBottomPaddingPx}px ${layoutRules.centerPanelLeftRightPaddingPx}px`) {
    addViolation(
      report,
      `center panel padding "${centerPanelPadding}" != "${layoutRules.centerPanelTopBottomPaddingPx}px ${layoutRules.centerPanelLeftRightPaddingPx}px"`,
      8,
      "rails"
    );
  }
  if (rightPanelPadding !== `${layoutRules.rightPanelPaddingPx}px`) {
    addViolation(
      report,
      `right panel padding "${rightPanelPadding}" != "${layoutRules.rightPanelPaddingPx}px"`,
      8,
      "rails"
    );
  }
  if (!Number.isFinite(rightPanelGap) || rightPanelGap !== layoutRules.rightPanelGapPx) {
    addViolation(
      report,
      `right panel gap ${rightPanelGap} != ${layoutRules.rightPanelGapPx}`,
      8,
      "rails"
    );
  }
  if (servingInfoBorderTop && !servingInfoBorderTop.includes("1px")) {
    addViolation(
      report,
      `serving-info border-top should use 1px separator (got: ${servingInfoBorderTop})`,
      6,
      "rails"
    );
  }
  if (servingInfoPaddingTop && !servingInfoPaddingTop.includes("20")) {
    addViolation(
      report,
      `serving-info padding-top should be 20px (got: ${servingInfoPaddingTop})`,
      4,
      "rails"
    );
  }
  if (leftPanelDisplay && leftPanelDisplay.toLowerCase() !== "flex") {
    addViolation(
      report,
      `left-panel display should be flex (got: ${leftPanelDisplay})`,
      4,
      "rails"
    );
  }
  if (centerPanelDisplay && centerPanelDisplay.toLowerCase() !== "flex") {
    addViolation(
      report,
      `center-panel display should be flex (got: ${centerPanelDisplay})`,
      4,
      "rails"
    );
  }
  if (rightPanelDisplay && rightPanelDisplay.toLowerCase() !== "flex") {
    addViolation(
      report,
      `right-panel display should be flex (got: ${rightPanelDisplay})`,
      4,
      "rails"
    );
  }
  if (servingSizeInfoBorderBottom && !servingSizeInfoBorderBottom.includes("1px")) {
    addViolation(
      report,
      `serving-size-info border-bottom should be 1px (got: ${servingSizeInfoBorderBottom})`,
      4,
      "rails"
    );
  }
  if (servingSizeInfoPaddingBottom && !servingSizeInfoPaddingBottom.includes("8")) {
    addViolation(
      report,
      `serving-size-info padding-bottom should be 8px (got: ${servingSizeInfoPaddingBottom})`,
      4,
      "rails"
    );
  }
  if (servingCountTransform && servingCountTransform.toLowerCase() !== "uppercase") {
    addViolation(
      report,
      `serving-count text-transform should be uppercase (got: ${servingCountTransform})`,
      4,
      "typography"
    );
  }
  if (servingCountWeight && Number.parseInt(servingCountWeight, 10) < 500) {
    addViolation(
      report,
      `serving-count font-weight should be around 600+ (got: ${servingCountWeight})`,
      4,
      "typography"
    );
  }
  if (servingCountLetterSpacing && !servingCountLetterSpacing.includes("0.05")) {
    addViolation(
      report,
      `serving-count letter-spacing should be close to 0.05em (got: ${servingCountLetterSpacing})`,
      4,
      "typography"
    );
  }

  if (!productNameSize || productNameSize < typographyRules.minFontSizePx) {
    addViolation(
      report,
      `missing/invalid product-name font-size "${getStyleProperty(productNameBlock, "font-size")}"`,
      8,
      "typography"
    );
  }
  if (sectionTitleSize && sectionTitleSize < typographyRules.minFontSizePx) {
    addViolation(
      report,
      `section-title font-size ${sectionTitleSize} < ${typographyRules.minFontSizePx}`,
      4,
      "typography"
    );
  }
  if (productDescriptionSize && productDescriptionSize < typographyRules.minFontSizePx) {
    addViolation(
      report,
      `product-description font-size ${productDescriptionSize} < ${typographyRules.minFontSizePx}`,
      8,
      "typography"
    );
  }
  if (suggestedUseSize && suggestedUseSize < typographyRules.minFontSizePx) {
    addViolation(
      report,
      `suggested-use font-size ${suggestedUseSize} < ${typographyRules.minFontSizePx}`,
      8,
      "typography"
    );
  }
  if (warningsSize && warningsSize < typographyRules.minFontSizePx) {
    addViolation(report, `warnings font-size ${warningsSize} < ${typographyRules.minFontSizePx}`, 8, "typography");
  }
  if (servingSizeInfoFontWeight && Number.parseFloat(servingSizeInfoFontWeight) < 500) {
    addViolation(
      report,
      `serving-size-info font-weight should be around 500+ (got: ${servingSizeInfoFontWeight})`,
      4,
      "typography"
    );
  }
  if (factsHeaderBlock && factsHeaderBorderBottom && !factsHeaderBorderBottom.includes("8px")) {
    addViolation(
      report,
      `facts-header bottom rule should be 8px (got: ${factsHeaderBorderBottom})`,
      8,
      "typography"
    );
  }
  if (factsTableFontSize && factsTableFontSize < typographyRules.minFontSizePx) {
    addViolation(
      report,
      `facts-table font-size ${factsTableFontSize} < ${typographyRules.minFontSizePx}`,
      4,
      "typography"
    );
  }
  if (footerInfoFontSize && footerInfoFontSize < typographyRules.minFontSizePx) {
    addViolation(
      report,
      `footer-info font-size ${footerInfoFontSize} < ${typographyRules.minFontSizePx}`,
      4,
      "typography"
    );
  }
  if (factsFooterFontSize && factsFooterFontSize < typographyRules.minFontSizePx) {
    addViolation(
      report,
      `facts-footer font-size ${factsFooterFontSize} < ${typographyRules.minFontSizePx}`,
      4,
      "typography"
    );
  }

  const fontFamilies = splitFonts(concept?.fonts?.logo || "")
    .concat(splitFonts(concept?.fonts?.headline || ""))
    .concat(splitFonts(concept?.fonts?.body || ""));
  const uniqueFontFamilies = new Set(fontFamilies);
  report.checks.uniqueFontFamilies = uniqueFontFamilies.size;
  if (uniqueFontFamilies.size > typographyRules.maxFontFamilies) {
    addViolation(
      report,
      `font family count ${uniqueFontFamilies.size} > ${typographyRules.maxFontFamilies}`,
      16,
      "typography"
    );
  }

  const centerColumnWidthPx = 300;
  const centerAvailablePx = Math.max(
    0,
    centerColumnWidthPx - layoutRules.centerPanelLeftRightPaddingPx * 2
  );
  const productDescriptionLength = String(concept?.label?.productDescription || "").length;
  if (productDescriptionLength > 0 && productDescriptionSize) {
    const approximateLineLength = estimateLineLengthFromPixelBudget(centerAvailablePx, productDescriptionSize);
    const estimatedLines = Math.ceil(productDescriptionLength / approximateLineLength);
    if (approximateLineLength < typographyRules.bodyLineLengthMinChars) {
      addViolation(
        report,
        `estimated product-description line length ${approximateLineLength} below ${typographyRules.bodyLineLengthMinChars}`,
        10,
        "typography"
      );
    }
    if (approximateLineLength > typographyRules.bodyLineLengthMaxChars) {
      addViolation(
        report,
        `estimated product-description line length ${approximateLineLength} above ${typographyRules.bodyLineLengthMaxChars}`,
        10,
        "typography"
      );
    }
    if (estimatedLines > 6) {
      addViolation(
        report,
        `product-description estimated line count ${estimatedLines} may reduce legibility`,
        8,
        "typography"
      );
    }
  }

  const leftPanelAvailablePx = Math.max(
    0,
    (containerWidth ? (containerWidth - 300) / 2 : (layoutRules.requiredCanvasWidthPx - 300) / 2) -
      layoutRules.rightPanelPaddingPx * 2
  );
  const suggestedUseLength = String(concept?.label?.suggestedUse || "").length;
  if (suggestedUseLength > 0 && suggestedUseSize) {
    const suggestedUseCapacity = estimateLineLengthFromPixelBudget(leftPanelAvailablePx, suggestedUseSize);
    const suggestedUseLines = Math.ceil(suggestedUseLength / suggestedUseCapacity);
    if (suggestedUseLines > 5) {
      addViolation(
        report,
        `suggested-use text may exceed legibility budget (${suggestedUseLength} chars)`,
        8,
        "copy"
      );
    }
  }

  if (!labelPngPath) {
    return;
  }

  const layoutSnapshot = {
    canvasWidthPx: containerWidth,
    canvasHeightPx: containerHeight,
    gridTemplateColumns,
    ingredientRows: Array.isArray(concept?.label?.ingredients) ? concept.label.ingredients.length : 0,
    overflowDetected: false,
    collisionCount: 0,
  };
  report.checks.layoutSnapshot = layoutSnapshot;
}

async function validateManifest(manifestPath, strict) {
  const manifest = await readJson(manifestPath);
  const runDir = path.dirname(manifestPath);
  const conceptPath = path.join(runDir, "concept.input.json");
  const concept = await readJson(conceptPath);
  const { typography: typographyRules, layout: layoutRules } = await readDesignTokens();

  const report = {
    pass: true,
    manifestPath,
    runDir,
    strictMode: strict,
    timestamp: new Date().toISOString(),
    scoring: createScoringState(),
    score: 100,
    violations: [],
    checks: {
      dimensions: manifest.checks?.labelDimensions || null,
      ingredientRows: manifest.checks?.labelIngredientRows ?? null,
      recraftV4Used: Boolean(manifest.checks?.recraftV4Used),
      cyborgLockedFlow: isCyborgBrandFlow(concept, manifest),
      centerPanelWidthPx: manifest.checks?.centerPanelWidthPx ?? null,
      imageEngineUsed: manifest.pipeline?.imageEngineUsed || "unknown",
      pipelineRecraftModel: manifest.pipeline?.recraft?.model || "unknown",
      pipelineRecraftScene: manifest.pipeline?.recraft?.scenePng || null,
      pipelineRecraftMood: manifest.pipeline?.recraft?.moodPng || null,
      typographyMinFontSizePx: typographyRules.minFontSizePx,
      typographyMaxFontFamilies: typographyRules.maxFontFamilies,
      layoutGrid: layoutRules.requiredGridTemplateColumns,
      categoryScores: {},
    },
  };

  await validateCyborgRules(report, concept, manifest, runDir, typographyRules, layoutRules);

  // Canvas/rail/engine checks (strict)
  if (!manifest.checks || manifest.checks.labelDimensions !== `${RULES.labelWidthPx}x${RULES.labelHeightPx}`) {
    addViolation(
      report,
      `manifest checks.labelDimensions must be ${RULES.labelWidthPx}x${RULES.labelHeightPx}`,
      12,
      "rails"
    );
  }

  if (manifest.pipeline?.imageEngineUsed !== "recraft-v4") {
    addViolation(
      report,
      `manifest pipeline.imageEngineUsed must be recraft-v4 (got: ${manifest.pipeline?.imageEngineUsed || "missing"})`,
      14,
      "assets"
    );
  }

  const isCyborgFlow = Boolean(report.checks.cyborgLockedFlow);
  if (isCyborgFlow) {
    if (manifest.checks?.productMockEngine !== "gemini-labeled-composition") {
      addViolation(
        report,
        `manifest checks.productMockEngine must be gemini-labeled-composition for Cyborg flow (got: ${manifest.checks?.productMockEngine || "missing"})`,
        16,
        "assets"
      );
    }
    if (manifest.checks?.bottleMockup !== "gemini-labeled-composition") {
      addViolation(
        report,
        `manifest checks.bottleMockup must be gemini-labeled-composition for Cyborg flow (got: ${manifest.checks?.bottleMockup || "missing"})`,
        16,
        "assets"
      );
    }
    if (manifest.checks?.bottleImageEngine && manifest.checks?.bottleImageEngine === "recraft") {
      addViolation(
        report,
        "manifest checks.bottleImageEngine must not be recraft when Cyborg flow is enforced",
        12,
        "assets"
      );
    }
    if (manifest.checks?.productMockEngineWasForced) {
      report.checks.cyborgOverrideActive = true;
    }
  }

  if (!manifest.outputs?.bottle?.png) {
    addViolation(report, "manifest.outputs.bottle.png is required for Cyborg supplement mockups", 12, "assets");
  } else if (!(await fileExists(manifest.outputs.bottle.png))) {
    addViolation(report, `missing generated bottle output: ${manifest.outputs.bottle.png}`, 12, "assets");
  }

  if (manifest.checks?.recraftV4Used) {
    if (
      manifest.checks?.bottleImageSource === "referenceImage" &&
      !manifest.checks?.bottleReferenceImageUsed
    ) {
      addViolation(
        report,
        "manifest checks.bottleReferenceImageUsed is missing while bottleImageSource is referenceImage",
        12,
        "assets"
      );
    }
  }

  if (RULES.requireRecraftV4 && !manifest.checks?.recraftV4Used) {
    addViolation(report, "manifest checks.recraftV4Used must be true", 16, "assets");
  }

  // Concept constraints
  const ingredients = Array.isArray(concept?.label?.ingredients) ? concept.label.ingredients : [];
  const ingredientRows = ingredients.length;
  if (!ingredients.length) {
    addViolation(report, "concept.label.ingredients must be a non-empty array", 12, "copy");
  }
  if (ingredientRows > RULES.maxIngredientRows) {
    addViolation(
      report,
      `ingredient rows ${ingredientRows} exceeds max ${RULES.maxIngredientRows}`,
      10,
      "copy"
    );
  }
  if (!concept?.label?.productDescription || String(concept.label.productDescription).trim().length < 40) {
    addViolation(report, "concept.label.productDescription is too short for clear copy", 8, "copy");
  }
  if (!concept?.label?.productDescription || String(concept.label.productDescription).length > 320) {
    addViolation(report, "concept.label.productDescription is too long for a stable layout", 8, "copy");
  }
  if (!concept?.label?.suggestedUse || String(concept.label.suggestedUse).trim().length < 35) {
    addViolation(report, "concept.label.suggestedUse is too short", 8, "copy");
  }
  if (concept?.label?.suggestedUse && String(concept.label.suggestedUse).length > 360) {
    addViolation(report, "concept.label.suggestedUse is too long for a stable layout", 8, "copy");
  }
  if (!concept?.label?.warnings || String(concept.label.warnings).trim().length < 45) {
    addViolation(report, "concept.label.warnings is too short", 6, "copy");
  }
  if (concept?.label?.warnings && String(concept.label.warnings).length > 420) {
    addViolation(report, "concept.label.warnings is too long for compact copy", 6, "copy");
  }
  if (!concept?.label?.servingCount || !String(concept.label.servingCount).trim()) {
    addViolation(report, "concept.label.servingCount is required", 10, "copy");
  }
  if (!concept?.label?.servingSize || !String(concept.label.servingSize).trim()) {
    addViolation(report, "concept.label.servingSize is required", 10, "copy");
  }

  for (const ingredient of ingredients) {
    if (!ingredient || typeof ingredient !== "object") {
      addViolation(report, "concept.label.ingredients contains non-object entry", 10, "copy");
      break;
    }
    if (!String(ingredient.name || "").trim()) {
      addViolation(report, "ingredient name is required", 6, "copy");
      continue;
    }
    if (!String(ingredient.amount || "").trim()) {
      addViolation(report, `ingredient amount is required for ${ingredient.name || "unnamed ingredient"}`, 6, "copy");
    }
    if (ingredient.percentDV && !/^\d+(\.\d+)?$/.test(String(ingredient.percentDV).trim())) {
      addViolation(
        report,
        `ingredient.percentDV should be numeric (got ${ingredient.percentDV} for ${ingredient.name})`,
        6,
        "copy"
      );
    }
  }

  // Core output existence
  const labelHtml = manifest.outputs?.label?.html;
  const labelPng = manifest.outputs?.label?.png;
  const labelPdf = manifest.outputs?.label?.pdf;
  const mockPng = manifest.outputs?.productMock?.png;
  const boardPng = manifest.outputs?.brandBoard?.png;
  const mockHtml = manifest.outputs?.productMock?.html;
  const boardHtml = manifest.outputs?.brandBoard?.html;

  const requiredOutputs = [
    ["labelHtml", labelHtml],
    ["labelPng", labelPng],
    ["labelPdf", labelPdf],
    ["mockPng", mockPng],
    ["boardPng", boardPng],
    ["mockHtml", mockHtml],
    ["boardHtml", boardHtml],
  ];
  for (const [label, output] of requiredOutputs) {
    if (!output) {
      addViolation(report, `missing required output path: ${label}`, 12, "assets");
      continue;
    }
    if (!(await fileExists(output))) {
      addViolation(report, `missing required output: ${output}`, 12, "assets");
    } else {
      const stats = await fs.stat(output);
      if (stats.size <= 0) {
        addViolation(report, `empty output file: ${output}`, 12, "assets");
      }
    }
  }

  if (manifest.checks?.recraftV4Used) {
    if (!manifest.pipeline?.recraft?.scenePng || !(await fileExists(manifest.pipeline.recraft.scenePng))) {
      addViolation(report, "missing recraft scene image", 10, "assets");
    }
    if (!manifest.pipeline?.recraft?.moodPng || !(await fileExists(manifest.pipeline.recraft.moodPng))) {
      addViolation(report, "missing recraft mood image", 10, "assets");
    }
    if (!manifest.pipeline?.recraft?.prompts?.scene || !manifest.pipeline?.recraft?.prompts?.mood) {
      addViolation(report, "missing recraft prompts", 12, "assets");
    } else {
      const scenePrompt = String(manifest.pipeline.recraft.prompts.scene || "");
      const moodPrompt = String(manifest.pipeline.recraft.prompts.mood || "");
      if (scenePrompt.length < 80 || moodPrompt.length < 80) {
        addViolation(
          report,
          "recraft prompts should be at least 80 chars each for stronger guidance",
          8,
          "copy"
        );
      }
      if (!/no\s+text/i.test(scenePrompt)) {
        addViolation(report, "recraft prompts should explicitly include 'no text'", 8, "copy");
      }
    }
  }

  // Label asset checks
  if (await fileExists(labelPng)) {
    const size = await getImagePixelSize(labelPng);
    if (!size) {
      addViolation(report, `unable to read label image dimensions from ${labelPng}`, 16, "assets");
    } else if (size.width !== RULES.labelWidthPx || size.height !== RULES.labelHeightPx) {
      addViolation(
        report,
        `label dimensions ${size.width}x${size.height} must be ${RULES.labelWidthPx}x${RULES.labelHeightPx}`,
        16,
        "assets"
      );
    }
  }

  // Palette/contrast checks from concept-level values
  const palette = concept?.palette || {};
  const background = palette.background || "#FFFFFF";
  const text = palette.text || "#000000";
  const primary = palette.primary || text;
  const accent = palette.accent || text;
  const ratioTextBg = contrastRatio(text, background);
  const ratioPrimaryBg = contrastRatio(primary, background);
  const ratioAccentBg = contrastRatio(accent, background);

  if (ratioTextBg === null) {
    addViolation(report, "palette.text or palette.background has invalid hex value", 10, "contrast");
  } else if (ratioTextBg < RULES.minContrastBody) {
    addViolation(report, `text/background contrast ${ratioTextBg.toFixed(2)} below ${RULES.minContrastBody}`, 12, "contrast");
  }
  if (ratioPrimaryBg === null) {
    addViolation(report, "palette.primary or palette.background has invalid hex value", 10, "contrast");
  } else if (ratioPrimaryBg < RULES.minContrastHeadline) {
    addViolation(
      report,
      `primary/background contrast ${ratioPrimaryBg.toFixed(2)} below ${RULES.minContrastHeadline}`,
      10,
      "contrast"
    );
  }
  if (ratioAccentBg === null) {
    addViolation(report, "palette.accent or palette.background has invalid hex value", 10, "contrast");
  } else if (ratioAccentBg < RULES.minContrastHeadline) {
    addViolation(
      report,
      `accent/background contrast ${ratioAccentBg.toFixed(2)} below ${RULES.minContrastHeadline}`,
      10,
      "contrast"
    );
  }

  // Brand logo source sanity checks
  const brandLogo = concept?.brandLogo || {};
  const brandLogoSource = brandLogo.source;
  if (typeof brandLogoSource === "string" && brandLogoSource.trim()) {
    const brandLogoPath = path.isAbsolute(brandLogoSource)
      ? brandLogoSource
      : path.join(runDir, brandLogoSource);
    if (!(await fileExists(brandLogoPath))) {
      addViolation(report, `brandLogo.source not found: ${brandLogoSource}`, 10, "assets");
    } else if (isSvgVectorSource(brandLogoPath)) {
      const svgNodes = await countSvgDrawingNodes(brandLogoPath);
      report.checks.brandLogoDrawingNodes = svgNodes;
      if (svgNodes > RULES.maxSvgDrawingNodes) {
        addViolation(
          report,
          `brandLogo SVG node count ${svgNodes} exceeds ${RULES.maxSvgDrawingNodes}`,
          10,
          "assets"
        );
      }
    }
  }

  const reportPath = path.join(runDir, "quality-report.json");
  evaluateScoring(report);

  if (strict && report.score < RULES.minOverallScoreStrict) {
    addViolation(
      report,
      `overall score ${report.score?.toFixed?.(2) ?? report.score} below strict minimum ${RULES.minOverallScoreStrict}`,
      18,
      "assets"
    );
    evaluateScoring(report);
  }

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(
    path.join(runDir, "scores.json"),
    `${JSON.stringify(report.scoring, null, 2)}\n`,
    "utf8"
  );

  if (!report.pass) {
    return { report, pass: false };
  }
  return { report, pass: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(args.manifestPath);

  const result = await validateManifest(manifestPath, args.strict);
  if (!result.pass) {
    console.error(`[cyborg-qa] FAIL (${manifestPath})`);
    console.error(`- score: ${result.report.score ?? 0}`);
    for (const violation of result.report.violations) {
      console.error(`- ${violation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[cyborg-qa] PASS (${manifestPath})`);
  console.log(`- score: ${result.report.score ?? 0}`);
  console.log(`- report: ${path.join(path.dirname(manifestPath), "quality-report.json")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
