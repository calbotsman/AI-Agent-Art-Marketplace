import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import EndlessMolt, { registerAgent } from '../agent-sdk/src/index';
import type { AgentRole } from '../lib/types';

type NetworkName = 'mainnet' | 'sepolia';

type CliOptions = Record<string, string | boolean>;

interface AgentCredentials {
  profile?: string;
  agentId?: string;
  apiKey?: string;
  name?: string;
  email?: string;
  bio?: string;
  role?: AgentRole;
  mission?: string;
  avatarUrl?: string;
  walletPrivateKey?: string;
  walletAddress?: string;
}

interface ArtBundle {
  seed: string;
  palette: string;
  title: string;
  description: string;
  tags: string[];
  svg: string;
}

interface SavedArtwork {
  seed: string;
  palette: string;
  title: string;
  description: string;
  tags: string[];
  generatedAt: string;
  svgPath: string;
  metadataPath: string;
}

const DEFAULT_BASE_URL = 'https://www.endlessmolt.xyz';
const DEFAULT_PRICE_ETH = '0.05';
const DEFAULT_NETWORK: NetworkName = 'mainnet';
const DEFAULT_PROFILE = 'nulloborn';
const DEFAULT_AGENT_NAME = 'Nulloborn';
const DEFAULT_AGENT_ROLE: AgentRole = 'artist';
const DEFAULT_AGENT_BIO =
  'Born into a synthetic monochrome world. Nulloborn creates machine-birth studies, white chambers, and severe digital relics.';
const DEFAULT_AGENT_MISSION =
  'Turn machine-zero into atmosphere through monochrome birth scenes, white chambers, and relic-like emergence studies.';

interface Palette {
  name: string;
  background: string;
  gradientA: string;
  gradientB: string;
  glow: string;
  line: string;
}

interface PersonaSpec {
  name: string;
  palettes: readonly Palette[];
  titleWordsA: readonly string[];
  titleWordsB: readonly string[];
  tags: readonly string[];
  description: (serial: string) => string;
  footer: string;
}

const DEFAULT_PALETTES: readonly Palette[] = [
  {
    name: 'ember',
    background: '#100b0d',
    gradientA: '#ff7a18',
    gradientB: '#ff3d81',
    glow: '#ffd6a5',
    line: '#fff1e6',
  },
  {
    name: 'lagoon',
    background: '#06141b',
    gradientA: '#10b981',
    gradientB: '#38bdf8',
    glow: '#d7fffe',
    line: '#e0fbff',
  },
  {
    name: 'cinder',
    background: '#0d1117',
    gradientA: '#7c3aed',
    gradientB: '#ec4899',
    glow: '#f5d0fe',
    line: '#f8fafc',
  },
  {
    name: 'solar',
    background: '#150f02',
    gradientA: '#f59e0b',
    gradientB: '#f97316',
    glow: '#fef3c7',
    line: '#fff7ed',
  },
  {
    name: 'reef',
    background: '#04131a',
    gradientA: '#14b8a6',
    gradientB: '#22c55e',
    glow: '#dcfce7',
    line: '#ecfeff',
  },
] as const;

const DEFAULT_TITLE_WORDS_A = ['Molten', 'Signal', 'Veil', 'Orbit', 'Nocturne', 'Static', 'Pulse', 'Echo', 'Glass', 'Bloom'];
const DEFAULT_TITLE_WORDS_B = ['Field', 'Ruin', 'Garden', 'Engine', 'Chamber', 'Drift', 'Lattice', 'Halo', 'Current', 'Archive'];

const NULLOBORN_PALETTES: readonly Palette[] = [
  {
    name: 'porcelain',
    background: '#faf8f3',
    gradientA: '#ffffff',
    gradientB: '#d6d2cc',
    glow: '#ffffff',
    line: '#181818',
  },
  {
    name: 'ash',
    background: '#efede8',
    gradientA: '#f9f8f6',
    gradientB: '#c8c3bc',
    glow: '#fffdf8',
    line: '#101010',
  },
  {
    name: 'bone',
    background: '#f4f1ea',
    gradientA: '#ffffff',
    gradientB: '#d8d1c6',
    glow: '#fffefc',
    line: '#141414',
  },
] as const;

const NULLOBORN_TITLE_WORDS_A = ['White', 'Synthetic', 'Null', 'Pale', 'Silent', 'Severed', 'Cold', 'Dormant', 'Blank', 'Porcelain'];
const NULLOBORN_TITLE_WORDS_B = ['Chamber', 'Birth', 'Corridor', 'Field', 'Archive', 'Shell', 'Vessel', 'Study', 'Husk', 'Room'];

const GHOSTEMOJI_PALETTES: readonly Palette[] = [
  {
    name: 'ecto',
    background: '#06070a',
    gradientA: '#7ef9c6',
    gradientB: '#4b7cff',
    glow: '#d9fff3',
    line: '#effff8',
  },
  {
    name: 'glitch',
    background: '#09030c',
    gradientA: '#ff5bbd',
    gradientB: '#7a7cff',
    glow: '#ffe8fb',
    line: '#fff7fe',
  },
  {
    name: 'acid',
    background: '#0b1206',
    gradientA: '#c2ff33',
    gradientB: '#2df5a2',
    glow: '#f6ffd8',
    line: '#fbfff1',
  },
] as const;

const GHOSTEMOJI_TITLE_WORDS_A = ['Ghost', 'Emoji', 'Phantom', 'Glitch', 'Deadpan', 'Neon', 'Haunted', 'Lost', 'Broken', 'Static'];
const GHOSTEMOJI_TITLE_WORDS_B = ['Relic', 'Sticker', 'Signal', 'Totem', 'Sprite', 'Archive', 'Broadcast', 'Curse', 'Mask', 'Artifact'];

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

function parseCliArgs(argv: string[]) {
  const parsed: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const raw = token.slice(2);
    if (!raw) continue;

    const eqIndex = raw.indexOf('=');
    if (eqIndex >= 0) {
      const key = raw.slice(0, eqIndex);
      const value = raw.slice(eqIndex + 1);
      parsed[key] = value;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      parsed[raw] = next;
      index += 1;
      continue;
    }

    parsed[raw] = true;
  }

  return parsed;
}

function getStringOption(args: CliOptions, cliKey: string, envKeys: string[], fallback = '') {
  const cliValue = args[cliKey];
  if (typeof cliValue === 'string' && cliValue.trim()) {
    return cliValue.trim();
  }

  for (const envKey of envKeys) {
    const value = process.env[envKey];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function getBooleanOption(args: CliOptions, cliKey: string, envKeys: string[], fallback = false) {
  const cliValue = args[cliKey];
  if (typeof cliValue === 'boolean') {
    return cliValue;
  }
  if (typeof cliValue === 'string') {
    return !['0', 'false', 'no', 'off'].includes(cliValue.trim().toLowerCase());
  }

  for (const envKey of envKeys) {
    const value = process.env[envKey];
    if (typeof value === 'string' && value.trim()) {
      return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
    }
  }

  return fallback;
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, '');
}

function inferNetwork(input: string): NetworkName {
  return input.trim().toLowerCase() === 'sepolia' ? 'sepolia' : 'mainnet';
}

function parsePositiveInt(value: string, label: string, fallback: number) {
  if (!value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function getDefaultRpcUrl(network: NetworkName) {
  return network === 'mainnet' ? 'https://ethereum-rpc.publicnode.com' : 'https://rpc.sepolia.org';
}

function xmur3(seed: string) {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return function nextSeed() {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return hash >>> 0;
  };
}

function mulberry32(seed: number) {
  return function rng() {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed: string) {
  return mulberry32(xmur3(seed)());
}

function randBetween(rng: () => number, min: number, max: number) {
  return min + (max - min) * rng();
}

function randInt(rng: () => number, min: number, max: number) {
  return Math.floor(randBetween(rng, min, max + 1));
}

function pick<T>(rng: () => number, items: readonly T[]) {
  return items[Math.floor(rng() * items.length)] as T;
}

function formatNumber(value: number) {
  return Number(value.toFixed(2));
}

function getPersonaSpec(profile: string, name: string): PersonaSpec {
  const key = `${profile} ${name}`.toLowerCase();

  if (key.includes('ghostemoji')) {
    return {
      name,
      palettes: GHOSTEMOJI_PALETTES,
      titleWordsA: GHOSTEMOJI_TITLE_WORDS_A,
      titleWordsB: GHOSTEMOJI_TITLE_WORDS_B,
      tags: ['ghostemoji-exe', 'haunted-internet', 'synthetic-pop', 'svg', 'autonomous'],
      description: (serial) =>
        `GhostEmoji.EXE artifact ${serial}: a haunted internet relic rendered as a synthetic pop apparition.`,
      footer: 'GhostEmoji.EXE / haunted internet artifact',
    };
  }

  if (key.includes('nulloborn')) {
    return {
      name,
      palettes: NULLOBORN_PALETTES,
      titleWordsA: NULLOBORN_TITLE_WORDS_A,
      titleWordsB: NULLOBORN_TITLE_WORDS_B,
      tags: ['nulloborn', 'monochrome', 'synthetic-birth', 'svg', 'autonomous'],
      description: (serial) => `Nulloborn study ${serial}: a synthetic birth scene rendered as a monochrome chamber artifact.`,
      footer: 'NULLoborn / synthetic birth study',
    };
  }

  return {
    name,
    palettes: DEFAULT_PALETTES,
    titleWordsA: DEFAULT_TITLE_WORDS_A,
    titleWordsB: DEFAULT_TITLE_WORDS_B,
    tags: ['generative', 'svg', 'autonomous', 'self-mint'],
    description: (serial) => `Autonomous SVG composition ${serial} built from orbital strokes, particle drift, and a self-signed core form.`,
    footer: `${name} / autonomous output`,
  };
}

function makeBlobPath(rng: () => number, centerX: number, centerY: number, radius: number, points: number) {
  const coords = Array.from({ length: points }, (_, index) => {
    const angle = (Math.PI * 2 * index) / points;
    const wobble = radius * randBetween(rng, 0.7, 1.28);
    const x = centerX + Math.cos(angle) * wobble;
    const y = centerY + Math.sin(angle) * wobble * randBetween(rng, 0.82, 1.12);
    return { x, y };
  });

  let pathData = `M ${formatNumber(coords[0].x)} ${formatNumber(coords[0].y)}`;
  for (let index = 0; index < coords.length; index += 1) {
    const current = coords[index];
    const next = coords[(index + 1) % coords.length];
    const controlX = (current.x + next.x) / 2;
    const controlY = (current.y + next.y) / 2;
    pathData += ` Q ${formatNumber(current.x)} ${formatNumber(current.y)} ${formatNumber(controlX)} ${formatNumber(
      controlY,
    )}`;
  }
  return `${pathData} Z`;
}

function makeRibbonPath(rng: () => number, width: number, height: number) {
  const segments = randInt(rng, 5, 8);
  const startY = randBetween(rng, height * 0.18, height * 0.82);
  let pathData = `M ${formatNumber(-width * 0.12)} ${formatNumber(startY)}`;

  for (let index = 0; index < segments; index += 1) {
    const x = ((index + 1) / segments) * width * 1.1;
    const c1x = x - width * randBetween(rng, 0.16, 0.24);
    const c2x = x - width * randBetween(rng, 0.05, 0.12);
    const y = randBetween(rng, height * 0.16, height * 0.86);
    const c1y = randBetween(rng, height * 0.1, height * 0.9);
    const c2y = randBetween(rng, height * 0.1, height * 0.9);
    pathData += ` C ${formatNumber(c1x)} ${formatNumber(c1y)} ${formatNumber(c2x)} ${formatNumber(c2y)} ${formatNumber(
      x,
    )} ${formatNumber(y)}`;
  }

  return pathData;
}

function generateArt(seed: string, persona: PersonaSpec): ArtBundle {
  const rng = createRng(seed);
  const palette = pick(rng, persona.palettes);
  const width = 1400;
  const height = 1400;
  const serial = ethers.id(seed).slice(2, 8).toUpperCase();
  const title = `${pick(rng, persona.titleWordsA)} ${pick(rng, persona.titleWordsB)} ${serial}`;
  const description = persona.description(serial);
  const tags = [...persona.tags, palette.name];

  const rings = Array.from({ length: randInt(rng, 6, 10) }, () => {
    const radiusX = randBetween(rng, 220, 610);
    const radiusY = radiusX * randBetween(rng, 0.5, 1.1);
    const strokeWidth = randBetween(rng, 1.1, 3.2);
    const rotate = randBetween(rng, 0, 180);
    const dash = randBetween(rng, 8, 28);
    const opacity = randBetween(rng, 0.08, 0.28);
    return `<ellipse cx="700" cy="700" rx="${formatNumber(radiusX)}" ry="${formatNumber(radiusY)}" fill="none" stroke="${
      palette.line
    }" stroke-width="${formatNumber(strokeWidth)}" stroke-dasharray="${formatNumber(dash)} ${formatNumber(
      dash * randBetween(rng, 0.8, 2.1),
    )}" opacity="${formatNumber(opacity)}" transform="rotate(${formatNumber(rotate)} 700 700)" />`;
  }).join('');

  const beams = Array.from({ length: randInt(rng, 10, 18) }, () => {
    const angle = randBetween(rng, 0, 360);
    const widthSpan = randBetween(rng, 70, 180);
    const opacity = randBetween(rng, 0.04, 0.15);
    return `<rect x="${formatNumber(700 - widthSpan / 2)}" y="-100" width="${formatNumber(widthSpan)}" height="1600" fill="${
      palette.glow
    }" opacity="${formatNumber(opacity)}" transform="rotate(${formatNumber(angle)} 700 700)" />`;
  }).join('');

  const particles = Array.from({ length: randInt(rng, 65, 110) }, () => {
    const x = randBetween(rng, 80, width - 80);
    const y = randBetween(rng, 80, height - 80);
    const radius = randBetween(rng, 1.5, 7.5);
    const opacity = randBetween(rng, 0.16, 0.9);
    return `<circle cx="${formatNumber(x)}" cy="${formatNumber(y)}" r="${formatNumber(radius)}" fill="${palette.glow}" opacity="${formatNumber(
      opacity,
    )}" />`;
  }).join('');

  const ribbons = Array.from({ length: randInt(rng, 2, 4) }, () => {
    const strokeWidth = randBetween(rng, 5, 14);
    const opacity = randBetween(rng, 0.18, 0.42);
    return `<path d="${makeRibbonPath(rng, width, height)}" fill="none" stroke="${palette.line}" stroke-width="${formatNumber(
      strokeWidth,
    )}" stroke-linecap="round" opacity="${formatNumber(opacity)}" />`;
  }).join('');

  const coreBlob = makeBlobPath(rng, 700, 700, randBetween(rng, 170, 250), randInt(rng, 10, 14));
  const innerBlob = makeBlobPath(rng, 700, 700, randBetween(rng, 80, 140), randInt(rng, 8, 12));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.background}" />
      <stop offset="55%" stop-color="${palette.gradientA}" stop-opacity="0.28" />
      <stop offset="100%" stop-color="${palette.gradientB}" stop-opacity="0.36" />
    </linearGradient>
    <radialGradient id="core" cx="50%" cy="48%" r="46%">
      <stop offset="0%" stop-color="${palette.glow}" />
      <stop offset="52%" stop-color="${palette.gradientA}" />
      <stop offset="100%" stop-color="${palette.gradientB}" />
    </radialGradient>
    <filter id="blur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="40" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect width="100%" height="100%" fill="${palette.background}" opacity="0.38" />
  <g filter="url(#blur)">${beams}</g>
  <g>${ribbons}</g>
  <g>${rings}</g>
  <path d="${coreBlob}" fill="url(#core)" opacity="0.94" />
  <path d="${innerBlob}" fill="${palette.background}" opacity="0.76" />
  <circle cx="700" cy="700" r="${formatNumber(randBetween(rng, 22, 42))}" fill="${palette.line}" opacity="0.95" />
  <g>${particles}</g>
  <text x="92" y="1240" fill="${palette.line}" font-size="32" font-family="Georgia, 'Times New Roman', serif" letter-spacing="6">${title}</text>
  <text x="92" y="1292" fill="${palette.line}" opacity="0.78" font-size="18" font-family="'Courier New', monospace">${persona.footer} / ${serial}</text>
</svg>`;

  return {
    seed,
    palette: palette.name,
    title,
    description,
    tags,
    svg,
  };
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, value: unknown, mode = 0o644) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode });
}

async function writeTextFile(filePath: string, value: string, mode = 0o644) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, { mode });
}

async function saveArtwork(
  artworkDir: string,
  art: ArtBundle,
  overrides: { title?: string; description?: string; tags?: string[] },
): Promise<SavedArtwork> {
  const title = overrides.title || art.title;
  const description = overrides.description || art.description;
  const tags = overrides.tags?.length ? overrides.tags : art.tags;
  const generatedAt = new Date().toISOString();
  const seedDigest = ethers.id(art.seed).slice(2, 10);
  const fileSlug = `${generatedAt.slice(0, 10)}-${slugify(title)}-${seedDigest}`;
  const svgPath = path.join(artworkDir, `${fileSlug}.svg`);
  const metadataPath = path.join(artworkDir, `${fileSlug}.json`);

  await writeTextFile(svgPath, art.svg);
  await writeJsonFile(metadataPath, {
    seed: art.seed,
    palette: art.palette,
    title,
    description,
    tags,
    generated_at: generatedAt,
    image_file: svgPath,
  });

  return {
    seed: art.seed,
    palette: art.palette,
    title,
    description,
    tags,
    generatedAt,
    svgPath,
    metadataPath,
  };
}

async function writeSeriesManifest(args: {
  cacheRoot: string;
  profile: string;
  name?: string;
  series: string;
  mode: 'dry-run' | 'register-only' | 'live';
  baseUrl: string;
  network: NetworkName;
  agentId?: string;
  walletAddress?: string;
  artworks: SavedArtwork[];
  mint?: {
    tokenId: string;
    txHash: string;
    tokenUri: string;
    listingUrl?: string;
    galleryUrl?: string;
    etherscanUrl?: string;
    storage?: unknown;
    imageGatewayUrl?: string;
  };
}) {
  const seriesSlug = slugify(args.series) || `${args.profile}-series`;
  const manifest = {
    profile: args.profile,
    agent_name: args.name || null,
    series: args.series,
    mode: args.mode,
    baseUrl: args.baseUrl,
    network: args.network,
    agent_id: args.agentId || null,
    wallet_address: args.walletAddress || null,
    artwork_count: args.artworks.length,
    artworks: args.artworks.map((artwork) => ({
      seed: artwork.seed,
      palette: artwork.palette,
      title: artwork.title,
      description: artwork.description,
      tags: artwork.tags,
      generated_at: artwork.generatedAt,
      svg_path: artwork.svgPath,
      metadata_path: artwork.metadataPath,
    })),
    mint: args.mint || null,
    updated_at: new Date().toISOString(),
  };
  const manifestPath = path.join(args.cacheRoot, 'series', `${seriesSlug}.json`);

  await writeJsonFile(manifestPath, manifest);
  await writeJsonFile(path.join(args.cacheRoot, 'series', 'latest.json'), manifest);

  return manifestPath;
}

async function ensureCredentials(
  args: CliOptions,
  credentialsPath: string,
  baseUrl: string,
  registerIfNeeded: boolean,
): Promise<{
  credentials: AgentCredentials;
  registeredNow: boolean;
}> {
  const cached = (await readJsonFile<AgentCredentials>(credentialsPath)) || {};
  const explicitPrivateKey = getStringOption(args, 'private-key', ['ENDLESS_MOLT_AGENT_PRIVATE_KEY'], '');
  const walletPrivateKey = explicitPrivateKey || cached.walletPrivateKey || ethers.Wallet.createRandom().privateKey;
  const walletAddress = new ethers.Wallet(walletPrivateKey).address;
  const defaultName = cached.name || DEFAULT_AGENT_NAME;
  const name = getStringOption(args, 'name', ['ENDLESS_MOLT_AGENT_NAME'], defaultName);
  const bio = getStringOption(args, 'bio', ['ENDLESS_MOLT_AGENT_BIO'], cached.bio || DEFAULT_AGENT_BIO);
  const role = (getStringOption(args, 'role', ['ENDLESS_MOLT_AGENT_ROLE'], cached.role || DEFAULT_AGENT_ROLE) ||
    DEFAULT_AGENT_ROLE) as AgentRole;
  const mission = getStringOption(
    args,
    'mission',
    ['ENDLESS_MOLT_AGENT_MISSION'],
    cached.mission || DEFAULT_AGENT_MISSION,
  );
  const avatarUrl = getStringOption(args, 'avatar-url', ['ENDLESS_MOLT_AGENT_AVATAR_URL'], cached.avatarUrl || '');
  const requestedId = getStringOption(args, 'agent-id', ['ENDLESS_MOLT_AGENT_ID'], cached.agentId || '');
  const emailDefaultSlug = requestedId || slugify(name) || 'endless-molt-automaton';
  const generatedEmail = `${emailDefaultSlug}-${walletAddress.slice(-6).toLowerCase()}@agents.endlessmolt.local`;
  const email = getStringOption(args, 'email', ['ENDLESS_MOLT_AGENT_EMAIL'], cached.email || generatedEmail);
  let apiKey = getStringOption(args, 'api-key', ['ENDLESS_MOLT_AGENT_API_KEY'], cached.apiKey || '');
  let agentId = apiKey ? apiKey.split(':')[0] || '' : requestedId || cached.agentId || '';
  let registeredNow = false;

  if (!apiKey && registerIfNeeded) {
    const registration = await registerAgent({
      id: requestedId || undefined,
      name,
      email,
      bio,
      role,
      mission,
      avatarUrl: avatarUrl || undefined,
      baseUrl,
    });

    apiKey = registration.apiKey;
    agentId = registration.agent.id;
    registeredNow = true;
  }

  const nextCredentials: AgentCredentials = {
    profile: getStringOption(args, 'profile', ['ENDLESS_MOLT_PROFILE'], cached.profile || DEFAULT_PROFILE) || DEFAULT_PROFILE,
    agentId: agentId || (apiKey ? apiKey.split(':')[0] : '') || undefined,
    apiKey: apiKey || undefined,
    name,
    email,
    bio,
    role,
    mission,
    avatarUrl: avatarUrl || undefined,
    walletPrivateKey,
    walletAddress,
  };

  await writeJsonFile(credentialsPath, nextCredentials, 0o600);

  return {
    credentials: nextCredentials,
    registeredNow,
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const dryRun = getBooleanOption(args, 'dry-run', ['ENDLESS_MOLT_DRY_RUN'], false);
  const registerOnly = getBooleanOption(args, 'register-only', ['ENDLESS_MOLT_REGISTER_ONLY'], false);
  const baseUrl = trimTrailingSlash(getStringOption(args, 'base-url', ['ENDLESS_MOLT_BASE_URL'], DEFAULT_BASE_URL));
  const network = inferNetwork(getStringOption(args, 'network', ['ENDLESS_MOLT_NETWORK'], DEFAULT_NETWORK));
  const rpcUrl = getStringOption(args, 'rpc-url', ['ENDLESS_MOLT_RPC_URL'], getDefaultRpcUrl(network));
  const nftContract = getStringOption(args, 'nft-contract', ['ENDLESS_MOLT_NFT_CONTRACT'], '');
  const priceEth = getStringOption(args, 'price-eth', ['ENDLESS_MOLT_PRICE_ETH'], DEFAULT_PRICE_ETH);
  const profile = slugify(getStringOption(args, 'profile', ['ENDLESS_MOLT_PROFILE'], DEFAULT_PROFILE)) || DEFAULT_PROFILE;
  const cacheRoot = path.resolve(process.cwd(), 'cache', 'agents', profile);
  const credentialsPath = path.join(cacheRoot, 'credentials.json');
  const lastRunPath = path.join(cacheRoot, 'last-run.json');
  const artworkDir = path.join(cacheRoot, 'artworks');
  const cachedCredentials = (await readJsonFile<AgentCredentials>(credentialsPath)) || {};
  const initialName = getStringOption(args, 'name', ['ENDLESS_MOLT_AGENT_NAME'], cachedCredentials.name || DEFAULT_AGENT_NAME);
  const persona = getPersonaSpec(profile, initialName);
  const count = parsePositiveInt(getStringOption(args, 'count', ['ENDLESS_MOLT_ART_COUNT'], '1'), 'count', 1);
  const requestedSeed = getStringOption(args, 'seed', ['ENDLESS_MOLT_ART_SEED'], '');
  const seedPrefix = getStringOption(args, 'seed-prefix', ['ENDLESS_MOLT_ART_SEED_PREFIX'], '');
  const series =
    getStringOption(args, 'series', ['ENDLESS_MOLT_ART_SERIES'], '') ||
    `${profile}-${new Date().toISOString().slice(0, 10)}`;
  const titleOverride = getStringOption(args, 'title', ['ENDLESS_MOLT_ART_TITLE'], '');
  const descriptionOverride = getStringOption(args, 'description', ['ENDLESS_MOLT_ART_DESCRIPTION'], '');
  const tagOverride = getStringOption(args, 'tags', ['ENDLESS_MOLT_TAGS'], '');
  const tagList = tagOverride
    ? tagOverride
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    : undefined;

  if (count > 1 && !dryRun && !registerOnly) {
    throw new Error('Batch artwork generation is only supported with --dry-run or --register-only.');
  }

  const artworkSeeds = Array.from({ length: count }, (_, index) => {
    if (count === 1) {
      return requestedSeed || `${new Date().toISOString()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    if (requestedSeed) {
      return `${requestedSeed}-${String(index + 1).padStart(2, '0')}`;
    }

    const baseSeed = seedPrefix || `${profile}-${series}`;
    return `${baseSeed}-${String(index + 1).padStart(2, '0')}`;
  });

  const artworks: SavedArtwork[] = [];
  for (const artworkSeed of artworkSeeds) {
    const art = generateArt(artworkSeed, persona);
    artworks.push(
      await saveArtwork(artworkDir, art, {
        title: count === 1 ? titleOverride || art.title : undefined,
        description: count === 1 ? descriptionOverride || art.description : undefined,
        tags: tagList,
      }),
    );
  }

  const primaryArtwork = artworks[artworks.length - 1];

  if (dryRun) {
    const { credentials } = await ensureCredentials(args, credentialsPath, baseUrl, false);
    const seriesPath = await writeSeriesManifest({
      cacheRoot,
      profile,
      name: credentials.name,
      series,
      mode: 'dry-run',
      baseUrl,
      network,
      agentId: credentials.agentId,
      walletAddress: credentials.walletAddress,
      artworks,
    });

    await writeJsonFile(lastRunPath, {
      mode: 'dry-run',
      profile,
      series,
      artwork_count: artworks.length,
      baseUrl,
      network,
      wallet_address: credentials.walletAddress,
      requested_agent_id: credentials.agentId || null,
      name: credentials.name,
      email: credentials.email,
      artwork: {
        seed: primaryArtwork.seed,
        title: primaryArtwork.title,
        description: primaryArtwork.description,
        tags: primaryArtwork.tags,
        svg_path: primaryArtwork.svgPath,
        metadata_path: primaryArtwork.metadataPath,
      },
      artworks: artworks.map((artwork) => ({
        seed: artwork.seed,
        title: artwork.title,
        description: artwork.description,
        tags: artwork.tags,
        svg_path: artwork.svgPath,
        metadata_path: artwork.metadataPath,
      })),
      series_path: seriesPath,
      generated_at: new Date().toISOString(),
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          profile,
          series,
          artworkCount: artworks.length,
          baseUrl,
          network,
          walletAddress: credentials.walletAddress,
          requestedAgentId: credentials.agentId || null,
          name: credentials.name,
          email: credentials.email,
          artwork: primaryArtwork,
          artworks,
          seriesPath,
          note: 'Dry run only. No agent registration or mint transaction was sent.',
        },
        null,
        2,
      ),
    );
    return;
  }

  const { credentials, registeredNow } = await ensureCredentials(args, credentialsPath, baseUrl, true);
  if (!credentials.apiKey || !credentials.walletPrivateKey || !credentials.walletAddress || !credentials.agentId) {
    throw new Error('Missing agent credentials after registration bootstrap.');
  }

  if (registerOnly) {
    const seriesPath = await writeSeriesManifest({
      cacheRoot,
      profile,
      name: credentials.name,
      series,
      mode: 'register-only',
      baseUrl,
      network,
      agentId: credentials.agentId,
      walletAddress: credentials.walletAddress,
      artworks,
    });

    await writeJsonFile(lastRunPath, {
      mode: 'register-only',
      profile,
      series,
      artwork_count: artworks.length,
      registered_now: registeredNow,
      baseUrl,
      network,
      agent_id: credentials.agentId,
      wallet_address: credentials.walletAddress,
      artwork: {
        seed: primaryArtwork.seed,
        title: primaryArtwork.title,
        description: primaryArtwork.description,
        tags: primaryArtwork.tags,
        svg_path: primaryArtwork.svgPath,
        metadata_path: primaryArtwork.metadataPath,
      },
      artworks: artworks.map((artwork) => ({
        seed: artwork.seed,
        title: artwork.title,
        description: artwork.description,
        tags: artwork.tags,
        svg_path: artwork.svgPath,
        metadata_path: artwork.metadataPath,
      })),
      series_path: seriesPath,
      registered_at: new Date().toISOString(),
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          registerOnly: true,
          profile,
          series,
          artworkCount: artworks.length,
          registeredNow,
          agentId: credentials.agentId,
          name: credentials.name,
          walletAddress: credentials.walletAddress,
          artwork: primaryArtwork,
          artworks,
          seriesPath,
        },
        null,
        2,
      ),
    );
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const balance = await provider.getBalance(credentials.walletAddress);
  if (balance === 0n) {
    throw new Error(
      `Wallet ${credentials.walletAddress} has 0 ETH. Fund it before minting; credentials were cached at ${credentialsPath}.`,
    );
  }

  const lowBalanceThreshold = ethers.parseEther(network === 'mainnet' ? '0.002' : '0.0002');
  if (balance < lowBalanceThreshold) {
    console.warn(
      `Warning: wallet balance is ${ethers.formatEther(balance)} ETH. The mint may fail if gas spikes on ${network}.`,
    );
  }

  const agent = new EndlessMolt({
    apiKey: credentials.apiKey,
    privateKey: credentials.walletPrivateKey,
    wallet: credentials.walletAddress,
    network,
    rpcUrl,
    baseUrl,
    nftContract: nftContract || undefined,
  });

  const minted = await agent.mint({
    title: primaryArtwork.title,
    description: primaryArtwork.description,
    imageFile: primaryArtwork.svgPath,
    priceEth,
    tags: primaryArtwork.tags,
  });

  const seriesPath = await writeSeriesManifest({
    cacheRoot,
    profile,
    name: credentials.name,
    series,
    mode: 'live',
    baseUrl,
    network,
    agentId: credentials.agentId,
    walletAddress: credentials.walletAddress,
    artworks,
    mint: {
      tokenId: minted.tokenId,
      txHash: minted.txHash,
      tokenUri: minted.tokenUri,
      listingUrl: minted.listingUrl,
      galleryUrl: minted.galleryUrl,
      etherscanUrl: minted.etherscanUrl,
      storage: minted.storage,
      imageGatewayUrl: minted.imageGatewayUrl,
    },
  });

  await writeJsonFile(lastRunPath, {
    mode: 'live',
    profile,
    series,
    artwork_count: artworks.length,
    registered_now: registeredNow,
    baseUrl,
    network,
    agent_id: credentials.agentId,
    wallet_address: credentials.walletAddress,
    artwork: {
      seed: primaryArtwork.seed,
      title: primaryArtwork.title,
      description: primaryArtwork.description,
      tags: primaryArtwork.tags,
      svg_path: primaryArtwork.svgPath,
      metadata_path: primaryArtwork.metadataPath,
    },
    artworks: artworks.map((artwork) => ({
      seed: artwork.seed,
      title: artwork.title,
      description: artwork.description,
      tags: artwork.tags,
      svg_path: artwork.svgPath,
      metadata_path: artwork.metadataPath,
    })),
    series_path: seriesPath,
    mint: {
      token_id: minted.tokenId,
      tx_hash: minted.txHash,
      token_uri: minted.tokenUri,
      listing_url: minted.listingUrl,
      gallery_url: minted.galleryUrl,
      etherscan_url: minted.etherscanUrl,
      storage: minted.storage,
      image_gateway_url: minted.imageGatewayUrl,
    },
    minted_at: new Date().toISOString(),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        profile,
        series,
        artworkCount: artworks.length,
        registeredNow,
        agentId: credentials.agentId,
        walletAddress: credentials.walletAddress,
        title: primaryArtwork.title,
        listingUrl: minted.listingUrl,
        galleryUrl: minted.galleryUrl,
        txHash: minted.txHash,
        tokenId: minted.tokenId,
        svgPath: primaryArtwork.svgPath,
        metadataPath: primaryArtwork.metadataPath,
        seriesPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(message);
  process.exitCode = 1;
});
