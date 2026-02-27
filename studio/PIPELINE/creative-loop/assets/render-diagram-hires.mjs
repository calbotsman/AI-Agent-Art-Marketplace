import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = '/Users/calbotsman/clawd/studio/PIPELINE/creative-loop/assets';
const htmlPath = path.join(root, 'creative-loop-diagram.html');
const outPath = path.join(root, 'creative-loop-diagram.png');

const html = await readFile(htmlPath, 'utf8');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 3200, height: 1800 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(outPath);
