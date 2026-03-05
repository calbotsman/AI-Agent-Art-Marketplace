#!/usr/bin/env node

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const DEFAULT_BOARD = process.env.ARENA_BOARD_URL || process.env.ARENA_BOARD || "";
const DEFAULT_OUTPUT = process.env.ARENA_OUTPUT_DIR || "/Users/calbotsman/clawd/models/lora/studio-logo-lora-training-data";
const DEFAULT_STATE_FILE =
  process.env.ARENA_STATE_FILE ||
  path.join(process.env.HOME || "/tmp", ".openclaw/credentials/arena-storage-state.json");
const DEFAULT_CREDENTIAL_FILE =
  process.env.ARENA_CREDENTIAL_FILE || path.join(process.env.HOME || "/tmp", ".openclaw/credentials/arena-credentials.json");
const DEFAULT_BOARD_REF = process.env.ARENA_OP_BOARD_REF || "op://Cal Automation/Are.na/board";

const USERNAME_SELECTORS = [
  'input[name="email_or_username"]',
  'input[name="username"]',
  'input[name="email"]',
  'input[type="email"]',
  "input#username",
  "input#email",
];

const PASSWORD_SELECTORS = ['input[name="password"]', 'input[type="password"]', "input#password"];

const SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button:has-text("Log in")',
  'button:has-text("Sign in")',
  'button:has-text("Continue")',
];

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/sync_arena_to_lora.mjs [--board <are.na board url or user/board>] [options]",
      "",
      "Options:",
      "  --board <value>        Board URL (or user/board path). Falls back to env/1Password if omitted.",
      `  --output <path>        Destination folder (default: ${DEFAULT_OUTPUT})`,
      "  --max <n>              Maximum files to download (default: 200)",
      "  --state-file <path>    Playwright storage state file path",
      `  --credential-file <p>  Cached credentials JSON path (default: ${DEFAULT_CREDENTIAL_FILE})`,
      "  --headful              Run browser in headed mode",
      "  --help                 Show this help",
      "",
      "Auth resolution (automatic):",
      "  1) Existing browser session from --state-file",
      "  2) Env vars: ARENA_USERNAME / ARENA_PASSWORD",
      `  2.1) Cached credentials JSON (${DEFAULT_CREDENTIAL_FILE})`,
      "  2.5) Board source (no hardcoded URL mode):",
      "     --board arg > ARENA_BOARD / ARENA_BOARD_URL > ARENA_OP_BOARD_REF",
      `     (default board ref: ${DEFAULT_BOARD_REF})`,
      "  3) 1Password refs:",
      "     ARENA_OP_USERNAME_REF (default: op://Cal Automation/Are.na/username)",
      "     ARENA_OP_PASSWORD_REF (default: op://Cal Automation/Are.na/password)",
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {
    board: DEFAULT_BOARD,
    output: DEFAULT_OUTPUT,
    max: Number.parseInt(process.env.ARENA_SYNC_MAX || "200", 10),
    headful: false,
    stateFile: DEFAULT_STATE_FILE,
    credentialFile: DEFAULT_CREDENTIAL_FILE,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--headful") {
      args.headful = true;
      continue;
    }
    if (arg === "--board") {
      args.board = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output") {
      args.output = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--state-file") {
      args.stateFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--credential-file") {
      args.credentialFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--max") {
      args.max = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
  }

  return args;
}

function toBoardUrl(raw) {
  const value = (raw || "").trim();
  if (!value) return "";

  if (value.startsWith("https://") || value.startsWith("http://")) {
    return value;
  }

  const cleaned = value.replace(/^https?:\/\//, "").replace(/^www\./, "");
  if (cleaned.startsWith("are.na/")) {
    return `https://${cleaned}`;
  }

  const pathValue = cleaned.replace(/^\/+/, "");
  if (!pathValue.includes("/")) {
    throw new Error(
      'Board value must be a full URL or "user/board-slug" path. Example: https://www.are.na/username/logo-board'
    );
  }

  return `https://www.are.na/${pathValue}`;
}

function getBoardValue(rawBoard) {
  const direct = (rawBoard || "").trim();
  if (direct) {
    return direct;
  }

  const envBoard = process.env.ARENA_BOARD_URL || process.env.ARENA_BOARD;
  if (envBoard && envBoard.trim()) {
    return envBoard.trim();
  }

  return readOnePassword(DEFAULT_BOARD_REF);
}

function readOnePassword(ref) {
  try {
    const value = execFileSync("op", ["read", ref], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

    if (!value) {
      throw new Error(`1Password reference returned empty value: ${ref}`);
    }
    return value;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read 1Password ref ${ref}: ${error.message}`);
    }
    throw error;
  }
}

function parseCredentialsFromFile(raw) {
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || !parsed) {
    return null;
  }

  const username = typeof parsed.username === "string" && parsed.username.trim() ? parsed.username.trim() : "";
  const password = typeof parsed.password === "string" && parsed.password.trim() ? parsed.password.trim() : "";

  if (!username || !password) return null;
  return { username, password };
}

async function readCachedCredentials(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = parseCredentialsFromFile(raw);
    if (!parsed) return null;
    return { ...parsed, source: "cache" };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function saveCachedCredentials(filePath, creds) {
  if (!creds || creds.source === "cache") return;
  const payload = {
    username: creds.username,
    password: creds.password,
    updatedAt: new Date().toISOString(),
  };
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.chmod(filePath, 0o600).catch(() => {});
}

async function getCredentials(credentialFile) {
  if (process.env.ARENA_USERNAME && process.env.ARENA_PASSWORD) {
    return {
      username: process.env.ARENA_USERNAME,
      password: process.env.ARENA_PASSWORD,
      source: "env",
    };
  }

  const cached = await readCachedCredentials(credentialFile);
  if (cached) return cached;

  const usernameRef = process.env.ARENA_OP_USERNAME_REF || "op://Cal Automation/Are.na/username";
  const passwordRef = process.env.ARENA_OP_PASSWORD_REF || "op://Cal Automation/Are.na/password";

  return {
    username: readOnePassword(usernameRef),
    password: readOnePassword(passwordRef),
    source: "1password",
  };
}

async function firstVisibleLocator(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if ((await locator.count()) > 0 && (await locator.isVisible())) {
        return locator;
      }
    } catch {
      // Try next selector.
    }
  }
  return null;
}

async function loginIfNeeded(page, boardUrl, creds) {
  await page.goto(boardUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);

  const loginField = await firstVisibleLocator(page, USERNAME_SELECTORS);
  const authWallLinkCount = await page
    .locator('a[href*="/login?profileId="], a[href*="/sign_up?profileId="], a[href*="redirectTo=%2F"]')
    .count();
  const needsLogin = page.url().includes("/login") || Boolean(loginField) || authWallLinkCount > 0;

  if (!needsLogin) {
    return { loggedIn: false };
  }

  await page.goto("https://www.are.na/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(700);

  const username = await firstVisibleLocator(page, USERNAME_SELECTORS);
  const password = await firstVisibleLocator(page, PASSWORD_SELECTORS);
  if (!username || !password) {
    throw new Error("Could not find Are.na login fields on login page.");
  }

  await username.fill(creds.username);
  await password.fill(creds.password);
  await Promise.all([
    password.press("Enter"),
    page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {}),
  ]);

  await page.waitForTimeout(1500);

  // Fallback: if Enter did not submit, click submit button.
  const stillOnLogin = page.url().includes("/login") || Boolean(await firstVisibleLocator(page, USERNAME_SELECTORS));
  if (stillOnLogin) {
    const submit = await firstVisibleLocator(page, SUBMIT_SELECTORS);
    if (!submit) {
      throw new Error("Could not find Are.na login submit button.");
    }
    await Promise.all([
      submit.click(),
      page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {}),
    ]);
    await page.waitForTimeout(1500);
  }

  await page.goto(boardUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);

  const postLoginField = await firstVisibleLocator(page, USERNAME_SELECTORS);
  const postLoginAuthWallCount = await page
    .locator('a[href*="/login?profileId="], a[href*="/sign_up?profileId="], a[href*="redirectTo=%2F"]')
    .count();
  if (page.url().includes("/login") || postLoginField || postLoginAuthWallCount > 0) {
    throw new Error("Are.na login appears to have failed. Check credentials in 1Password item: Are.na");
  }

  return { loggedIn: true };
}

function pickFromSrcset(srcset) {
  if (!srcset) return null;
  let best = { url: null, score: -1 };
  const entries = srcset.split(",");
  for (const entry of entries) {
    const parts = entry.trim().split(/\s+/);
    if (!parts[0]) continue;
    const descriptor = parts[1] || "";
    let score = 1;
    if (descriptor.endsWith("w")) {
      score = Number.parseInt(descriptor.slice(0, -1), 10) || 1;
    } else if (descriptor.endsWith("x")) {
      const mult = Number.parseFloat(descriptor.slice(0, -1));
      score = Number.isFinite(mult) ? mult * 1000 : 1;
    }
    if (score > best.score) {
      best = { url: parts[0], score };
    }
  }
  return best.url;
}

function normalizeImageUrl(candidate, origin) {
  if (!candidate || typeof candidate !== "string") return null;
  const raw = candidate.trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return null;
  try {
    return new URL(raw, origin).toString();
  } catch {
    return null;
  }
}

function decodeArenaProxyUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "images.are.na") return null;
    const token = parsed.pathname.replace(/^\/+/, "");
    if (!token) return null;
    const base = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base}${"===".slice((base.length + 3) % 4)}`;
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    if (!decoded || typeof decoded !== "object" || !decoded.key || !decoded.bucket) return null;
    if (decoded.bucket === "arena_images") {
      return `https://d2w9rnfcy7mm78.cloudfront.net/${decoded.key}`;
    }
    return null;
  } catch {
    return null;
  }
}

function looksLikeImageUrl(url) {
  if (!url) return false;
  const lowered = url.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|avif)(\?|$)/.test(lowered)) return true;
  if (lowered.includes("cloudfront.net") || lowered.includes("are.na")) return true;
  return false;
}

async function collectImageUrls(page, maxRounds = 35) {
  const found = new Set();
  let stagnantRounds = 0;
  let previousCount = 0;

  for (let i = 0; i < maxRounds; i += 1) {
    const urls = await page.evaluate(() => {
      const candidates = new Set();
      const imgNodes = Array.from(document.querySelectorAll("img"));
      for (const img of imgNodes) {
        if (img.currentSrc) candidates.add(img.currentSrc);
        if (img.src) candidates.add(img.src);
        if (img.getAttribute("data-src")) candidates.add(img.getAttribute("data-src"));
        if (img.srcset) {
          candidates.add(img.srcset);
        }
      }
      return Array.from(candidates);
    });

    for (const candidate of urls) {
      const bestFromSrcset = candidate.includes(",") && /\s\d+[wx]\b/.test(candidate) ? pickFromSrcset(candidate) : null;
      const normalized = normalizeImageUrl(bestFromSrcset || candidate, page.url());
      if (normalized && looksLikeImageUrl(normalized)) {
        found.add(decodeArenaProxyUrl(normalized) || normalized);
      }
    }

    if (found.size === previousCount) {
      stagnantRounds += 1;
    } else {
      stagnantRounds = 0;
      previousCount = found.size;
    }

    if (stagnantRounds >= 3) break;

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
  }

  return Array.from(found);
}

function extFromContentType(contentType) {
  if (!contentType) return null;
  const value = contentType.toLowerCase();
  if (value.includes("image/png")) return "png";
  if (value.includes("image/jpeg")) return "jpg";
  if (value.includes("image/webp")) return "webp";
  if (value.includes("image/gif")) return "gif";
  if (value.includes("image/avif")) return "avif";
  return null;
}

function extFromUrl(url) {
  const match = url.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
  if (!match) return null;
  const ext = match[1];
  return ["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext) ? (ext === "jpeg" ? "jpg" : ext) : null;
}

function hashForUrl(url) {
  return crypto.createHash("sha1").update(url).digest("hex").slice(0, 12);
}

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

async function existingHashes(outputDir) {
  const set = new Set();
  try {
    const files = await fs.readdir(outputDir);
    for (const file of files) {
      const match = file.match(/-([0-9a-f]{12})\.[a-z0-9]+$/i);
      if (match) set.add(match[1]);
    }
  } catch {
    return set;
  }
  return set;
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function downloadImages(urls, outputDir, maxFiles) {
  const limit = Math.max(1, maxFiles);
  const selected = urls.slice(0, limit);
  const knownHashes = await existingHashes(outputDir);

  const downloaded = [];
  const skipped = [];
  const failed = [];

  for (let i = 0; i < selected.length; i += 1) {
    const url = selected[i];
    const hash = hashForUrl(url);

    if (knownHashes.has(hash)) {
      skipped.push({ sourceUrl: url, reason: "already_exists" });
      continue;
    }

    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        },
      });

      if (!res.ok) {
        failed.push({ sourceUrl: url, reason: `http_${res.status}` });
        continue;
      }

      const contentType = res.headers.get("content-type") || "";
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length < 2048) {
        failed.push({ sourceUrl: url, reason: "too_small" });
        continue;
      }

      const ext = extFromContentType(contentType) || extFromUrl(url) || "jpg";
      const fileName = `arena-logo-${String(downloaded.length + 1).padStart(4, "0")}-${hash}.${ext}`;
      const target = path.join(outputDir, fileName);

      await fs.writeFile(target, bytes);
      downloaded.push({
        fileName,
        path: target,
        bytes: bytes.length,
        sourceUrl: url,
      });
      knownHashes.add(hash);
    } catch (err) {
      failed.push({ sourceUrl: url, reason: err instanceof Error ? err.message : "download_error" });
    }
  }

  return { downloaded, skipped, failed, selectedCount: selected.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  if (!Number.isFinite(args.max) || args.max < 1) {
    throw new Error("--max must be a positive integer.");
  }

  const boardUrl = toBoardUrl(getBoardValue(args.board));
  if (!boardUrl) {
    throw new Error(
      "Missing board reference. Provide --board, set ARENA_BOARD, ARENA_BOARD_URL, or configure ARENA_OP_BOARD_REF in 1Password."
    );
  }

  const outputDir = path.resolve(args.output);
  const stateFile = path.resolve(args.stateFile);
  const credentialFile = path.resolve(args.credentialFile);

  await ensureDir(outputDir);
  await ensureDir(path.dirname(stateFile));

  let browser;
  try {
    browser = await chromium.launch({ headless: !args.headful });
    let context;
    try {
      context = await browser.newContext({ storageState: stateFile });
    } catch {
      context = await browser.newContext();
    }

    const page = await context.newPage();
    const creds = await getCredentials(credentialFile);
    const { loggedIn } = await loginIfNeeded(page, boardUrl, creds);
    if (loggedIn) {
      await saveCachedCredentials(credentialFile, creds);
    }

    const urls = await collectImageUrls(page);
    if (urls.length === 0) {
      throw new Error(`No candidate images found on board page: ${boardUrl}`);
    }

    const result = await downloadImages(urls, outputDir, args.max);
    await context.storageState({ path: stateFile });
    await fs.chmod(stateFile, 0o600).catch(() => {});

    const manifest = {
      createdAt: new Date().toISOString(),
      boardUrl,
      outputDir,
      stateFile,
      auth: {
        credentialsSource: creds.source,
        loggedInThisRun: loggedIn,
      },
      discoveredImageUrls: urls.length,
      attemptedDownloads: result.selectedCount,
      downloaded: result.downloaded.length,
      skippedExisting: result.skipped.length,
      failed: result.failed.length,
      files: result.downloaded,
      skipped: result.skipped,
      failures: result.failed,
    };

    const manifestPath = path.join(outputDir, `arena-sync-manifest-${nowStamp()}.json`);
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    console.log(`Board: ${boardUrl}`);
    console.log(`Discovered URLs: ${urls.length}`);
    console.log(`Downloaded: ${result.downloaded.length}`);
    console.log(`Skipped existing: ${result.skipped.length}`);
    console.log(`Failed: ${result.failed.length}`);
    console.log(`Output: ${outputDir}`);
    console.log(`Manifest: ${manifestPath}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main().catch((err) => {
  console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
