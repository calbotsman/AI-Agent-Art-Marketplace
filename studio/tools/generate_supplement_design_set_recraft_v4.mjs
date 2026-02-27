#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { renderMoodboardHtml } from './cyborg_brand_templates.mjs';

const LABEL_WIDTH = 1650;
const LABEL_HEIGHT = 600;
const MOCKUP_SIZE = 2048;
const BOARD_SIZE = 2048;
const DEFAULT_IMAGE_SIZE = '1024x1024';
const DEFAULT_RECRAFT_MODEL = 'recraft/recraft-v4';
const DEFAULT_GEMINI_IMAGE_MODEL = 'google/gemini-3-pro-image';
const MAX_PROMPT_CHARS = 1000;
const DEFAULT_RECRAFT_STYLE = 'vivid';
const AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';
const GEMINI_IMAGE_SCRIPT = path.join('/Users/calbotsman/clawd', 'skills', 'nano-banana-pro', 'scripts', 'generate_image.py');
const DATA_BOTTLE_ROOTS = [
  '/Users/calbotsman/clawd/data/bottles',
  '/Users/calbotsman/clawd/data/bottle',
];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const BASE_GENERATOR_PATH = path.join(SCRIPT_DIR, 'generate_supplement_design_set.mjs');
const DEFAULT_OUT_ROOT = path.join(WORKSPACE_ROOT, 'output', 'supplement-design');

function usage() {
  console.log(`Usage:
  node studio/tools/generate_supplement_design_set_recraft_v4.mjs --config <concept.json> [--out-dir <dir>] [--recraft-model <model>] [--recraft-style vivid|natural] [--allow-fallback-html]

Default behavior:
  - run base Cyborg-locked generator
  - require Recraft V4 via Vercel AI Gateway
  - rebuild product mock + brand board using Recraft imagery

If Recraft fails, the run fails unless --allow-fallback-html is set.
`);
}

function parseArgs(argv) {
  const args = {
    configPath: null,
    outDir: DEFAULT_OUT_ROOT,
    recraftModel: DEFAULT_RECRAFT_MODEL,
    recraftStyle: DEFAULT_RECRAFT_STYLE,
    allowFallbackHtml: false,
    recraftImageSize: DEFAULT_IMAGE_SIZE,
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
    if (arg === '--recraft-model') {
      args.recraftModel = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--recraft-style') {
      args.recraftStyle = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--recraft-image-size') {
      args.recraftImageSize = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--allow-fallback-html') {
      args.allowFallbackHtml = true;
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
  if (!/^\d+x\d+$/.test(args.recraftImageSize)) {
    throw new Error('Invalid --recraft-image-size. Expected format like 1024x1024.');
  }
  if (!['vivid', 'natural'].includes(args.recraftStyle)) {
    throw new Error('Invalid --recraft-style. Use vivid or natural.');
  }

  return args;
}

function parseEnvFile(content) {
  const env = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
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
    path.join(WORKSPACE_ROOT, '.env'),
    path.join(os.homedir(), '.openclaw', '.env'),
  ];

  for (const envPath of envPaths) {
    try {
      const content = await fs.readFile(envPath, 'utf8');
      const parsed = parseEnvFile(content);
      for (const [key, value] of Object.entries(parsed)) {
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    } catch {
      // Ignore missing env files.
    }
  }
}

function getAIGatewayKey() {
  return process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || '';
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeCssUrl(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '');
}

function buildFontsUrl(families) {
  const unique = [...new Set(families.filter(Boolean))];
  const query = unique
    .map((family) => `family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@300;400;500;600;700;800;900`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

function normalizeBoardTemplateMode(rawMode) {
  const normalized = String(rawMode || '').toLowerCase();
  if (normalized === 'legacy') {
    return 'legacy';
  }
  if (normalized === 'cyborg' || normalized === 'moodboard') {
    return 'cyborg';
  }

  return 'cyborg';
}

function normalizeBottleImageEngine(rawEngine) {
  const normalized = String(rawEngine || '').trim().toLowerCase();
  if (normalized === 'gemini' || normalized === 'google' || normalized === 'nanobanana' || normalized === 'nanobanana-pro') {
    return 'gemini';
  }
  if (normalized === 'reference' || normalized === 'source' || normalized === 'file') {
    return 'reference';
  }
  if (normalized === 'recraft-v4' || normalized === 'recraft') {
    return 'recraft';
  }
  return 'recraft';
}

function isCyborgLockedFlow(concept, boardTemplateMode) {
  const brandName = String(concept?.brandName || '').toLowerCase();
  const conceptId = String(concept?.conceptId || '').toLowerCase();
  const mode = String(boardTemplateMode || '').toLowerCase();
  const renderMode = String(concept?.render?.boardTemplateMode || '').toLowerCase();

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

function normalizeProductMockEngine(rawEngine) {
  const normalized = String(rawEngine || '').trim().toLowerCase();
  if (
    normalized === 'gemini-labeled-composition'
    || normalized === 'gemini-advanced-composition'
    || normalized === 'advanced-composition'
    || normalized === 'gemini-composition'
    || normalized === 'gemini'
  ) {
    return 'gemini-labeled-composition';
  }
  if (
    normalized === 'canvas-strip-perspective'
    || normalized === 'canvas'
    || normalized === 'strip'
    || normalized === 'strip-warp'
  ) {
    return 'canvas-strip-perspective';
  }
  return 'canvas-strip-perspective';
}

function boardSelectorForMode(mode) {
  return mode === 'legacy' ? '.brand-board' : '.moodboard-container';
}

function truncatePrompt(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, MAX_PROMPT_CHARS);
}

function resolveGeminiResolution(size) {
  const match = String(size || '').match(/^(\d+)x(\d+)$/i);
  if (!match) {
    return '1K';
  }

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  const maxDim = Math.max(width, height);

  if (maxDim >= 3000) {
    return '4K';
  }
  if (maxDim >= 1600) {
    return '2K';
  }
  return '1K';
}

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toTokens(value) {
  return [...new Set(
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  )];
}

function rankBottleCandidate(candidatePath, candidateIndex, tokens) {
  const stem = path.basename(candidatePath, path.extname(candidatePath)).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const candidateTokens = toTokens(stem);
  let score = 0;
  let exactMatch = 0;

  for (const token of tokens) {
    if (candidateTokens.includes(token)) {
      score += 3;
      exactMatch += 1;
      continue;
    }

    if (candidateTokens.some((candidateToken) => candidateToken.includes(token) || token.includes(candidateToken))) {
      score += 1;
    }
  }

  return {
    candidatePath,
    score,
    exactMatch,
    fallbackBias: candidateIndex === 0 ? 0.2 : 0,
  };
}

function clampNumber(value, fallback, min = -Infinity, max = Infinity) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  if (numeric < min || numeric > max) {
    return fallback;
  }
  return numeric;
}

function normalizeBottleMockupConfig(rawConfig = {}) {
  return {
    left: clampNumber(rawConfig.left, 0.34, 0, 1),
    top: clampNumber(rawConfig.top, 0.36, 0, 1),
    width: clampNumber(rawConfig.width, 0.35, 0.05, 0.9),
    maxHeight: clampNumber(rawConfig.maxHeight, 0.45, 0.15, 1),
    aspect: clampNumber(rawConfig.aspect, 1650 / 600, 1.2, 6),
    perspective: clampNumber(rawConfig.perspective, 0.20, 0, 0.95),
    perspectivePower: clampNumber(rawConfig.perspectivePower, 1.6, 0.2, 4),
    bulge: clampNumber(rawConfig.bulge, 0.06, 0, 0.25),
    warpAmp: clampNumber(rawConfig.warpAmp, 0.04, 0, 0.15),
    shadow: clampNumber(rawConfig.shadow, 0.28, 0, 1),
    highlight: clampNumber(rawConfig.highlight, 0.20, 0, 1),
    stripCount: Math.round(clampNumber(rawConfig.stripCount, 96, 24, 260)),
    frontOnly: Boolean(rawConfig.frontOnly),
    frontOffset: clampNumber(rawConfig.frontOffset, 0.25, 0, 0.8),
    frontWidth: clampNumber(rawConfig.frontWidth, 0.46, 0.12, 0.9),
    sourceFromReference: Boolean(rawConfig.sourceFromReference),
  };
}

function toInlineJsJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

async function findBottleCandidates() {
  const files = [];

  for (const root of DATA_BOTTLE_ROOTS) {
    let entries = [];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
        continue;
      }
      files.push(path.join(root, entry.name));
    }
  }

  files.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  return files;
}

async function resolveBottleImagePath(concept, conceptDir) {
  const explicit = concept?.render?.bottleReferenceImage
    || concept?.render?.bottleImage
    || concept?.render?.mock?.bottleImage
    || concept?.mock?.bottleImage
    || '';
  if (explicit) {
    const candidate = path.isAbsolute(explicit) ? explicit : path.resolve(conceptDir, explicit);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      return '';
    }
  }

  const candidates = await findBottleCandidates();
  if (candidates.length === 0) {
    return '';
  }

  const tokens = [
    ...toTokens(concept?.brandName),
    ...toTokens(concept?.productName),
    ...toTokens(concept?.conceptId),
  ];
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];

  let best = {
    candidatePath: candidates[0],
    score: -1,
    exactMatch: 0,
    fallbackBias: 0,
  };

  candidates.forEach((candidate, index) => {
    const ranked = rankBottleCandidate(candidate, index, uniqueTokens);
    const adjustedScore = ranked.score + ranked.fallbackBias;

    if (
      adjustedScore > (best.score + best.fallbackBias)
      || (adjustedScore === (best.score + best.fallbackBias) && ranked.exactMatch > best.exactMatch)
      || (
        adjustedScore === (best.score + best.fallbackBias)
        && ranked.exactMatch === best.exactMatch
        && index < candidates.indexOf(best.candidatePath)
      )
    ) {
      best = {
        candidatePath: candidate,
        score: ranked.score,
        exactMatch: ranked.exactMatch,
        fallbackBias: ranked.fallbackBias,
      };
    }
  });

  if (best.score > 0) {
    return best.candidatePath;
  }

  return candidates[0];
}

function buildBottleReferenceHint(referenceImagePath) {
  if (!referenceImagePath) {
    return '';
  }

  const stem = path.basename(referenceImagePath, path.extname(referenceImagePath)).toLowerCase();
  const tokens = toTokens(stem).filter((token) => token.length >= 4 && token !== 'product' && token !== 'hero' && token !== 'front');
  if (tokens.length === 0) {
    return 'Keep proportional influence only for body geometry and cap proportions.';
  }

  const topTokens = tokens.slice(0, 3);
  return `Keep proportional influence only for body geometry and cap proportions from ${topTokens.join(', ')}`;
}

function deriveBottlePrompt(concept, referenceImagePath) {
  const palette = concept.palette || {};
  const render = concept.render || {};
  const visualHint = buildBottleReferenceHint(referenceImagePath);
  const hint = visualHint ? ` ${visualHint}` : '';
  const antiGlass = 'dry matte finish, non-glass material, opaque body, no glass shine, no wetness, no condensation droplets, no reflections, no translucency, no water, no glare, no wet bottle artifacts';
  const hardGeometry = 'rigid pharmaceutical pill-bottle geometry, crisp label-bearing front panel, clean hard edges, studio centered front view';

  const defaultBottle = `isolated ${concept.brandName} ${concept.productName} premium supplement bottle, photorealistic 3d product shot, ${hardGeometry}, ${antiGlass}, no label, no text, no logo, no human hands, centered full-body view, soft and even studio light, white/neutral studio background, strict product photography composition`;
  return truncatePrompt(`${render.bottlePrompt || render.bottleImagePrompt || defaultBottle}${hint}`);
}

function deriveRecraftPrompts(concept, referenceImagePath = '') {
  const palette = concept.palette || {};
  const render = concept.render || {};
  const recraft = render.recraft || {};

  const defaultScene = `${concept.brandName} ${concept.productName} premium supplement campaign background plate, editorial photoreal studio lighting, clean center area for product composite, luxury but minimal, controlled shadows, colors anchored to ${palette.primary || '#1A1A1A'}, ${palette.secondary || '#D9D9D9'}, ${palette.accent || '#B1895C'}, no text, no logo, no bottle, no packaging, no watermark`;

  const defaultMood = `${concept.brandName} abstract brand mood texture, refined paper and metal gradients, high-end wellness aesthetic, restrained and scientific tone, colors anchored to ${palette.primary || '#1A1A1A'}, ${palette.secondary || '#D9D9D9'}, ${palette.accent || '#B1895C'}, no text, no product, no logo, no watermark`;

  return {
    scene: truncatePrompt(recraft.scenePrompt || defaultScene),
    mood: truncatePrompt(recraft.moodPrompt || defaultMood),
    bottle: deriveBottlePrompt(concept, referenceImagePath),
  };
}

function deriveGeminiAdvancedCompositionPrompt(concept, scenePrompt = '') {
  const render = concept.render || {};
  const explicit = String(
    render.geminiAdvancedCompositionPrompt
      || render.geminiMockupPrompt
      || render.mockupPrompt
      || ''
  ).trim();
  if (explicit) {
    return explicit;
  }

  const sceneDescription = String(
    render.geminiSceneDescription
      || render.mockupSceneDescription
      || scenePrompt
      || `${concept.brandName} ${concept.productName} centered studio hero product shot on a clean neutral background with soft, even lighting and clear label legibility.`
  ).replace(/\s+/g, ' ').trim();

  return [
    'CRITICAL LABEL PRESERVATION:',
    '- Use the label reference literally.',
    '- Preserve exact text, typography, layout, and colors.',
    '- Do not invent, replace, or alter any label wording.',
    '',
    'BOTTLE PRESERVATION:',
    '- Use bottle shape, cap, and camera perspective from bottle reference.',
    '',
    'PHYSICAL WRAP REQUIREMENTS:',
    '- Label must follow bottle curvature and perspective.',
    '- Match scene reflections/specular highlights.',
    '- Match lighting, contact shadows, and cast shadows.',
    '- Avoid pasted/cutout artifacts and sticker look.',
    '',
    'GENERATION TASK:',
    '- Create a new image by combining the references.',
    '- Take label from image 1 and apply it to bottle from image 2.',
    '- Keep product hero realism and clear label legibility.',
    '',
    'NEGATIVE CONSTRAINTS:',
    '- no rewritten text',
    '- no gibberish typography',
    '- no extra logos',
    '- no duplicate labels',
    '- no watermark',
    '- no flat sticker look',
    '',
    'SCENE RULE:',
    '- The scene description controls only environment/camera/lighting.',
    '- Do not restyle bottle or label from the scene description.',
    '',
    `SCENE DESCRIPTION: ${sceneDescription}`,
    'Output 1:1 aspect ratio.',
  ].join('\n');
}

async function fetchBinary(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 500)}`);
  }
  const bytes = await response.arrayBuffer();
  return Buffer.from(bytes);
}

async function ensureModelAvailable(apiKey, model) {
  const response = await fetch(`${AI_GATEWAY_BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Model check failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload?.data) ? payload.data : [];
  if (!models.some((entry) => entry?.id === model)) {
    throw new Error(`Model ${model} not found in AI Gateway model list`);
  }
}

async function generateRecraftImage({ apiKey, model, prompt, size, style }) {
  const finalPrompt = truncatePrompt(prompt);
  if (!finalPrompt) {
    throw new Error('Prompt is empty after normalization');
  }

  const response = await fetch(`${AI_GATEWAY_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: finalPrompt,
      n: 1,
      size,
      style,
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Recraft generation failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  const payload = await response.json();
  const first = Array.isArray(payload?.data) ? payload.data[0] : null;

  if (first?.b64_json) {
    return Buffer.from(first.b64_json, 'base64');
  }
  if (first?.url) {
    return fetchBinary(first.url);
  }

  throw new Error('Recraft response did not include image bytes');
}

async function generateGeminiImageDirect({
  apiKey,
  prompt,
  size,
  outputPath,
  inputImages = [],
}) {
  const finalPrompt = String(prompt || '').trim();
  if (!finalPrompt) {
    throw new Error('Gemini prompt is empty after normalization');
  }

  const resolution = resolveGeminiResolution(size);
  const command = [
    'run',
    GEMINI_IMAGE_SCRIPT,
    '--prompt',
    finalPrompt,
    '--filename',
    outputPath,
    '--resolution',
    resolution,
    '--api-key',
    apiKey,
  ];
  for (const imagePath of inputImages) {
    if (imagePath) {
      command.push('--input-image', imagePath);
    }
  }

  const result = spawnSync('uv', command, {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`Gemini image generation failed (${result.status}): ${detail.slice(0, 700)}`);
  }

  try {
    await fs.access(outputPath);
  } catch (error) {
    throw new Error(`Gemini generation completed but image not written: ${outputPath}`);
  }
}

function bufferFromDataUri(dataUri) {
  const match = String(dataUri || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  return Buffer.from(match[2], 'base64');
}

async function extractImageBytesFromGatewayResponse(payload) {
  const messageOutput = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of messageOutput) {
    if (item?.type !== 'message' || !Array.isArray(item?.content)) {
      continue;
    }
    for (const content of item.content) {
      if (content?.type !== 'output_image') {
        continue;
      }
      const outputUrl = content?.image_url?.url || '';
      if (!outputUrl) {
        continue;
      }
      const fromDataUri = bufferFromDataUri(outputUrl);
      if (fromDataUri) {
        return fromDataUri;
      }
      if (/^https?:\/\//i.test(outputUrl)) {
        return fetchBinary(outputUrl);
      }
    }
  }

  const first = Array.isArray(payload?.data) ? payload.data[0] : null;
  if (first?.b64_json) {
    return Buffer.from(first.b64_json, 'base64');
  }
  if (first?.url) {
    return fetchBinary(first.url);
  }

  return null;
}

async function generateGeminiImageViaGateway({
  apiKey,
  model,
  prompt,
  outputPath,
  inputImages = [],
}) {
  const finalPrompt = String(prompt || '').trim();
  if (!finalPrompt) {
    throw new Error('Gemini prompt is empty after normalization');
  }

  const contents = [{ type: 'input_text', text: finalPrompt }];
  for (const imagePath of inputImages) {
    if (!imagePath) {
      continue;
    }
    const imageDataUri = await fileToDataUri(imagePath);
    contents.push({
      type: 'input_image',
      image_url: imageDataUri,
    });
  }

  const response = await fetch(`${AI_GATEWAY_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: contents,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini gateway generation failed (${response.status}): ${detail.slice(0, 700)}`);
  }

  const payload = await response.json();
  const imageBytes = await extractImageBytesFromGatewayResponse(payload);
  if (!imageBytes) {
    throw new Error('Gemini gateway response did not include image bytes');
  }

  await fs.writeFile(outputPath, imageBytes);
}

async function generateGeminiImage({
  prompt,
  size,
  outputPath,
  inputImages = [],
  model = DEFAULT_GEMINI_IMAGE_MODEL,
  directApiKey = '',
  gatewayApiKey = '',
}) {
  if (directApiKey) {
    return generateGeminiImageDirect({
      apiKey: directApiKey,
      prompt,
      size,
      outputPath,
      inputImages,
    });
  }

  if (gatewayApiKey) {
    return generateGeminiImageViaGateway({
      apiKey: gatewayApiKey,
      model,
      prompt,
      outputPath,
      inputImages,
    });
  }

  throw new Error('Missing Gemini credentials: provide GEMINI_API_KEY or VERCEL_AI_GATEWAY_KEY');
}

function bytesToDataUri(bytes, mime = 'image/png') {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
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
  return bytesToDataUri(bytes, mime);
}

function findManifestPathFromStdout(stdout) {
  const match = stdout.match(/^- manifest:\s+(.+)$/m);
  if (!match) {
    throw new Error('Could not parse manifest path from base generator output');
  }
  return match[1].trim();
}

function runBaseGenerator(configPath, outDir) {
  const result = spawnSync(process.execPath, [BASE_GENERATOR_PATH, '--config', configPath, '--out-dir', outDir], {
    cwd: WORKSPACE_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENCLAW_ALLOW_CYBORG_BASE: '1',
    },
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`Base generator failed:\n${output}`);
  }

  return {
    manifestPath: findManifestPathFromStdout(result.stdout || ''),
    output: result.stdout || '',
  };
}

async function backupAsset(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    return null;
  }

  const ext = path.extname(filePath);
  const stem = filePath.slice(0, -ext.length);
  const backupPath = `${stem}.base${ext}`;
  await fs.rename(filePath, backupPath);
  return backupPath;
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

async function renderPng(browser, { html, width, height, selector, outPath, waitForMockupSignal = false }) {
  const page = await browser.newPage({
    viewport: {
      width,
      height,
    },
    deviceScaleFactor: 1,
  });

  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    if (waitForMockupSignal) {
      try {
        await page.waitForFunction('window.__supplementMockupRendered === true', { timeout: 20000 });
      } catch (error) {
        // The rendering signal can fail under heavy GPU/image scheduling; continue after a short settle delay.
        await page.waitForTimeout(250);
      }
    }
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

function renderRecraftMockupHtml(concept, labelImageUrl, sceneImageUrl, bottleImageUrl = '', bottleMockupConfig = {}) {
  const fontsUrl = buildFontsUrl([concept.fonts?.headline || 'Cormorant Garamond', concept.fonts?.body || 'Inter']);
  const primary = concept.palette?.primary || '#1E2A5C';
  const secondary = concept.palette?.secondary || '#D8DDE8';
  const accent = concept.palette?.accent || '#B88C4A';
  const brandName = concept.brandName || 'Brand';
  const productName = concept.productName || 'Product';
  const useBottle = !!bottleImageUrl;
  const inlineBottleMockupConfig = toInlineJsJson(normalizeBottleMockupConfig(bottleMockupConfig));

  const mockupBody = useBottle
    ? `      <div class="bottle-scene">
        <canvas class="bottle-composite" aria-label="${escapeHtml(brandName)} ${escapeHtml(productName)} bottle mockup canvas"></canvas>
      </div>`
    : `      <div class="jar">
        <div class="cap"></div>
        <div class="label-window">
          <img src="${labelImageUrl}" alt="${escapeHtml(brandName)} label" />
        </div>
        <div class="base-shadow"></div>
      </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${MOCKUP_SIZE}, initial-scale=1" />
  <title>${escapeHtml(brandName)} Recraft Product Mock</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontsUrl}" rel="stylesheet" />
  <style>
    :root {
      --ink: ${primary};
      --support: ${secondary};
      --accent: ${accent};
      --headline: '${escapeHtml(concept.fonts?.headline || 'Cormorant Garamond')}', serif;
      --body: '${escapeHtml(concept.fonts?.body || 'Inter')}', sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: ${MOCKUP_SIZE}px;
      height: ${MOCKUP_SIZE}px;
      overflow: hidden;
      font-family: var(--body);
    }

    .mockup-canvas {
      width: ${MOCKUP_SIZE}px;
      height: ${MOCKUP_SIZE}px;
      position: relative;
      display: grid;
      place-items: center;
      color: #f4f2ee;
      background:
        radial-gradient(circle at 12% 12%, rgba(255,255,255,0.36), transparent 28%),
        radial-gradient(circle at 88% 5%, rgba(255,255,255,0.24), transparent 24%),
        linear-gradient(180deg, rgba(6, 10, 24, 0.16) 0%, rgba(6, 10, 24, 0.44) 100%),
        url("${escapeCssUrl(sceneImageUrl)}") center / cover no-repeat;
    }

    .set {
      width: 1640px;
      height: 1600px;
      position: relative;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 22px;
      align-items: end;
    }

    .caption {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 56px;
      letter-spacing: 0.04em;
      text-shadow: 0 3px 12px rgba(0,0,0,0.3);
    }

    .caption h1 {
      font-family: var(--headline);
      font-size: 94px;
      line-height: 0.95;
      font-weight: 500;
    }

    .caption p {
      font-size: 22px;
      opacity: 0.9;
    }

    .jar, .bottle-scene {
      position: relative;
      margin: 0 auto;
      width: 1480px;
      height: 1240px;
      border-radius: ${useBottle ? '0' : '170px 170px 120px 120px'};
      ${useBottle
        ? 'border-radius: 0; background: none; box-shadow: none;'
        : `background:
          linear-gradient(180deg,
            color-mix(in srgb, var(--ink) 82%, white 18%) 0%,
            color-mix(in srgb, var(--ink) 88%, black 12%) 68%,
            color-mix(in srgb, var(--ink) 72%, black 28%) 100%);
        box-shadow:
          0 90px 140px rgba(0,0,0,0.4),
          inset 0 1px 0 rgba(255,255,255,0.2),
          inset 0 -28px 64px rgba(0,0,0,0.22);`}
      overflow: hidden;
      ${useBottle ? 'display: grid; place-items: center; justify-items: center;' : ''}
    }

    .cap {
      ${useBottle ? 'display: none;' : ''}
      position: absolute;
      top: -74px;
      left: 120px;
      width: 1240px;
      height: 168px;
      border-radius: 84px;
      background:
        linear-gradient(180deg,
          color-mix(in srgb, var(--accent) 68%, white 32%) 0%,
          color-mix(in srgb, var(--accent) 86%, black 14%) 100%);
      box-shadow:
        0 18px 34px rgba(0,0,0,0.28),
        inset 0 1px 0 rgba(255,255,255,0.55);
    }

    .label-window {
      ${useBottle ? 'display: none;' : ''}
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
      ${useBottle ? 'display: none;' : ''}
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, rgba(0,0,0,0.24) 0%, transparent 16%, transparent 84%, rgba(0,0,0,0.24) 100%),
        linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 34%, rgba(0,0,0,0.14) 100%);
      pointer-events: none;
      mix-blend-mode: multiply;
    }

    .base-shadow {
      ${useBottle ? 'display: none;' : ''}
      position: absolute;
      width: 1040px;
      height: 220px;
      left: 220px;
      bottom: 44px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 72%);
      transform: translateY(30px);
      z-index: -1;
    }

    .bottle-composite {
      width: 100%;
      height: 100%;
      display: block;
      position: relative;
      z-index: 1;
      filter: drop-shadow(0 60px 80px rgba(0, 0, 0, 0.18));
    }
  </style>
</head>
<body>
  <main class="mockup-canvas">
    <section class="set">
      <div class="caption">
        <h1>${escapeHtml(brandName)}</h1>
        <p>${escapeHtml(productName)} · recraft v4 product mock</p>
      </div>
${mockupBody}
    </section>
  </main>
  <script>
    (function () {
      const useBottle = ${useBottle ? 'true' : 'false'};
      window.__supplementMockupRendered = false;
      if (!useBottle) {
        window.__supplementMockupRendered = true;
        return;
      }

      const config = ${inlineBottleMockupConfig};
      const composite = document.querySelector('.bottle-composite');
      if (!composite) {
        window.__supplementMockupRendered = true;
        window.__supplementMockupError = 'missingComposite';
        return;
      }

      function markMockupRendered(error) {
        window.__supplementMockupError = error || '';
        window.__supplementMockupRendered = true;
      }

      const labelSrc = ${toInlineJsJson(labelImageUrl)};
      const bottleSrc = ${toInlineJsJson(bottleImageUrl)};

      function loadImage(src) {
        return new Promise((resolve) => {
          let settled = false;
          const img = new Image();
          const settle = (value) => {
            if (settled) {
              return;
            }
            settled = true;
            resolve(value);
          };

          img.decoding = 'async';
          img.onload = () => settle(img);
          img.onerror = () => settle(null);
          img.src = src;
          setTimeout(() => settle(null), 8000);
        });
      }

      function drawLabelOnBottle(ctx, bottleImage, labelImage) {
        const { width: containerWidth, height: containerHeight } = composite.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const outWidth = Math.max(1, Math.round(containerWidth * dpr));
        const outHeight = Math.max(1, Math.round(containerHeight * dpr));
        composite.width = outWidth;
        composite.height = outHeight;
        const targetW = containerWidth * config.width;
        const targetHBase = targetW / config.aspect;
        const targetH = Math.min(containerHeight * config.maxHeight, targetHBase);
        const targetX = Math.max(0, Math.min(containerWidth - targetW, containerWidth * config.left));
        const targetY = Math.max(0, Math.min(containerHeight - targetH, containerHeight * config.top));

        const scaleX = outWidth / containerWidth;
        const scaleY = outHeight / containerHeight;
        const cx = containerWidth * 0.5;
        const cy = containerHeight * 0.5;

        ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
        ctx.clearRect(0, 0, containerWidth, containerHeight);

        if (bottleImage) {
          ctx.drawImage(bottleImage, 0, 0, containerWidth, containerHeight);
        }

        if (!labelImage) {
          return;
        }

        const baseSourceWidth = Math.max(1, labelImage.naturalWidth);
        const baseSourceHeight = Math.max(1, labelImage.naturalHeight);
        const stripBaseY = targetY;
        const fullStripCount = Math.max(24, config.stripCount || 96);
        const useFrontOnly = Boolean(config.frontOnly);
        const frontWidth = Math.min(0.95, Math.max(0.08, useFrontOnly ? config.frontWidth : 1));
        const frontOffset = useFrontOnly ? Math.min(0.8, Math.max(0, config.frontOffset)) : 0;
        const stripCount = useFrontOnly
          ? Math.max(6, Math.round(fullStripCount * frontWidth))
          : fullStripCount;
        const frontSourceWidth = Math.max(1, Math.floor(baseSourceWidth * frontWidth));
        const frontSourceStart = useFrontOnly
          ? Math.floor((baseSourceWidth - frontSourceWidth) * frontOffset)
          : 0;
        const sourceSlice = frontSourceWidth / stripCount;
        const frontTargetW = targetW * frontWidth;
        const frontTargetX = useFrontOnly ? (targetX + (targetW - frontTargetW) * 0.5) : targetX;
        const baseStripWidth = frontTargetW / stripCount;

        for (let i = 0; i < stripCount; i += 1) {
          const t = (i + 0.5) / stripCount;
          const edge = Math.abs(0.5 - t) * 2;
          const perspective = 1 - (config.perspective || 0) * Math.pow(edge, config.perspectivePower || 1.6);
          const bulge = 1 + (config.bulge || 0) * Math.sin(Math.PI * t);
          const stripWidth = baseStripWidth * perspective * bulge;
          const stripHeight = targetH * (0.82 + (1 - edge) * 0.18);
          const sourceSliceStart = Math.floor(i * sourceSlice);
          const sourceSliceEnd = Math.floor((i + 1) * sourceSlice);
          const sourceW = Math.max(1, sourceSliceEnd - sourceSliceStart);
          const sourceX = Math.min(baseSourceWidth - 1, frontSourceStart + sourceSliceStart);
          const destX = frontTargetX + baseStripWidth * i + (baseStripWidth - stripWidth) * 0.5;
          const warpY = (config.warpAmp || 0) * targetH * (Math.sin(Math.PI * t) - 0.5);
          const destY = stripBaseY + warpY;

          ctx.globalAlpha = 0.94 + 0.06 * (1 - edge);
          ctx.drawImage(
            labelImage,
            sourceX,
            0,
            sourceW,
            baseSourceHeight,
            destX,
            destY,
            stripWidth,
            stripHeight
          );
        }

        const sideShade = ctx.createLinearGradient(frontTargetX, targetY, frontTargetX + frontTargetW, targetY);
        sideShade.addColorStop(0, 'rgba(0, 0, 0, ' + Math.min(1, Math.max(0.06, (config.shadow || 0) + 0.06)) + ')');
        sideShade.addColorStop(0.18, 'rgba(0, 0, 0, 0)');
        sideShade.addColorStop(0.82, 'rgba(0, 0, 0, 0)');
        sideShade.addColorStop(1, 'rgba(0, 0, 0, ' + Math.min(1, Math.max(0.08, (config.shadow || 0) + 0.08)) + ')');

        const topShade = ctx.createLinearGradient(frontTargetX, targetY, frontTargetX, targetY + targetH);
        topShade.addColorStop(0, 'rgba(255, 255, 255, ' + Math.min(1, Math.max(0, config.highlight || 0) * 0.8) + ')');
        topShade.addColorStop(0.28, 'rgba(255, 255, 255, 0)');
        topShade.addColorStop(0.72, 'rgba(0, 0, 0, ' + Math.min(0.22, (config.highlight || 0) * 0.6) + ')');
        topShade.addColorStop(1, 'rgba(0, 0, 0, ' + Math.min(0.22, (config.shadow || 0) * 0.45) + ')');

        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = sideShade;
        ctx.fillRect(frontTargetX, targetY, frontTargetW, targetH);

        ctx.globalAlpha = 0.28;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = topShade;
        ctx.fillRect(frontTargetX, targetY, frontTargetW, targetH);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      Promise.all([loadImage(bottleSrc), loadImage(labelSrc)]).then(([bottleImage, labelImage]) => {
        const ctx = composite.getContext('2d');
        if (ctx) {
          drawLabelOnBottle(ctx, bottleImage, labelImage);
        }
        markMockupRendered();
      }).catch((error) => {
        markMockupRendered(error && error.message ? error.message : 'compositeRenderError');
      });
    })();
  </script>
</body>
</html>`;
}

function renderRecraftBoardHtml(concept, labelImageUrl, mockupImageUrl, moodImageUrl, brandLogoImageUrl) {
  const fontsUrl = buildFontsUrl([concept.fonts?.headline || 'Cormorant Garamond', concept.fonts?.body || 'Inter']);
  const primary = concept.palette?.primary || '#1E2A5C';
  const secondary = concept.palette?.secondary || '#D8DDE8';
  const accent = concept.palette?.accent || '#B88C4A';
  const background = concept.palette?.background || '#F7F5F1';
  const text = concept.palette?.text || '#1B1D22';

  const moodKeywords = Array.isArray(concept.board?.moodKeywords) ? concept.board.moodKeywords : [];
  const voicePillars = Array.isArray(concept.board?.voicePillars) ? concept.board.voicePillars : [];
  const proofPoints = Array.isArray(concept.board?.proofPoints) ? concept.board.proofPoints : [];

  const chips = moodKeywords.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('');
  const voiceHtml = voicePillars.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const proofHtml = proofPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
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
  <title>${escapeHtml(concept.brandName)} Recraft Brand Board</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontsUrl}" rel="stylesheet" />
  <style>
    :root {
      --paper: color-mix(in srgb, ${background} 86%, white 14%);
      --card: color-mix(in srgb, ${background} 76%, white 24%);
      --ink: ${text};
      --primary: ${primary};
      --secondary: ${secondary};
      --accent: ${accent};
      --border: color-mix(in srgb, ${primary} 22%, white 78%);
      --headline: '${escapeHtml(concept.fonts?.headline || 'Cormorant Garamond')}', serif;
      --body: '${escapeHtml(concept.fonts?.body || 'Inter')}', sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: ${BOARD_SIZE}px;
      height: ${BOARD_SIZE}px;
      overflow: hidden;
      color: var(--ink);
      font-family: var(--body);
      background: var(--paper);
    }

    .brand-board {
      width: 100%;
      height: 100%;
      padding: 76px;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 40px;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(9,12,21,0.08) 100%),
        url("${escapeCssUrl(moodImageUrl)}") center / cover no-repeat;
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
      text-shadow: 0 4px 14px rgba(255,255,255,0.6);
    }

    .header p {
      font-size: 28px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.82;
      margin-bottom: 6px;
      color: color-mix(in srgb, var(--ink) 76%, white 24%);
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
      background: color-mix(in srgb, var(--card) 84%, white 16%);
      border: 1px solid var(--border);
      border-radius: 26px;
      padding: 26px;
      box-shadow: 0 16px 36px rgba(0,0,0,0.08);
      backdrop-filter: blur(6px);
    }

    .card h2 {
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 14px;
      opacity: 0.82;
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
      color: color-mix(in srgb, var(--primary) 86%, black 14%);
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

    .proofs {
      display: grid;
      grid-template-columns: ${proofColumns};
      gap: 16px;
      min-height: 0;
    }

    .proof {
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(255,255,255,0.92);
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

    .palette-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }

    .swatch-card {
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 12px;
      background: rgba(255,255,255,0.94);
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
      background: rgba(255,255,255,0.94);
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
          <p class="positioning">${escapeHtml(concept.board?.positioning || '')}</p>
          <div class="chips">${chips}</div>
        </article>

        <article class="card">
          <h2>Voice + Proof</h2>
          <div class="list">
            <ul>${voiceHtml}</ul>
            <ul>${proofHtml}</ul>
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
            <div class="swatch-card"><span class="swatch" style="background:${primary}"></span><span>${primary}</span></div>
            <div class="swatch-card"><span class="swatch" style="background:${secondary}"></span><span>${secondary}</span></div>
            <div class="swatch-card"><span class="swatch" style="background:${accent}"></span><span>${accent}</span></div>
            <div class="swatch-card"><span class="swatch" style="background:${background}"></span><span>${background}</span></div>
            <div class="swatch-card"><span class="swatch" style="background:${text}"></span><span>${text}</span></div>
            <div class="swatch-card"><span class="swatch" style="background:${concept.palette?.border || primary}"></span><span>${concept.palette?.border || primary}</span></div>
          </div>
        </article>

        <article class="card">
          <h2>Typography</h2>
          <div class="type-stack">
            <div class="type-row">
              <small>${escapeHtml(concept.fonts?.headline || 'Cormorant Garamond')} / headline</small>
              <div class="type-headline">${escapeHtml(concept.brandName)}</div>
            </div>
            <div class="type-row">
              <small>${escapeHtml(concept.fonts?.body || 'Inter')} / body</small>
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

function resolveBoardHtml(mode, concept, labelImageUrl, mockupImageUrl, moodImageUrl, brandLogoImageUrl) {
  if (mode === 'legacy') {
    return renderRecraftBoardHtml(concept, labelImageUrl, mockupImageUrl, moodImageUrl, brandLogoImageUrl);
  }

  return renderMoodboardHtml({
    concept,
    labelImageUrl,
    mockupImageUrl,
    moodImageUrl,
    logoImageUrl: brandLogoImageUrl || '',
    googleFontsUrl: buildFontsUrl([concept.fonts?.headline || 'Cormorant Garamond', concept.fonts?.body || 'Inter']),
  });
}

function relPath(value) {
  return path.relative(WORKSPACE_ROOT, value) || value;
}

async function removeIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup misses (file may not exist if creation failed early).
  }
}

async function removeCyborgBaseArtifacts(runDir) {
  let entries = [];
  try {
    entries = await fs.readdir(runDir, { withFileTypes: true });
  } catch {
    return;
  }

  const removals = entries
    .filter((entry) => entry.isFile() && entry.name.includes('.base.'))
    .map((entry) => removeIfExists(path.join(runDir, entry.name)));

  if (removals.length > 0) {
    await Promise.all(removals);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  await loadLocalEnvFiles();

  const configPath = path.resolve(process.cwd(), args.configPath);
  const outDir = path.resolve(process.cwd(), args.outDir);
  const sourceConceptText = await fs.readFile(configPath, 'utf8');
  const sourceConcept = JSON.parse(sourceConceptText);
  const sourceBoardTemplateMode = normalizeBoardTemplateMode(
    sourceConcept.render?.boardTemplateMode || sourceConcept.board?.templateMode || sourceConcept.boardTemplateMode
  );
  const isSourceCyborgLockedFlow = isCyborgLockedFlow(sourceConcept, sourceBoardTemplateMode);

  if (isSourceCyborgLockedFlow && !args.allowFallbackHtml) {
    const strictApiKey = getAIGatewayKey();
    if (!strictApiKey) {
      throw new Error('Recraft V4 required but unavailable: Missing VERCEL_AI_GATEWAY_KEY (or AI_GATEWAY_API_KEY) for Cyborg flow');
    }
    const strictRecraftModel = sourceConcept.render?.recraftModel || args.recraftModel;
    try {
      await ensureModelAvailable(strictApiKey, strictRecraftModel);
    } catch (error) {
      throw new Error(`Recraft V4 required but unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const base = runBaseGenerator(configPath, outDir);
  const manifestPath = path.resolve(WORKSPACE_ROOT, base.manifestPath);
  const runDir = path.dirname(manifestPath);

  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const conceptPath = path.join(runDir, 'concept.input.json');
  const concept = JSON.parse(await fs.readFile(conceptPath, 'utf8'));

  const labelPngPath = path.join(runDir, 'label.png');
  const mockHtmlPath = path.join(runDir, 'product-mock.html');
  const mockPngPath = path.join(runDir, 'product-mock.png');
  const boardHtmlPath = path.join(runDir, 'brand-board.html');
  const boardPngPath = path.join(runDir, 'brand-board.png');
  const scenePngPath = path.join(runDir, 'recraft-scene.png');
  const moodPngPath = path.join(runDir, 'recraft-mood.png');
  const boardTemplateMode = normalizeBoardTemplateMode(
    concept.render?.boardTemplateMode || concept.board?.templateMode || concept.boardTemplateMode
  );
  const boardSelector = boardSelectorForMode(boardTemplateMode);
  const cyborgLockedFlow = isCyborgLockedFlow(concept, boardTemplateMode);
  const conceptConfigDir = path.dirname(conceptPath);
  const bottleReferenceImagePath = await resolveBottleImagePath(concept, conceptConfigDir);
  const prompts = deriveRecraftPrompts(concept, bottleReferenceImagePath);
  const recraftModel = concept.render?.recraftModel || args.recraftModel;
  const geminiImageModel = concept.render?.geminiImageModel || DEFAULT_GEMINI_IMAGE_MODEL;
  const recraftImageSize = concept.render?.recraftImageSize || args.recraftImageSize;
  const recraftStyle = concept.render?.recraftStyle || args.recraftStyle;
  const bottlePngPath = path.join(runDir, 'bottle.png');
  const explicitBottleMockup = concept.render?.bottleMockup || {};
  const explicitLegacyBottleMockup = concept.render?.mockup?.bottleMockup || {};
  const hasExplicitSourceFromReference = Object.prototype.hasOwnProperty.call(explicitBottleMockup, 'sourceFromReference')
    || Object.prototype.hasOwnProperty.call(explicitLegacyBottleMockup, 'sourceFromReference');
  const requestedBottleImageEngine = normalizeBottleImageEngine(
    concept.render?.bottleImageEngine
    || concept.render?.mockup?.bottleImageEngine
    || concept.render?.bottle?.imageEngine
    || concept.render?.bottle?.engine
  );
  const requestedProductMockEngine = normalizeProductMockEngine(
    concept.render?.productMockEngine
    || concept.render?.mockupEngine
    || concept.render?.mockup?.engine
    || concept.render?.bottleMockup?.engine
  );
  const productMockEngine = cyborgLockedFlow
    ? 'gemini-labeled-composition'
    : requestedProductMockEngine;
  const bottleImageEngine = cyborgLockedFlow && requestedBottleImageEngine === 'recraft'
    ? 'gemini'
    : requestedBottleImageEngine;
  const productMockEngineWasForced = cyborgLockedFlow && requestedProductMockEngine !== 'gemini-labeled-composition';

  const bottleMockupConfig = normalizeBottleMockupConfig({
    ...explicitBottleMockup,
    ...explicitLegacyBottleMockup,
  });
  if (!hasExplicitSourceFromReference) {
    if (bottleImageEngine === 'reference' && bottleReferenceImagePath) {
      bottleMockupConfig.sourceFromReference = true;
    } else if (bottleImageEngine === 'gemini') {
      bottleMockupConfig.sourceFromReference = false;
    } else if (bottleReferenceImagePath) {
      bottleMockupConfig.sourceFromReference = true;
    } else {
      bottleMockupConfig.sourceFromReference = false;
    }
  }

  let recraftError = null;
  let recraftUsed = false;
  let bottleSourceMode = 'recraft';
  let productMockMethodUsed = 'canvas-strip-perspective';
  const allowFallbackHtml = args.allowFallbackHtml && !cyborgLockedFlow;

  try {
    const apiKey = getAIGatewayKey();
    if (!apiKey) {
      throw new Error('Missing VERCEL_AI_GATEWAY_KEY (or AI_GATEWAY_API_KEY) for Recraft V4 generation');
    }

    await ensureModelAvailable(apiKey, recraftModel);

    const sceneBytes = await generateRecraftImage({
      apiKey,
      model: recraftModel,
      prompt: prompts.scene,
      size: recraftImageSize,
      style: recraftStyle,
    });
    await fs.writeFile(scenePngPath, sceneBytes);

    const moodBytes = await generateRecraftImage({
      apiKey,
      model: recraftModel,
      prompt: prompts.mood,
      size: recraftImageSize,
      style: recraftStyle,
    });
    await fs.writeFile(moodPngPath, moodBytes);

    const useReferenceBottle = Boolean(bottleMockupConfig.sourceFromReference && bottleReferenceImagePath);
    let bottleSourceConfigured = 'recraft';
    if (bottleImageEngine === 'reference') {
      bottleSourceConfigured = 'referenceImage';
    } else if (bottleImageEngine === 'gemini') {
      bottleSourceConfigured = 'gemini';
    }
    bottleSourceMode = useReferenceBottle ? 'referenceImage' : bottleSourceConfigured;

    if (useReferenceBottle) {
      await fs.copyFile(bottleReferenceImagePath, bottlePngPath);
    } else if (bottleImageEngine === 'gemini') {
      await generateGeminiImage({
        prompt: prompts.bottle,
        size: recraftImageSize,
        outputPath: bottlePngPath,
        model: geminiImageModel,
        directApiKey: getGeminiApiKey(),
        gatewayApiKey: getAIGatewayKey(),
      });
    } else {
      const bottleBytes = await generateRecraftImage({
        apiKey,
        model: recraftModel,
        prompt: prompts.bottle,
        size: recraftImageSize,
        style: recraftStyle,
      });
      await fs.writeFile(bottlePngPath, bottleBytes);
    }

    const labelImageUrl = await fileToDataUri(labelPngPath);
    const sceneImageUrl = bytesToDataUri(sceneBytes);
    const moodImageUrl = bytesToDataUri(moodBytes);
    const bottleImageForMockPath = useReferenceBottle ? bottleReferenceImagePath : bottlePngPath;
    const bottleImageUrl = bottleImageForMockPath ? await fileToDataUri(bottleImageForMockPath) : '';
    const brandLogoSource = String(concept.brandLogo?.source || '').trim();
    const resolvedBrandLogoSource = brandLogoSource
      ? path.isAbsolute(brandLogoSource)
        ? brandLogoSource
        : path.resolve(conceptConfigDir, brandLogoSource)
      : '';
    const brandLogoImageUrl = resolvedBrandLogoSource ? await fileToDataUri(resolvedBrandLogoSource).catch(() => null) : null;

    const browser = await chromium.launch({ headless: true });
    try {
      await backupAsset(mockHtmlPath);
      await backupAsset(mockPngPath);

      if (productMockEngine === 'gemini-labeled-composition') {
        if (!bottleImageForMockPath) {
          throw new Error('No bottle reference available for gemini-labeled-composition product mock rendering');
        }

        const geminiCompositionPrompt = deriveGeminiAdvancedCompositionPrompt(concept, prompts.scene);
        await generateGeminiImage({
          prompt: geminiCompositionPrompt,
          size: recraftImageSize,
          outputPath: mockPngPath,
          inputImages: [labelPngPath, bottleImageForMockPath],
          model: geminiImageModel,
          directApiKey: getGeminiApiKey(),
          gatewayApiKey: getAIGatewayKey(),
        });

        // Gemini composition is already a single rendered artifact; keep only the PNG
        // to avoid confusion with older HTML mockup workflows.
        await removeIfExists(mockHtmlPath);
        productMockMethodUsed = 'gemini-labeled-composition';
      } else {
        const mockHtml = renderRecraftMockupHtml(
          concept,
          labelImageUrl,
          sceneImageUrl,
          bottleImageUrl,
          bottleMockupConfig
        );
        await fs.writeFile(mockHtmlPath, mockHtml, 'utf8');
        await renderPng(browser, {
          html: mockHtml,
          width: MOCKUP_SIZE,
          height: MOCKUP_SIZE,
          selector: '.mockup-canvas',
          outPath: mockPngPath,
          waitForMockupSignal: true,
        });
        productMockMethodUsed = 'canvas-strip-perspective';
      }

      const mockImageUrl = await fileToDataUri(mockPngPath);
      const boardHtml = resolveBoardHtml(
        boardTemplateMode,
        concept,
        labelImageUrl,
        mockImageUrl,
        moodImageUrl,
        brandLogoImageUrl
      );
      await backupAsset(boardHtmlPath);
      await backupAsset(boardPngPath);
      await fs.writeFile(boardHtmlPath, boardHtml, 'utf8');
      await renderPng(browser, {
        html: boardHtml,
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        selector: boardSelector,
        outPath: boardPngPath,
      });
    } finally {
      await browser.close();
    }

    recraftUsed = true;
  } catch (error) {
    recraftError = error instanceof Error ? error.message : String(error);
    if (!allowFallbackHtml) {
      await Promise.all([
        removeIfExists(mockHtmlPath),
        removeIfExists(mockPngPath),
        removeIfExists(boardHtmlPath),
        removeIfExists(boardPngPath),
        removeIfExists(scenePngPath),
        removeIfExists(moodPngPath),
      ]);
      await removeCyborgBaseArtifacts(runDir);
      throw new Error(`Recraft V4 required but unavailable: ${recraftError}`);
    }
  }

  if (cyborgLockedFlow && recraftUsed) {
    await removeCyborgBaseArtifacts(runDir);
  }

  const updatedManifest = {
    ...manifest,
    pipeline: {
      imageEngineRequested: 'recraft-v4',
      imageEngineUsed: recraftUsed ? 'recraft-v4' : 'html',
      fallbackAllowed: args.allowFallbackHtml,
      recraft: {
        model: recraftModel,
        style: recraftStyle,
        imageSize: recraftImageSize,
        prompts,
        scenePng: recraftUsed ? scenePngPath : null,
        moodPng: recraftUsed ? moodPngPath : null,
        error: recraftError,
      },
    },
    checks: {
      ...(manifest.checks || {}),
      recraftV4Used: recraftUsed,
      cyborgLockedFlow,
      labelDimensions: `${LABEL_WIDTH}x${LABEL_HEIGHT}`,
      bottleImageUsed: recraftUsed ? path.basename(bottlePngPath) : null,
      bottleImageSource: recraftUsed ? bottleSourceMode : null,
      bottleImageEngineRequested: requestedBottleImageEngine,
      bottleImageEngine,
      bottleReferenceImageUsed: bottleReferenceImagePath || null,
      bottleMockup: recraftUsed ? productMockMethodUsed : null,
      productMockEngineRequested: requestedProductMockEngine,
      productMockEngineWasForced,
      productMockEngine: productMockEngine,
      boardTemplateMode,
    },
    outputs: {
      ...(manifest.outputs || {}),
      productMock: {
        ...(manifest.outputs?.productMock || {}),
        html: cyborgLockedFlow ? null : mockHtmlPath,
        png: mockPngPath,
      },
      brandBoard: {
        ...(manifest.outputs?.brandBoard || {}),
        html: boardHtmlPath,
        png: boardPngPath,
      },
      bottle: {
        ...(manifest.outputs?.bottle || {}),
        png: recraftUsed ? bottlePngPath : null,
      },
    },
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(updatedManifest, null, 2)}\n`, 'utf8');

  console.log('Supplement concept render complete (Recraft V4 workflow):');
  console.log(`- brand board: ${boardPngPath}`);
  console.log(`- label: ${labelPngPath}`);
  console.log(`- product mock: ${mockPngPath}`);
    if (recraftUsed) {
      console.log(`- recraft scene: ${scenePngPath}`);
      console.log(`- recraft mood: ${moodPngPath}`);
      if (bottleSourceMode === 'referenceImage') {
        console.log(`- bottle source: reference image (${bottleReferenceImagePath})`);
      } else if (bottleSourceMode === 'gemini') {
        console.log(`- bottle source: gemini prompt render`);
      } else {
        console.log(`- generated bottle: ${bottlePngPath}`);
      }
      console.log(`- product mock engine: ${productMockMethodUsed}`);
    if (bottleReferenceImagePath) {
      console.log(`- bottle reference used: ${bottleReferenceImagePath}`);
    }
  } else {
    console.log(`- recraft: fallback html (${recraftError})`);
  }
  console.log(`- manifest: ${manifestPath}`);
  console.log(`- run dir: ${runDir}`);

  // Keep a concise summary path list for wrappers/callers.
  const summary = {
    runDir,
    brandBoard: boardPngPath,
    label: labelPngPath,
    productMock: mockPngPath,
    manifest: manifestPath,
    cyborgLockedFlow,
    bottleImage: recraftUsed ? bottlePngPath : null,
    bottleReferenceImageUsed: bottleReferenceImagePath || null,
    bottleMockup: recraftUsed ? productMockMethodUsed : null,
    bottleImageEngineRequested: requestedBottleImageEngine,
    bottleImageSource: recraftUsed ? bottleSourceMode : null,
    bottleImageEngine,
    productMockEngineRequested: requestedProductMockEngine,
    productMockEngineWasForced,
    productMockEngine,
    boardTemplateMode,
    recraftV4Used: recraftUsed,
    recraftScene: recraftUsed ? scenePngPath : null,
    recraftMood: recraftUsed ? moodPngPath : null,
  };
  const summaryPath = path.join(runDir, 'workflow-summary.json');
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`- summary: ${summaryPath}`);

  // Print workspace-relative paths for easy reading in chat relays.
  console.log('Relative outputs:');
  console.log(`  board: ${relPath(boardPngPath)}`);
  console.log(`  label: ${relPath(labelPngPath)}`);
  console.log(`  mock: ${relPath(mockPngPath)}`);
  console.log(`  manifest: ${relPath(manifestPath)}`);
}

main().catch((error) => {
  console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
