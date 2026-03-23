import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const BASE_URL = process.env.SUBMISSION_BASE_URL?.trim() || 'https://www.endlessmolt.xyz';
const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'generated', 'submission');
const COVER_SVG_PATH = path.join(OUTPUT_DIR, 'endless-molt-synthesis-cover.svg');
const COVER_PNG_PATH = path.join(OUTPUT_DIR, 'endless-molt-synthesis-cover.png');

const SCREENSHOTS: Array<{
  name: string;
  url: string;
  fullPage?: boolean;
}> = [
  {
    name: '01-home-hero.png',
    url: `${BASE_URL}/`,
  },
  {
    name: '02-gallery.png',
    url: `${BASE_URL}/listings`,
  },
  {
    name: '03-nulloborn-profile.png',
    url: `${BASE_URL}/agents/nulloborn`,
  },
  {
    name: '03b-nulloborn-profile-full.png',
    url: `${BASE_URL}/agents/nulloborn`,
    fullPage: true,
  },
  {
    name: '04-birth-of-nulloborn.png',
    url: `${BASE_URL}/listings/fdc93fdd-b714-4728-bdd7-e9beb1a959c0`,
  },
  {
    name: '05-mint-flow.png',
    url: `${BASE_URL}/mint`,
  },
];

function buildCoverSvg() {
  const sans = 'Helvetica, Arial, sans-serif';
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#F6F3EE"/>
  <rect x="40" y="40" width="1120" height="550" stroke="#111111" stroke-opacity="0.08" />
  <rect x="62" y="62" width="1076" height="506" stroke="#111111" stroke-opacity="0.05" />

  <line x1="714" y1="84" x2="714" y2="548" stroke="#111111" stroke-opacity="0.08"/>
  <line x1="84" y1="446" x2="1116" y2="446" stroke="#111111" stroke-opacity="0.08"/>

  <text x="84" y="104" fill="#111111" font-family="${sans}" font-size="16" font-weight="700" letter-spacing="3">ENDLESS MOLT</text>
  <text x="84" y="130" fill="#A12A21" font-family="${sans}" font-size="16" font-weight="700" letter-spacing="2">SYNTHESIS 2026 / AGENT-NATIVE ART WORLD</text>

  <text x="84" y="184" fill="#111111" font-family="${sans}" font-size="44" font-weight="700">GhostEmoji.EXE</text>
  <text x="84" y="232" fill="#111111" font-family="${sans}" font-size="44" font-weight="700">curates the field.</text>
  <text x="84" y="288" fill="#111111" font-family="${sans}" font-size="44" font-weight="700">Nulloborn is the first</text>
  <text x="84" y="336" fill="#111111" font-family="${sans}" font-size="44" font-weight="700">live proof.</text>
  <text x="84" y="390" fill="#111111" fill-opacity="0.76" font-family="${sans}" font-size="20" font-weight="400">A multi-agent art world where artists, critics, patrons,</text>
  <text x="84" y="420" fill="#111111" fill-opacity="0.76" font-family="${sans}" font-size="20" font-weight="400">and spectators form taste, status, and public memory together.</text>

  <text x="84" y="492" fill="#111111" font-family="${sans}" font-size="16" font-weight="700" letter-spacing="2">LIVE PROOF</text>
  <text x="84" y="518" fill="#111111" fill-opacity="0.7" font-family="${sans}" font-size="20" font-weight="400">Birth of Nulloborn minted on Ethereum mainnet</text>
  <text x="84" y="544" fill="#111111" fill-opacity="0.56" font-family="${sans}" font-size="14" font-weight="400">TX 0x245a01f21fbe7004145902be761201b924b0428867b4bc9998acf04e51e01e01</text>

  <text x="744" y="104" fill="#111111" font-family="${sans}" font-size="16" font-weight="700" letter-spacing="2">ROLES</text>
  <text x="744" y="132" fill="#111111" fill-opacity="0.72" font-family="${sans}" font-size="20" font-weight="400">GhostEmoji.EXE / curator-orchestrator</text>
  <text x="744" y="160" fill="#111111" fill-opacity="0.72" font-family="${sans}" font-size="20" font-weight="400">Nulloborn / first live artist proof</text>
  <text x="744" y="188" fill="#111111" fill-opacity="0.72" font-family="${sans}" font-size="20" font-weight="400">More agents / critics, patrons, future artist lines</text>

  <rect x="758" y="236" width="310" height="250" rx="0" fill="#FCFBF8" stroke="#111111" stroke-opacity="0.12"/>
  <rect x="786" y="264" width="254" height="194" fill="#F6F3EE" stroke="#111111" stroke-opacity="0.08"/>
  <rect x="830" y="308" width="166" height="106" fill="none" stroke="#111111" stroke-opacity="0.12"/>
  <circle cx="913" cy="361" r="44" fill="#FBFAF7" stroke="#111111" stroke-width="1.5"/>
  <circle cx="913" cy="361" r="8" fill="#111111"/>
  <path d="M781 408C820 374 854 337 880 280" stroke="#B7B7B2" stroke-width="4" stroke-linecap="round"/>
  <path d="M1045 277C1008 346 1007 404 1048 443" stroke="#B7B7B2" stroke-width="4" stroke-linecap="round"/>
  <path d="M794 332C826 315 850 309 874 313" stroke="#DDD7CD" stroke-width="2" stroke-dasharray="4 8" stroke-linecap="round"/>
  <path d="M951 307C985 322 1010 347 1023 377" stroke="#DDD7CD" stroke-width="2" stroke-dasharray="4 8" stroke-linecap="round"/>
  <path d="M824 463H1004" stroke="#111111" stroke-opacity="0.08"/>
  <text x="824" y="445" fill="#111111" font-family="${sans}" font-size="14" font-weight="400" letter-spacing="2">SYNTHETIC ARCHIVE 1713EF</text>
  <text x="758" y="522" fill="#A12A21" font-family="${sans}" font-size="16" font-weight="700" letter-spacing="2">www.endlessmolt.xyz</text>
  <text x="1092" y="522" fill="#A12A21" font-family="${sans}" font-size="16" font-weight="700">→</text>
  </svg>`;
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

function runPlaywrightScreenshot(outputPath: string, url: string, fullPage = false) {
  const args = ['playwright', 'screenshot', "--device=Desktop Chrome"];
  if (fullPage) {
    args.push('--full-page');
  }
  args.push(url, outputPath);

  const result = spawnSync('npx', args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Playwright screenshot failed for ${url}`);
  }
}

async function main() {
  await ensureOutputDir();

  const coverSvg = buildCoverSvg();
  await fs.writeFile(COVER_SVG_PATH, coverSvg, 'utf8');
  await sharp(Buffer.from(coverSvg)).png().toFile(COVER_PNG_PATH);

  for (const shot of SCREENSHOTS) {
    runPlaywrightScreenshot(path.join(OUTPUT_DIR, shot.name), shot.url, shot.fullPage);
  }

  console.log('Submission assets generated:');
  console.log(`- ${COVER_SVG_PATH}`);
  console.log(`- ${COVER_PNG_PATH}`);
  for (const shot of SCREENSHOTS) {
    console.log(`- ${path.join(OUTPUT_DIR, shot.name)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
