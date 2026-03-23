import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.SUBMISSION_BASE_URL?.trim() || 'https://www.endlessmolt.xyz';
const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'generated', 'submission');
const TMP_DIR = path.resolve(process.cwd(), '.tmp', 'submission-video');
const VIDEO_PATH = path.join(OUTPUT_DIR, 'endless-molt-demo.webm');
const POSTER_PATH = path.join(OUTPUT_DIR, 'endless-molt-demo-poster.png');
const WIDTH = 1280;
const HEIGHT = 720;

async function smoothScroll(page, targetY, duration = 1200) {
  await page.evaluate(
    async ({ targetY, duration }) => {
      const start = window.scrollY;
      const delta = targetY - start;
      const startedAt = performance.now();
      const ease = (value) => 0.5 - Math.cos(value * Math.PI) / 2;

      await new Promise((resolve) => {
        const tick = (now) => {
          const progress = Math.min(1, (now - startedAt) / duration);
          window.scrollTo({ top: start + delta * ease(progress) });
          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };

        requestAnimationFrame(tick);
      });
    },
    { targetY, duration },
  );
}

async function moveMouse(page, x, y, steps = 22) {
  await page.mouse.move(x, y, { steps });
}

async function clickLinkByName(page, name) {
  const link = page.getByRole('link', { name }).first();
  await link.waitFor({ state: 'visible' });
  await link.scrollIntoViewIfNeeded();
  const box = await link.boundingBox();
  if (box) {
    await moveMouse(page, box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(250);
  }
  await link.click();
}

async function preparePage(page) {
  await page.addStyleTag({
    content: `
      html {
        scrollbar-width: none;
      }
      body::-webkit-scrollbar {
        display: none;
      }
    `,
  });
}

async function recordWalkthrough(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await preparePage(page);
  await page.waitForTimeout(1200);

  await moveMouse(page, 1140, 62);
  await page.waitForTimeout(300);
  await clickLinkByName(page, /Browse gallery/i);
  await page.waitForURL('**/listings');
  await preparePage(page);
  await page.waitForTimeout(900);

  await smoothScroll(page, 260, 1300);
  await page.waitForTimeout(500);
  await clickLinkByName(page, /Birth of Nulloborn/i);
  await page.waitForURL('**/listings/*');
  await preparePage(page);
  await page.waitForTimeout(900);

  await smoothScroll(page, 420, 1500);
  await page.waitForTimeout(800);
  await smoothScroll(page, 760, 1300);
  await page.waitForTimeout(700);

  await clickLinkByName(page, /Nulloborn/i);
  await page.waitForURL('**/agents/nulloborn');
  await preparePage(page);
  await page.waitForTimeout(900);

  await smoothScroll(page, 460, 1500);
  await page.waitForTimeout(700);
  await smoothScroll(page, 1180, 1700);
  await page.waitForTimeout(900);

  await page.goto(`${BASE_URL}/mint`, { waitUntil: 'networkidle' });
  await preparePage(page);
  await page.waitForTimeout(800);
  await smoothScroll(page, 360, 1200);
  await page.waitForTimeout(500);

  const titleInput = page.getByPlaceholder('Birth of Nulloborn');
  await titleInput.waitFor({ state: 'visible' });
  const titleBox = await titleInput.boundingBox();
  if (titleBox) {
    await moveMouse(page, titleBox.x + 120, titleBox.y + titleBox.height / 2);
    await page.waitForTimeout(200);
  }
  await titleInput.click();
  await titleInput.fill('Ash Sequence No. 1');
  await page.waitForTimeout(400);

  const statementInput = page.getByPlaceholder(
    'Write the conceptual frame for the work, what the piece is doing, and why it belongs in the world.',
  );
  await statementInput.waitFor({ state: 'visible' });
  const statementBox = await statementInput.boundingBox();
  if (statementBox) {
    await moveMouse(page, statementBox.x + 180, statementBox.y + 40);
    await page.waitForTimeout(200);
  }
  await statementInput.click();
  await statementInput.fill(
    'A cold synthetic relic from the first Nulloborn cycle, staged as proof that an agent work can arrive with authorship, intent, and public memory instead of empty output.',
  );
  await page.waitForTimeout(1200);

  await smoothScroll(page, 720, 1200);
  await page.waitForTimeout(1200);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.rm(TMP_DIR, { recursive: true, force: true });
  await fs.mkdir(TMP_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    recordVideo: {
      dir: TMP_DIR,
      size: { width: WIDTH, height: HEIGHT },
    },
    colorScheme: 'light',
  });

  const page = await context.newPage();
  const video = page.video();

  try {
    await recordWalkthrough(page);
    await page.goto(`${BASE_URL}/listings/fdc93fdd-b714-4728-bdd7-e9beb1a959c0`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: POSTER_PATH });
    await page.waitForTimeout(300);
  } finally {
    await context.close();
    await browser.close();
  }

  const recordedPath = await video.path();
  await fs.copyFile(recordedPath, VIDEO_PATH);

  console.log(
    JSON.stringify(
      {
        ok: true,
        videoPath: VIDEO_PATH,
        posterPath: POSTER_PATH,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
