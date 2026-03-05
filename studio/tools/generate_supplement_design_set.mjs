#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  renderLogoHtml,
  renderMoodboardHtml,
} from './cyborg_brand_templates.mjs';

const LABEL_WIDTH = 1650;
const LABEL_HEIGHT = 600;
const MOCKUP_SIZE = 2048;
const BOARD_SIZE = 2048;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_OUT_ROOT = path.join(WORKSPACE_ROOT, 'output', 'supplement-design');
const CYBORG_LABEL_TEMPLATE_PATH =
  '/Users/calbotsman/Documents/github/cyborg/backend/src/shared/utils/rendering/templates/label.ts';

function usage() {
  console.log(`Usage:
  node studio/tools/generate_supplement_design_set.mjs --config <concept.json> [--out-dir <dir>]

Generates three assets per concept:
  1) locked label render (png + pdf)
  2) product mockup png
  3) brand board png
`);
}

function parseArgs(argv) {
  const args = {
    configPath: null,
    outDir: DEFAULT_OUT_ROOT,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--config') {
      args.configPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--out-dir') {
      args.outDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.configPath) {
    throw new Error('Missing required --config argument');
  }

  return args;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function timestampSlug() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function assertHex(label, value) {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Invalid ${label} color: ${value}. Expected #RRGGBB.`);
  }
}

function buildFontsUrl(families) {
  const unique = [...new Set(families.filter(Boolean))];
  const query = unique
    .map((family) => `family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@300;400;500;600;700;800;900`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

function normalizeBrandLogo(raw, fallbackAlt) {
  const defaults = {
    source: null,
    alt: fallbackAlt,
    maxWidthPx: 360,
    maxHeightPx: 84,
    fit: 'contain',
  };

  if (!raw) {
    return defaults;
  }

  if (typeof raw === 'string') {
    const source = raw.trim();
    return {
      ...defaults,
      source: source || null,
      alt: fallbackAlt,
    };
  }

  if (typeof raw !== 'object') {
    throw new Error('concept.brandLogo must be a string or object');
  }

  const normalizedSource =
    typeof raw.source === 'string'
      ? raw.source
      : typeof raw.path === 'string'
      ? raw.path
      : typeof raw.url === 'string'
      ? raw.url
      : null;

  return {
    ...defaults,
    ...raw,
    source: normalizedSource ? normalizedSource.trim() : null,
    alt: typeof raw.alt === 'string' && raw.alt.trim() ? raw.alt.trim() : fallbackAlt,
    fit: ['contain', 'cover', 'fill', 'scale-down', 'none'].includes(raw.fit) ? raw.fit : defaults.fit,
    maxWidthPx: Number.isFinite(Number(raw.maxWidthPx)) && Number(raw.maxWidthPx) > 0
      ? Number(raw.maxWidthPx)
      : defaults.maxWidthPx,
    maxHeightPx: Number.isFinite(Number(raw.maxHeightPx)) && Number(raw.maxHeightPx) > 0
      ? Number(raw.maxHeightPx)
      : defaults.maxHeightPx,
    variant: normalizeLogoVariant(raw.variant),
  };
}

function normalizeLogoVariant(rawVariant) {
  const variant = String(rawVariant || 'standard').toLowerCase();
  if (['standard', 'stacked', 'minimal', 'badge'].includes(variant)) {
    return variant;
  }
  return 'standard';
}

function boardTemplateMode(rawMode) {
  const normalized = String(rawMode || '').toLowerCase();
  if (normalized === 'legacy') {
    return 'legacy';
  }
  if (normalized === 'cyborg' || normalized === 'moodboard') {
    return 'cyborg';
  }

  return 'cyborg';
}

function isCyborgLockedFlow(concept, boardTemplateMode) {
  const brandName = String(concept?.brandName || '').toLowerCase();
  const conceptId = String(concept?.conceptId || '').toLowerCase();
  const mode = String(boardTemplateMode || '').toLowerCase();
  const renderMode = String(concept?.render?.boardTemplateMode || concept?.board?.templateMode || '').toLowerCase();

  if (mode === 'cyborg' || renderMode === 'cyborg') {
    return true;
  }

  return (
    brandName.includes('sun daughter')
    || brandName.includes('sundaughter')
    || conceptId.includes('sun daughter')
    || conceptId.includes('sun-daughter')
    || conceptId.includes('sundaughter')
  );
}

function boardSelectorForMode(mode) {
  return mode === 'cyborg' ? '.moodboard-container' : '.brand-board';
}

function normalizeConcept(raw) {
  const concept = { ...raw };

  if (!concept.brandName) {
    throw new Error('concept.brandName is required');
  }
  if (!concept.productName) {
    throw new Error('concept.productName is required');
  }

  concept.conceptId = concept.conceptId || `${slugify(concept.brandName)}-${slugify(concept.productName)}`;

  concept.palette = {
    primary: '#1A1A1A',
    background: '#FFFFFF',
    text: '#333333',
    border: '#1A1A1A',
    secondary: '#D9D9D9',
    accent: '#B1895C',
    ...concept.palette,
  };

  assertHex('palette.primary', concept.palette.primary);
  assertHex('palette.background', concept.palette.background);
  assertHex('palette.text', concept.palette.text);
  assertHex('palette.border', concept.palette.border);
  assertHex('palette.secondary', concept.palette.secondary);
  assertHex('palette.accent', concept.palette.accent);

  concept.fonts = {
    headline: 'Cormorant Garamond',
    body: 'Inter',
    logo: 'Cormorant Garamond',
    logoWeight: 700,
    logoLetterSpacing: '0.08em',
    logoTransform: 'uppercase',
    logoSize: 140,
    ...concept.fonts,
  };

  concept.brandLogo = normalizeBrandLogo(concept.brandLogo, concept.brandName);

  concept.label = {
    productDescription:
      'Premium dietary supplement formulated for consistency, clarity, and daily performance.',
    servingCount: '30 CAPSULES',
    servingSize: '1 capsule',
    suggestedUse:
      'Adults, take one capsule daily with water, preferably with food. Use consistently for best results.',
    warnings:
      'Keep out of reach of children. Do not use if safety seal is damaged or missing. Consult your healthcare provider before use if you are pregnant, nursing, taking medication, or have a medical condition.',
    footer: `Manufactured for ${concept.brandName}  |  Made in USA`,
    ingredients: [
      { name: 'Vitamin D3', amount: '25 mcg', percentDV: '125' },
      { name: 'Magnesium (Glycinate)', amount: '120 mg', percentDV: '29' },
      { name: 'L-Theanine', amount: '200 mg' },
    ],
    ...concept.label,
  };

  if (!Array.isArray(concept.label.ingredients) || concept.label.ingredients.length === 0) {
    throw new Error('concept.label.ingredients must be a non-empty array');
  }
  if (concept.label.ingredients.length > 8) {
    throw new Error('concept.label.ingredients exceeds 8 rows (Cyborg template limit)');
  }

  concept.board = {
    positioning:
      'A modern supplement identity balancing scientific clarity with premium emotional resonance.',
    moodKeywords: ['Systemic', 'Premium', 'Calm', 'Credible'],
    voicePillars: ['Precise language', 'No hype claims', 'Grounded confidence'],
    proofPoints: ['Clean hierarchy', 'Role-based color system', 'Packaging-first usability'],
    ...concept.board,
  };

  concept.boardTemplateMode = boardTemplateMode(
    concept.render?.boardTemplateMode || concept.board?.templateMode || concept.boardTemplateMode
  );

  if (!Array.isArray(concept.board.moodKeywords) || concept.board.moodKeywords.length < 3) {
    throw new Error('concept.board.moodKeywords must include at least 3 entries');
  }

  return concept;
}

function labelRowsHtml(ingredients) {
  return ingredients
    .map((ingredient) => {
      const name = escapeHtml(ingredient.name || 'Ingredient');
      const amount = escapeHtml(ingredient.amount || '');
      const dv = ingredient.percentDV ? ` (${escapeHtml(ingredient.percentDV)}%)` : '';
      return `<tr class="facts-table-row"><td>${name}</td><td>${amount}${dv}</td></tr>`;
    })
    .join('\n');
}

function isBrandLogoSourceRemote(value) {
  return /^(https?:\/\/|data:)/i.test(value);
}

function brandLogoMimeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

async function resolveBrandLogoSource(brandLogo, configDir) {
  if (!brandLogo || !brandLogo.source) {
    return null;
  }

  const source = String(brandLogo.source).trim();
  if (!source) {
    return null;
  }

  if (isBrandLogoSourceRemote(source)) {
    return source;
  }

  const resolvedSource = path.isAbsolute(source) ? source : path.resolve(configDir, source);
  try {
    const bytes = await fs.readFile(resolvedSource);
    const mime = brandLogoMimeFromPath(resolvedSource);
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch (error) {
    console.warn(`Warning: Unable to read brand logo source "${source}": ${error.message}. Falling back to text mark.`);
    return null;
  }
}

function buildBrandLogoHtml(concept, brandLogoImageSrc) {
  const includeWordmark = concept.brandLogo?.includeWordmark !== false;
  const wordmark = includeWordmark
    ? `<div class="brand-logo-wordmark">${escapeHtml(concept.brandName)}</div>`
    : '';

  if (brandLogoImageSrc) {
    return `<div class="brand-logo-lockup">
      <div class="brand-logo brand-logo-with-image">
        <img class="brand-logo-image" src="${escapeHtml(brandLogoImageSrc)}" alt="${escapeHtml(
      concept.brandLogo?.alt || concept.brandName
    )}" />
      </div>
      ${wordmark}
    </div>`;
  }

  return `<div class="brand-logo brand-logo-wordmark">${escapeHtml(concept.brandName)}</div>`;
}

function renderBrandLogo(concept, brandLogoImageSrc) {
  return renderLogoHtml({
    brandName: concept.brandName,
    logoFont: concept.fonts.logo,
    headlineFont: concept.fonts.headline,
    logoWeight: concept.fonts.logoWeight,
    logoLetterSpacing: concept.fonts.logoLetterSpacing,
    logoTransform: concept.fonts.logoTransform,
    logoSize: concept.fonts.logoSize,
    color: concept.palette.primary,
    backgroundColor: concept.palette.background,
    tagline: concept.tagline || concept.productName,
    taglineFont: concept.fonts.body,
    variant: concept.brandLogo.variant,
    logoImageUrl: brandLogoImageSrc || '',
    googleFontsUrl: buildFontsUrl([concept.fonts.headline, concept.fonts.body, concept.fonts.logo]),
  });
}

function resolveBoardHtml(concept, boardTemplateMode, labelImageUrl, mockupImageUrl, brandLogoImageSrc) {
  if (boardTemplateMode === 'legacy') {
    return renderBoardHtml(concept, labelImageUrl, mockupImageUrl, brandLogoImageSrc);
  }

  return renderMoodboardHtml({
    concept,
    labelImageUrl,
    mockupImageUrl,
    logoImageUrl: brandLogoImageSrc || '',
    googleFontsUrl: buildFontsUrl([concept.fonts.headline, concept.fonts.body]),
  });
}

function renderLabelHtml(concept, brandLogoImageSrc) {
  const fontsUrl = buildFontsUrl([concept.fonts.headline, concept.fonts.body, concept.fonts.logo]);
  const servingsPerContainer =
    concept.label.servingCount.replace(/\D/g, '').trim() || '30';
  const labelTypography = concept.render?.labelTypography || {};
  const logoMaxWidthPx = Number.isFinite(Number(concept.brandLogo?.maxWidthPx))
    ? Number(concept.brandLogo.maxWidthPx)
    : 360;
  const logoMaxHeightPx = Number.isFinite(Number(concept.brandLogo?.maxHeightPx))
    ? Number(concept.brandLogo.maxHeightPx)
    : 84;
  const logoFit = ['contain', 'cover', 'fill', 'scale-down', 'none'].includes(concept.brandLogo?.fit)
    ? concept.brandLogo.fit
    : 'contain';
  const leftPanelTextAlign = ['left', 'center', 'right'].includes(String(labelTypography.leftPanelTextAlign || '').toLowerCase())
    ? String(labelTypography.leftPanelTextAlign).toLowerCase()
    : 'left';
  const leftPanelAlignItems = leftPanelTextAlign === 'center' ? 'center' : leftPanelTextAlign === 'right' ? 'flex-end' : 'flex-start';
  const leftPanelLogoJustify = leftPanelTextAlign === 'center' ? 'center' : leftPanelTextAlign === 'right' ? 'flex-end' : 'flex-start';
  const productNameFontSizePx = Number.isFinite(Number(labelTypography.productNameFontSizePx))
    ? Math.max(8, Math.min(72, Number(labelTypography.productNameFontSizePx)))
    : 42;
  const productDescriptionFontSizePx = Number.isFinite(Number(labelTypography.productDescriptionFontSizePx))
    ? Math.max(8, Math.min(28, Number(labelTypography.productDescriptionFontSizePx)))
    : 14;
  const productNameFontWeight = Number.isFinite(Number(labelTypography.productNameFontWeight))
    ? Math.max(300, Math.min(900, Number(labelTypography.productNameFontWeight)))
    : 700;
  const productDescriptionLineHeight = Number.isFinite(Number(labelTypography.productDescriptionLineHeight))
    ? Math.max(1, Math.min(2, Number(labelTypography.productDescriptionLineHeight)))
    : 1.5;
  const productNameLineHeight = Number.isFinite(Number(labelTypography.productNameLineHeight))
    ? Math.max(0.8, Math.min(2, Number(labelTypography.productNameLineHeight)))
    : 1.1;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${LABEL_WIDTH}, initial-scale=1" />
  <title>${escapeHtml(concept.brandName)} — ${escapeHtml(concept.productName)} Label</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontsUrl}" rel="stylesheet" />
  <style>
    :root {
      --primary: ${concept.palette.primary};
      --background: ${concept.palette.background};
      --text: ${concept.palette.text};
      --border: ${concept.palette.border};
      --headline-font: '${escapeHtml(concept.fonts.headline)}', sans-serif;
      --body-font: '${escapeHtml(concept.fonts.body)}', sans-serif;
      --logo-font: '${escapeHtml(concept.fonts.logo)}', sans-serif;
      --logo-weight: ${Number(concept.fonts.logoWeight)};
      --logo-letter-spacing: ${escapeHtml(concept.fonts.logoLetterSpacing)};
      --logo-transform: ${escapeHtml(concept.fonts.logoTransform)};
      --brand-logo-max-width: ${logoMaxWidthPx}px;
      --brand-logo-max-height: ${logoMaxHeightPx}px;
      --brand-logo-fit: ${logoFit};
      --left-panel-text-align: ${leftPanelTextAlign};
      --left-panel-align-items: ${leftPanelAlignItems};
      --left-panel-logo-justify: ${leftPanelLogoJustify};
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html,
    body {
      width: ${LABEL_WIDTH}px;
      height: ${LABEL_HEIGHT}px;
    }

    body {
      font-family: var(--body-font);
      background: var(--background);
      overflow: hidden;
    }

    .label-container {
      width: ${LABEL_WIDTH}px;
      height: ${LABEL_HEIGHT}px;
      background: var(--background);
      border: 3px solid var(--border);
      display: grid;
      grid-template-columns: 1fr 300px 1fr;
      gap: 0;
      padding: 0;
      overflow: hidden;
    }

    .left-panel {
      padding: 32px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-right: 2px solid var(--border);
    }

    .left-panel-content {
      display: flex;
      flex-direction: column;
      align-items: var(--left-panel-align-items);
      text-align: var(--left-panel-text-align);
    }

    .left-panel-content .brand-logo-lockup,
    .left-panel-content .brand-logo {
      align-self: var(--left-panel-align-items);
    }

    .left-panel-content .brand-logo-with-image {
      justify-content: var(--left-panel-logo-justify);
    }

    .brand-logo {
      font-family: var(--logo-font);
      font-size: ${Number(concept.fonts.logoSize)}%;
      font-weight: var(--logo-weight);
      letter-spacing: var(--logo-letter-spacing);
      text-transform: var(--logo-transform);
      color: var(--primary);
      margin-bottom: 16px;
      line-height: 1.1;
    }

    .brand-logo-lockup {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
    }

    .brand-logo-lockup .brand-logo {
      margin-bottom: 0;
    }

    .brand-logo-with-image {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      width: var(--brand-logo-max-width);
      max-width: 100%;
      height: var(--brand-logo-max-height);
      max-height: var(--brand-logo-max-height);
      line-height: 1;
    }

    .brand-logo-image {
      display: block;
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: var(--brand-logo-max-height);
      object-fit: var(--brand-logo-fit);
    }

    .brand-logo-wordmark {
      font-family: var(--logo-font);
      font-size: 28px;
      font-weight: var(--logo-weight);
      letter-spacing: 0.02em;
      text-transform: var(--logo-transform);
      color: var(--primary);
      line-height: 1.05;
    }

    .product-name {
      font-family: var(--headline-font);
      font-size: ${productNameFontSizePx}px;
      font-weight: ${productNameFontWeight};
      color: var(--text);
      margin-bottom: 12px;
      line-height: ${productNameLineHeight};
    }

    .product-description {
      font-family: var(--body-font);
      font-size: ${productDescriptionFontSizePx}px;
      line-height: ${productDescriptionLineHeight};
      color: var(--text);
      opacity: 0.85;
      max-width: 400px;
    }

    .serving-info {
      margin-top: auto;
      padding-top: 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      text-align: var(--left-panel-text-align);
    }

    .serving-count {
      font-family: var(--headline-font);
      font-size: 16px;
      font-weight: 600;
      color: var(--primary);
      letter-spacing: 0.05em;
    }

    .center-panel {
      background: var(--background);
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      border-right: 2px solid var(--border);
    }

    .facts-header {
      font-family: var(--headline-font);
      font-size: 20px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      border-bottom: 8px solid var(--text);
      padding-bottom: 4px;
      margin-bottom: 8px;
    }

    .serving-size-info {
      font-size: 12px;
      color: var(--text);
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--text);
    }

    .facts-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    .facts-table th {
      text-align: left;
      font-weight: 600;
      padding: 4px 0;
      border-bottom: 1px solid var(--text);
    }

    .facts-table-row td {
      padding: 4px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.15);
    }

    .facts-table-row td:last-child {
      text-align: right;
      font-weight: 500;
    }

    .facts-footer {
      margin-top: auto;
      font-size: 9px;
      color: var(--text);
      opacity: 0.7;
      line-height: 1.4;
    }

    .right-panel {
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .section-title {
      font-family: var(--headline-font);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--primary);
      margin-bottom: 8px;
    }

    .suggested-use {
      font-size: 11px;
      line-height: 1.5;
      color: var(--text);
    }

    .warnings {
      font-size: 9px;
      line-height: 1.5;
      color: var(--text);
      opacity: 0.8;
    }

    .footer-info {
      margin-top: auto;
      font-size: 9px;
      color: var(--text);
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <div class="label-container">
    <div class="left-panel">
      <div class="left-panel-content">
        ${buildBrandLogoHtml(concept, brandLogoImageSrc)}
        <h1 class="product-name">${escapeHtml(concept.productName)}</h1>
        <p class="product-description">${escapeHtml(concept.label.productDescription)}</p>
      </div>
      <div class="serving-info">
        <div class="serving-count">${escapeHtml(concept.label.servingCount)}</div>
      </div>
    </div>

    <div class="center-panel">
      <h2 class="facts-header">Supplement Facts</h2>
      <div class="serving-size-info">
        <div>Serving Size: ${escapeHtml(concept.label.servingSize)}</div>
        <div>Servings Per Container: ${escapeHtml(servingsPerContainer)}</div>
      </div>
      <table class="facts-table">
        <thead>
          <tr>
            <th>Amount Per Serving</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${labelRowsHtml(concept.label.ingredients)}
        </tbody>
      </table>
      <div class="facts-footer">
        * Percent Daily Values are based on a 2,000 calorie diet.<br />
        † Daily Value not established.
      </div>
    </div>

    <div class="right-panel">
      <div>
        <h3 class="section-title">Suggested Use</h3>
        <p class="suggested-use">${escapeHtml(concept.label.suggestedUse)}</p>
      </div>
      <div>
        <h3 class="section-title">Warnings</h3>
        <p class="warnings">${escapeHtml(concept.label.warnings)}</p>
      </div>
      <div class="footer-info">
        <p>${escapeHtml(concept.label.footer)}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function renderMockupHtml(concept, labelImageUrl) {
  const fontsUrl = buildFontsUrl([concept.fonts.headline, concept.fonts.body]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${MOCKUP_SIZE}, initial-scale=1" />
  <title>${escapeHtml(concept.brandName)} Product Mock</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontsUrl}" rel="stylesheet" />
  <style>
    :root {
      --surface-top: color-mix(in srgb, ${concept.palette.secondary} 70%, white 30%);
      --surface-bottom: color-mix(in srgb, ${concept.palette.primary} 78%, black 22%);
      --metal: color-mix(in srgb, ${concept.palette.accent} 76%, white 24%);
      --ink: ${concept.palette.text};
      --body: '${escapeHtml(concept.fonts.body)}', sans-serif;
      --headline: '${escapeHtml(concept.fonts.headline)}', serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html,
    body {
      width: ${MOCKUP_SIZE}px;
      height: ${MOCKUP_SIZE}px;
      overflow: hidden;
      font-family: var(--body);
    }

    .mockup-canvas {
      width: ${MOCKUP_SIZE}px;
      height: ${MOCKUP_SIZE}px;
      position: relative;
      background:
        radial-gradient(circle at 18% 16%, rgba(255,255,255,0.5), transparent 34%),
        radial-gradient(circle at 78% 8%, rgba(255,255,255,0.24), transparent 28%),
        linear-gradient(180deg, var(--surface-top) 0%, var(--surface-bottom) 100%);
      display: grid;
      place-items: center;
      color: #f4f2ee;
    }

    .grain {
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(circle at 30% 62%, rgba(255,255,255,0.06), transparent 56%),
        radial-gradient(circle at 74% 70%, rgba(0,0,0,0.2), transparent 52%);
      pointer-events: none;
    }

    .set {
      width: 1640px;
      height: 1600px;
      position: relative;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 24px;
      align-items: end;
    }

    .caption {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 56px;
      letter-spacing: 0.04em;
    }

    .caption h1 {
      font-family: var(--headline);
      font-size: 92px;
      line-height: 0.95;
      font-weight: 400;
    }

    .caption p {
      font-size: 22px;
      opacity: 0.86;
    }

    .jar {
      position: relative;
      margin: 0 auto;
      width: 1480px;
      height: 1240px;
      border-radius: 170px 170px 120px 120px;
      background:
        linear-gradient(180deg,
          color-mix(in srgb, ${concept.palette.primary} 85%, white 15%) 0%,
          color-mix(in srgb, ${concept.palette.primary} 92%, black 8%) 68%,
          color-mix(in srgb, ${concept.palette.primary} 70%, black 30%) 100%);
      box-shadow:
        0 90px 140px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.2),
        inset 0 -28px 64px rgba(0,0,0,0.22);
      overflow: hidden;
    }

    .cap {
      position: absolute;
      top: -74px;
      left: 120px;
      width: 1240px;
      height: 168px;
      border-radius: 84px;
      background:
        linear-gradient(180deg,
          color-mix(in srgb, var(--metal) 70%, white 30%) 0%,
          color-mix(in srgb, var(--metal) 88%, black 12%) 100%);
      box-shadow:
        0 18px 34px rgba(0,0,0,0.28),
        inset 0 1px 0 rgba(255,255,255,0.55);
    }

    .label-window {
      position: absolute;
      left: 115px;
      top: 320px;
      width: 1250px;
      height: 454px;
      border-radius: 38px;
      overflow: hidden;
      background: #fff;
      box-shadow:
        0 18px 30px rgba(0,0,0,0.22),
        inset 0 0 0 1px rgba(255,255,255,0.36);
    }

    .label-window img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .label-window::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, rgba(0,0,0,0.28) 0%, transparent 16%, transparent 84%, rgba(0,0,0,0.28) 100%),
        linear-gradient(180deg, rgba(255,255,255,0.16) 0%, transparent 34%, rgba(0,0,0,0.16) 100%);
      pointer-events: none;
      mix-blend-mode: multiply;
    }

    .base-shadow {
      position: absolute;
      width: 1040px;
      height: 220px;
      left: 220px;
      bottom: 44px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 72%);
      transform: translateY(30px);
      z-index: -1;
    }
  </style>
</head>
<body>
  <main class="mockup-canvas">
    <div class="grain"></div>
    <section class="set">
      <div class="caption">
        <h1>${escapeHtml(concept.brandName)}</h1>
        <p>${escapeHtml(concept.productName)} · product mock</p>
      </div>
      <div class="jar">
        <div class="cap"></div>
        <div class="label-window">
          <img src="${labelImageUrl}" alt="${escapeHtml(concept.brandName)} label" />
        </div>
        <div class="base-shadow"></div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function colorSwatch(color) {
  return `<span class="swatch" style="background:${color}"></span><span>${color}</span>`;
}

function renderBoardHtml(concept, labelImageUrl, mockupImageUrl, brandLogoImageUrl) {
  const fontsUrl = buildFontsUrl([concept.fonts.headline, concept.fonts.body]);
  const keywords = concept.board.moodKeywords.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('');
  const voicePillars = concept.board.voicePillars.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const proofPoints = concept.board.proofPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const proofColumns = brandLogoImageUrl ? '1fr 1fr 1fr' : '1fr 1fr';
  const logoProofHtml = brandLogoImageUrl
    ? `<div class="proof">
          <strong>Logo</strong>
          <img src="${brandLogoImageUrl}" alt="brand logo preview" />
        </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${BOARD_SIZE}, initial-scale=1" />
  <title>${escapeHtml(concept.brandName)} Brand Board</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontsUrl}" rel="stylesheet" />
  <style>
    :root {
      --paper: color-mix(in srgb, ${concept.palette.background} 88%, white 12%);
      --card: color-mix(in srgb, ${concept.palette.background} 76%, white 24%);
      --ink: ${concept.palette.text};
      --primary: ${concept.palette.primary};
      --secondary: ${concept.palette.secondary};
      --accent: ${concept.palette.accent};
      --border: color-mix(in srgb, ${concept.palette.border} 22%, white 78%);
      --headline: '${escapeHtml(concept.fonts.headline)}', serif;
      --body: '${escapeHtml(concept.fonts.body)}', sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html,
    body {
      width: ${BOARD_SIZE}px;
      height: ${BOARD_SIZE}px;
      overflow: hidden;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--body);
    }

    .brand-board {
      width: 100%;
      height: 100%;
      padding: 76px;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 40px;
      background:
        radial-gradient(circle at 8% 5%, rgba(255,255,255,0.72), transparent 32%),
        radial-gradient(circle at 94% 0%, rgba(255,255,255,0.4), transparent 26%),
        var(--paper);
    }

    .header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      padding-bottom: 22px;
    }

    .header h1 {
      font-family: var(--headline);
      font-size: 120px;
      line-height: 0.88;
      font-weight: 500;
      color: var(--primary);
      letter-spacing: -0.03em;
    }

    .header p {
      font-size: 28px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.8;
      margin-bottom: 6px;
    }

    .main {
      display: grid;
      grid-template-columns: 1fr 0.95fr;
      gap: 28px;
      min-height: 0;
    }

    .column {
      display: grid;
      gap: 22px;
      min-height: 0;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 26px;
      padding: 26px;
      box-shadow: 0 16px 36px rgba(0,0,0,0.06);
    }

    .card h2 {
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 14px;
      opacity: 0.8;
    }

    .positioning {
      font-family: var(--headline);
      font-size: 44px;
      line-height: 1.04;
      letter-spacing: -0.02em;
      color: color-mix(in srgb, var(--ink) 90%, black 10%);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }

    .chip {
      border-radius: 999px;
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--primary) 10%, white 90%);
      color: color-mix(in srgb, var(--primary) 85%, black 15%);
      font-size: 13px;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      padding: 8px 14px;
      font-weight: 600;
    }

    .list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 22px;
      font-size: 20px;
      line-height: 1.32;
    }

    .list ul {
      list-style: none;
      display: grid;
      gap: 10px;
    }

    .list li::before {
      content: '• ';
      color: var(--accent);
      font-weight: 700;
      margin-right: 6px;
    }

    .palette-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }

    .swatch-card {
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 12px;
      background: white;
      display: grid;
      gap: 10px;
      font-size: 14px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .swatch {
      width: 100%;
      height: 82px;
      border-radius: 10px;
      display: block;
      border: 1px solid color-mix(in srgb, var(--ink) 12%, white 88%);
    }

    .type-stack {
      display: grid;
      gap: 14px;
    }

    .type-row {
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 14px;
      background: white;
      display: grid;
      gap: 8px;
    }

    .type-row small {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.65;
    }

    .type-headline {
      font-family: var(--headline);
      font-size: 48px;
      line-height: 0.98;
      color: var(--primary);
    }

    .type-body {
      font-size: 18px;
      line-height: 1.35;
    }

    .proofs {
      display: grid;
      grid-template-columns: ${proofColumns};
      gap: 16px;
      min-height: 0;
    }

    .proof {
      border: 1px solid var(--border);
      border-radius: 18px;
      background: white;
      overflow: hidden;
      display: grid;
      grid-template-rows: auto 1fr;
    }

    .proof strong {
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
    }

    .proof img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      background: #f3f3f3;
    }
  </style>
</head>
<body>
  <main class="brand-board">
    <header class="header">
      <h1>${escapeHtml(concept.brandName)}</h1>
      <p>${escapeHtml(concept.tagline || concept.productName)}</p>
    </header>

    <section class="main">
      <div class="column">
        <article class="card">
          <h2>Positioning</h2>
          <p class="positioning">${escapeHtml(concept.board.positioning)}</p>
          <div class="chips">${keywords}</div>
        </article>

        <article class="card">
          <h2>Voice + Proof</h2>
          <div class="list">
            <ul>${voicePillars}</ul>
            <ul>${proofPoints}</ul>
          </div>
        </article>

        <article class="card" style="min-height:0;">
          <h2>Applied Assets</h2>
          <div class="proofs">
            ${logoProofHtml}
            <div class="proof">
              <strong>Label</strong>
              <img src="${labelImageUrl}" alt="label preview" />
            </div>
            <div class="proof">
              <strong>Mockup</strong>
              <img src="${mockupImageUrl}" alt="mockup preview" />
            </div>
          </div>
        </article>
      </div>

      <div class="column">
        <article class="card">
          <h2>Palette</h2>
          <div class="palette-grid">
            <div class="swatch-card">${colorSwatch(concept.palette.primary)}</div>
            <div class="swatch-card">${colorSwatch(concept.palette.secondary)}</div>
            <div class="swatch-card">${colorSwatch(concept.palette.accent)}</div>
            <div class="swatch-card">${colorSwatch(concept.palette.background)}</div>
            <div class="swatch-card">${colorSwatch(concept.palette.text)}</div>
            <div class="swatch-card">${colorSwatch(concept.palette.border)}</div>
          </div>
        </article>

        <article class="card">
          <h2>Typography</h2>
          <div class="type-stack">
            <div class="type-row">
              <small>${escapeHtml(concept.fonts.headline)} / headline</small>
              <div class="type-headline">${escapeHtml(concept.brandName)}</div>
            </div>
            <div class="type-row">
              <small>${escapeHtml(concept.fonts.body)} / body</small>
              <div class="type-body">${escapeHtml(concept.productName)} builds trust through high-clarity hierarchy and disciplined spacing.</div>
            </div>
          </div>
        </article>
      </div>
    </section>
  </main>
</body>
</html>`;
}

async function ensurePageReady(page) {
  await page.evaluate(async () => {
    const imgPromises = Array.from(document.images || []).map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            })
    );
    await Promise.all(imgPromises);
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  });
}

async function renderPng(browser, { html, width, height, selector, outPath }) {
  const page = await browser.newPage({
    viewport: {
      width,
      height,
    },
    deviceScaleFactor: 1,
  });

  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await ensurePageReady(page);

    if (selector) {
      const node = await page.$(selector);
      if (node) {
        await node.screenshot({ path: outPath, type: 'png' });
        return;
      }
    }

    await page.screenshot({ path: outPath, type: 'png' });
  } finally {
    await page.close();
  }
}

async function renderLabelPdf(browser, { html, outPath }) {
  const page = await browser.newPage({
    viewport: {
      width: LABEL_WIDTH,
      height: LABEL_HEIGHT,
    },
    deviceScaleFactor: 2,
  });

  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await ensurePageReady(page);

    const pdfScale = (5.5 * 96) / LABEL_WIDTH;
    await page.pdf({
      path: outPath,
      width: '5.5in',
      height: '2in',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale: pdfScale,
    });
  } finally {
    await page.close();
  }
}

async function fileToDataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png'
    ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg'
    ? 'image/jpeg'
    : ext === '.webp'
    ? 'image/webp'
    : ext === '.gif'
    ? 'image/gif'
    : ext === '.svg'
    ? 'image/svg+xml'
    : 'application/octet-stream';
  const bytes = await fs.readFile(filePath);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const configPath = path.resolve(process.cwd(), args.configPath);
  const outRoot = path.resolve(process.cwd(), args.outDir);

  const configRaw = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const concept = normalizeConcept(configRaw);
  const boardTemplateMode = concept.boardTemplateMode || 'cyborg';

  if (isCyborgLockedFlow(concept, boardTemplateMode)) {
    if (process.env.OPENCLAW_ALLOW_CYBORG_BASE !== '1') {
      throw new Error(
        'Base HTML generator is not allowed for Cyborg-locked concepts. Run with `npm run design:supplement -- --config <concept.json>` (recraft_v4 wrapper).'
      );
    }
  }

  const configDir = path.dirname(configPath);
  const brandLogoImageSrc = await resolveBrandLogoSource(concept.brandLogo, configDir);

  const runDir = path.join(outRoot, slugify(concept.conceptId), timestampSlug());
  await fs.mkdir(runDir, { recursive: true });

  const labelHtmlPath = path.join(runDir, 'label.html');
  const labelPngPath = path.join(runDir, 'label.png');
  const labelPdfPath = path.join(runDir, 'label.pdf');

  const mockHtmlPath = path.join(runDir, 'product-mock.html');
  const mockPngPath = path.join(runDir, 'product-mock.png');

  const boardHtmlPath = path.join(runDir, 'brand-board.html');
  const boardPngPath = path.join(runDir, 'brand-board.png');
  const brandLogoHtmlPath = path.join(runDir, 'brand-logo.html');
  const brandLogoPngPath = path.join(runDir, 'brand-logo.png');
  const boardSelector = boardSelectorForMode(boardTemplateMode);

  const conceptSnapshotPath = path.join(runDir, 'concept.input.json');
  const manifestPath = path.join(runDir, 'manifest.json');

  const labelHtml = renderLabelHtml(concept, brandLogoImageSrc);
  await fs.writeFile(labelHtmlPath, labelHtml, 'utf8');
  await fs.writeFile(conceptSnapshotPath, JSON.stringify(concept, null, 2), 'utf8');

  const browser = await chromium.launch({ headless: true });

  try {
    await renderPng(browser, {
      html: labelHtml,
      width: LABEL_WIDTH,
      height: LABEL_HEIGHT,
      selector: '.label-container',
      outPath: labelPngPath,
    });

    await renderLabelPdf(browser, {
      html: labelHtml,
      outPath: labelPdfPath,
    });

    const labelImageUrl = await fileToDataUri(labelPngPath);
    const mockupHtml = renderMockupHtml(concept, labelImageUrl);
    await fs.writeFile(mockHtmlPath, mockupHtml, 'utf8');

    await renderPng(browser, {
      html: mockupHtml,
      width: MOCKUP_SIZE,
      height: MOCKUP_SIZE,
      selector: '.mockup-canvas',
      outPath: mockPngPath,
    });

    const mockupImageUrl = await fileToDataUri(mockPngPath);
    const boardHtml = resolveBoardHtml(
      concept,
      boardTemplateMode,
      labelImageUrl,
      mockupImageUrl,
      brandLogoImageSrc
    );
    await fs.writeFile(boardHtmlPath, boardHtml, 'utf8');

    await renderPng(browser, {
      html: boardHtml,
      width: BOARD_SIZE,
      height: BOARD_SIZE,
      selector: boardSelector,
      outPath: boardPngPath,
    });

    const brandLogoHtml = renderBrandLogo(concept, brandLogoImageSrc);
    await fs.writeFile(brandLogoHtmlPath, brandLogoHtml, 'utf8');
    await renderPng(browser, {
      html: brandLogoHtml,
      width: 1200,
      height: 600,
      selector: '.logo-container',
      outPath: brandLogoPngPath,
    });
  } finally {
    await browser.close();
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    conceptId: concept.conceptId,
    sourceSpec: CYBORG_LABEL_TEMPLATE_PATH,
    outputs: {
      productMock: {
        html: mockHtmlPath,
        png: mockPngPath,
      },
      brandBoard: {
        html: boardHtmlPath,
        png: boardPngPath,
      },
      brandLogo: {
        html: brandLogoHtmlPath,
        png: brandLogoPngPath,
      },
      label: {
        html: labelHtmlPath,
        png: labelPngPath,
        pdf: labelPdfPath,
      },
    },
    checks: {
      labelDimensions: `${LABEL_WIDTH}x${LABEL_HEIGHT}`,
      labelIngredientRows: concept.label.ingredients.length,
      centerPanelWidthPx: 300,
      boardTemplateMode,
    },
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log('Supplement concept render complete:');
  console.log(`- brand board: ${boardPngPath}`);
  console.log(`- label: ${labelPngPath}`);
  console.log(`- product mock: ${mockPngPath}`);
  console.log(`- manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
