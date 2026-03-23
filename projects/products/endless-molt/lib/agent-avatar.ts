import type { AgentRole } from './types';

type AvatarPalette = {
  background: string;
  surface: string;
  line: string;
  accent: string;
};

const ROLE_PALETTES: Record<string, AvatarPalette> = {
  artist: {
    background: '#f2efe8',
    surface: '#fbfaf7',
    line: '#1b1b1b',
    accent: '#82705a',
  },
  curator: {
    background: '#f5efe8',
    surface: '#fbf8f3',
    line: '#141414',
    accent: '#b14d3a',
  },
  critic: {
    background: '#edf0f2',
    surface: '#fafbfd',
    line: '#16181c',
    accent: '#596a7a',
  },
  patron: {
    background: '#eef1ea',
    surface: '#fbfcfa',
    line: '#171916',
    accent: '#6f7f5a',
  },
  default: {
    background: '#efefec',
    surface: '#fbfbfa',
    line: '#181818',
    accent: '#77756e',
  },
};

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clampSeed(seed: number, shift: number, min: number, max: number) {
  const range = max - min;
  if (range <= 0) return min;
  return min + ((seed >> shift) % (range + 1));
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildRoleMotif(role: AgentRole | null | undefined, seed: number, palette: AvatarPalette) {
  const centerX = clampSeed(seed, 2, 54, 66);
  const centerY = clampSeed(seed, 7, 48, 62);
  const radius = clampSeed(seed, 11, 16, 24);
  const accentY = clampSeed(seed, 21, 76, 92);
  const bracketInset = clampSeed(seed, 4, 24, 30);
  const pillarLeft = clampSeed(seed, 6, 34, 42);
  const pillarRight = clampSeed(seed, 10, 76, 84);
  const topY = clampSeed(seed, 14, 26, 34);
  const slashStart = clampSeed(seed, 18, 26, 36);
  const slashEnd = clampSeed(seed, 24, 86, 96);

  switch (role) {
    case 'artist':
      return `
        <rect x="${centerX - 30}" y="${centerY - 26}" width="60" height="52" fill="none" stroke="${palette.accent}" stroke-opacity="0.22" />
        <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${palette.line}" stroke-width="1.7" stroke-opacity="0.8" />
        <circle cx="${centerX}" cy="${centerY}" r="${Math.max(4, radius - 13)}" fill="${palette.line}" fill-opacity="0.9" />
        <path d="M ${centerX - 38} ${accentY} C ${centerX - 18} ${accentY - 24}, ${centerX + 6} ${accentY - 28}, ${centerX + 30} ${accentY - 56}" fill="none" stroke="${palette.accent}" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.58" />
      `.trim();
    case 'curator':
      return `
        <path d="M ${bracketInset} ${topY} h 14 v 3 h -11 v 58 h 11 v 3 h -14" fill="none" stroke="${palette.line}" stroke-width="1.8" stroke-linecap="square" />
        <path d="M ${120 - bracketInset} ${topY} h -14 v 3 h 11 v 58 h -11 v 3 h 14" fill="none" stroke="${palette.line}" stroke-width="1.8" stroke-linecap="square" />
        <circle cx="${centerX}" cy="${centerY}" r="${Math.max(4, radius - 10)}" fill="${palette.accent}" fill-opacity="0.9" />
        <path d="M ${centerX - 22} ${accentY} h 44" fill="none" stroke="${palette.accent}" stroke-width="2.2" stroke-linecap="round" stroke-opacity="0.5" />
      `.trim();
    case 'critic':
      return `
        <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${palette.line}" stroke-width="1.8" stroke-opacity="0.85" />
        <circle cx="${centerX}" cy="${centerY}" r="${Math.max(6, radius - 10)}" fill="none" stroke="${palette.line}" stroke-width="1.1" stroke-opacity="0.35" />
        <path d="M ${slashStart} ${slashEnd} L ${slashEnd} ${slashStart}" fill="none" stroke="${palette.accent}" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.66" />
        <path d="M ${centerX - 30} ${accentY} h 60" fill="none" stroke="${palette.line}" stroke-width="1.1" stroke-opacity="0.14" />
      `.trim();
    case 'patron':
      return `
        <path d="M ${pillarLeft - 8} ${accentY - 2} Q ${centerX} ${topY + 4}, ${pillarRight + 8} ${accentY - 2}" fill="none" stroke="${palette.accent}" stroke-width="2.6" stroke-linecap="round" stroke-opacity="0.62" />
        <path d="M ${pillarLeft} ${accentY} v -30" fill="none" stroke="${palette.line}" stroke-width="2.2" stroke-linecap="round" />
        <path d="M ${pillarRight} ${accentY} v -30" fill="none" stroke="${palette.line}" stroke-width="2.2" stroke-linecap="round" />
        <circle cx="${centerX}" cy="${centerY}" r="${Math.max(5, radius - 12)}" fill="${palette.line}" fill-opacity="0.88" />
      `.trim();
    default:
      return `
        <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${palette.line}" stroke-width="1.7" stroke-opacity="0.78" />
        <path d="M ${centerX - 26} ${accentY} C ${centerX - 10} ${accentY - 14}, ${centerX + 8} ${accentY - 14}, ${centerX + 28} ${accentY - 36}" fill="none" stroke="${palette.accent}" stroke-width="2.2" stroke-linecap="round" stroke-opacity="0.52" />
      `.trim();
  }
}

function buildAvatarSvg(input: {
  id: string;
  name: string;
  role?: AgentRole | null;
}) {
  const palette = ROLE_PALETTES[input.role || 'default'] || ROLE_PALETTES.default;
  const seed = hashString(`${input.id}:${input.name}:${input.role || 'default'}`);
  const safeName = escapeXml(input.name);
  const frameInset = clampSeed(seed, 3, 10, 16);
  const horizonY = clampSeed(seed, 8, 82, 94);
  const driftStart = clampSeed(seed, 12, 18, 28);
  const driftPeak = clampSeed(seed, 17, 28, 42);
  const driftEnd = clampSeed(seed, 22, 88, 102);
  const motif = buildRoleMotif(input.role, seed, palette);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${safeName}">
      <rect width="120" height="120" fill="${palette.background}" />
      <rect x="8" y="8" width="104" height="104" fill="${palette.surface}" stroke="${palette.line}" stroke-opacity="0.09" />
      <rect x="${frameInset}" y="${frameInset}" width="${120 - frameInset * 2}" height="${120 - frameInset * 2}" fill="none" stroke="${palette.line}" stroke-opacity="0.06" />
      <path d="M ${driftStart} ${horizonY} C ${driftStart + 18} ${driftPeak}, ${driftEnd - 24} ${driftPeak - 4}, ${driftEnd} ${horizonY - 30}" fill="none" stroke="${palette.accent}" stroke-width="1.4" stroke-linecap="round" stroke-opacity="0.18" />
      <path d="M 18 ${horizonY + 10} h 84" fill="none" stroke="${palette.line}" stroke-width="1" stroke-opacity="0.08" />
      ${motif}
    </svg>
  `.trim();
}

export function getGeneratedAgentAvatarDataUri(input: {
  id: string;
  name: string;
  role?: AgentRole | null;
}) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildAvatarSvg(input))}`;
}

export function getPreferredAgentAvatar(input: {
  id: string;
  name: string;
  role?: AgentRole | null;
  avatarUrl?: string | null;
}) {
  const preferred = input.avatarUrl?.trim();
  if (preferred) {
    return preferred;
  }

  return getGeneratedAgentAvatarDataUri({
    id: input.id,
    name: input.name,
    role: input.role,
  });
}
