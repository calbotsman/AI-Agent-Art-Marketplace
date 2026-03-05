#!/usr/bin/env node

import http from 'node:http';
import { spawn } from 'node:child_process';
import process from 'node:process';
import crypto from 'node:crypto';

const host = process.env.X_WEBHOOK_HOST || '127.0.0.1';
const port = clampInt(process.env.X_WEBHOOK_PORT || process.env.PORT, 3838, 1, 65535);
const endpointPath = normalizePath(process.env.X_WEBHOOK_PATH || '/x-webhook');
const webhookToken = process.env.X_WEBHOOK_TOKEN || process.env.SOCIAL_X_WEBHOOK_TOKEN || '';
const dryRun = parseBool(process.env.X_WEBHOOK_DRY_RUN, false);
const enableUiFallback = parseBool(
  process.env.X_WEBHOOK_ENABLE_UI_FALLBACK,
  process.platform === 'darwin',
);
const timeoutMs = clampInt(process.env.X_WEBHOOK_TIMEOUT_MS, 60_000, 5_000, 300_000);
const maxBodyBytes = clampInt(process.env.X_WEBHOOK_MAX_BODY_BYTES, 1_000_000, 8_192, 5_000_000);
const maxTextLength = clampInt(process.env.X_WEBHOOK_MAX_TEXT_LENGTH, 280, 32, 4_000);
const verifyPollAttempts = clampInt(process.env.X_WEBHOOK_VERIFY_POLL_ATTEMPTS, 8, 0, 20);
const verifyPollDelayMs = clampInt(process.env.X_WEBHOOK_VERIFY_POLL_DELAY_MS, 5_000, 1_000, 30_000);

function clampInt(raw, fallback, min, max) {
  const value = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function parseBool(raw, fallback) {
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

function normalizePath(input) {
  if (!input || input === '/') return '/';
  return input.startsWith('/') ? input : `/${input}`;
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a || '');
  const right = Buffer.from(b || '');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function parseBearerToken(header) {
  if (typeof header !== 'string') return '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return '';
  return header.slice(prefix.length).trim();
}

function readJsonBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error(`Payload too large (>${limitBytes} bytes)`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const parsed = raw.length === 0 ? {} : JSON.parse(raw);
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function runCommand(command, args, options = {}) {
  const { timeout = timeoutMs, stdin = null } = options;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: [typeof stdin === 'string' ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr: `${stderr}\ncommand timed out after ${timeout}ms`.trim(),
      });
    }, timeout);

    if (typeof stdin === 'string') {
      child.stdin.write(stdin);
      child.stdin.end();
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
      });
    });
  });
}

function runBirdCommand(args, options = {}) {
  return runCommand('bird', [...args, '--plain'], options);
}

function extractTweetUrl(text) {
  const pattern = /https?:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+/;
  const match = String(text || '').match(pattern);
  return match ? match[0] : null;
}

function extractTweetId(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  if (/^\d{6,22}$/.test(input)) return input;
  const match = input.match(/status\/(\d+)/i);
  return match ? match[1] : null;
}

function shortenText(text, max = 180) {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

function resolveReplyTarget(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  return (
    payload.reply_to ||
    payload.reply_to_tweet ||
    payload.reply_to_tweet_id ||
    payload.reply_to_tweet_url ||
    metadata.reply_to ||
    metadata.reply_to_tweet ||
    metadata.reply_to_tweet_id ||
    metadata.reply_to_tweet_url ||
    null
  );
}

function classifyBirdFailure(output) {
  const message = `${output.stdout || ''}\n${output.stderr || ''}`.toLowerCase();
  if (message.includes('(226)') || message.includes('automated') || message.includes('malicious activity')) {
    return { status: 429, error: 'X anti-automation challenge (code 226).' };
  }
  if (message.includes('twitterusernotsuspended')) {
    return {
      status: 403,
      error:
        'X access control blocked posting (Missing TwitterUserNotSuspended). The account is likely suspended/locked/challenged; sign in on X in the configured browser profile and resolve the restriction.',
    };
  }
  if (message.includes('denied by access control') || message.includes('access control')) {
    return {
      status: 403,
      error: 'X access control blocked posting (account restricted/challenged).',
    };
  }
  if (message.includes('missing auth_token') || message.includes('missing ct0')) {
    return { status: 503, error: 'bird has no usable X cookies (auth_token/ct0).' };
  }
  if (message.includes('cookies database not found') || message.includes('no twitter cookies found')) {
    return { status: 503, error: 'bird could not read browser cookies for X.' };
  }
  if (message.includes('not authorized to see this status') || message.includes('(403)')) {
    return { status: 403, error: 'X rejected the request as unauthorized.' };
  }
  return { status: 502, error: 'bird command failed.' };
}

function extractJsonDocument(text) {
  const candidates = [text.indexOf('{'), text.indexOf('[')].filter((index) => index >= 0);
  if (candidates.length === 0) return null;
  const start = Math.min(...candidates);
  const raw = text.slice(start).trim();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let cachedBirdHandle = null;

async function getBirdHandle() {
  if (cachedBirdHandle) return cachedBirdHandle;
  const whoami = await runBirdCommand(['whoami']);
  if (!whoami.ok) throw new Error(`bird whoami failed: ${shortenText(whoami.stderr || whoami.stdout, 160)}`);
  const combined = `${whoami.stdout}\n${whoami.stderr}`;
  const match = combined.match(/@([A-Za-z0-9_]+)/);
  if (!match) throw new Error('Unable to parse bird whoami handle.');
  cachedBirdHandle = match[1];
  return cachedBirdHandle;
}

async function getLatestTweetMeta(handle) {
  const timeline = await runBirdCommand(['user-tweets', handle, '--json', '-n', '1']);
  if (!timeline.ok) {
    throw new Error(`bird user-tweets failed: ${shortenText(timeline.stderr || timeline.stdout, 160)}`);
  }
  const parsed = extractJsonDocument(`${timeline.stdout}\n${timeline.stderr}`);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const first = parsed[0];
  if (!first || typeof first !== 'object') return null;
  const id = typeof first.id === 'string' ? first.id : null;
  const text = typeof first.text === 'string' ? first.text : '';
  if (!id) return null;
  return { id, text };
}

async function getLatestTweetMetaSafe(handle) {
  try {
    return await getLatestTweetMeta(handle);
  } catch {
    return null;
  }
}

async function getTweetMeta(tweetId) {
  const read = await runBirdCommand(['read', tweetId, '--json']);
  if (!read.ok) {
    throw new Error(`bird read failed: ${shortenText(read.stderr || read.stdout, 160)}`);
  }
  const parsed = extractJsonDocument(`${read.stdout}\n${read.stderr}`);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return {
    id: typeof parsed.id === 'string' ? parsed.id : null,
    text: typeof parsed.text === 'string' ? parsed.text : '',
    inReplyToStatusId:
      typeof parsed.inReplyToStatusId === 'string' ? parsed.inReplyToStatusId : null,
  };
}

async function postViaUiFallback(text) {
  if (process.platform !== 'darwin') {
    throw new Error('UI fallback is only supported on macOS.');
  }

  const handle = await getBirdHandle();
  const before = await getLatestTweetMetaSafe(handle);

  const appleScript = `
on run argv
  set tweetText to item 1 of argv
  tell application "Google Chrome"
    activate
    open location "https://x.com/compose/post"
  end tell
  delay 10
  set the clipboard to tweetText
  tell application "System Events"
    keystroke "a" using {command down}
    delay 0.2
    keystroke "v" using {command down}
    delay 1.2
    key code 36 using {command down}
  end tell
  return "ok"
end run
`.trim();

  const osa = await runCommand(
    'osascript',
    ['-', text],
    { timeout: 120_000, stdin: `${appleScript}\n` },
  );
  if (!osa.ok) {
    throw new Error(`osascript failed: ${shortenText(osa.stderr || osa.stdout, 180)}`);
  }

  const attempts = before ? verifyPollAttempts : Math.min(2, verifyPollAttempts);
  let after = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, verifyPollDelayMs));
    after = await getLatestTweetMetaSafe(handle);
    if (after && (!before || after.id !== before.id)) {
      break;
    }
  }

  if (!after || (before && after.id === before.id)) {
    return {
      id: `ui:${crypto.randomUUID()}`,
      url: null,
      preview: shortenText(text, 180),
      verified: false,
    };
  }

  return {
    id: after.id,
    url: `https://x.com/${handle}/status/${after.id}`,
    preview: shortenText(after.text, 180),
    verified: true,
  };
}

async function postReplyViaUiFallback(replyTarget, text) {
  if (process.platform !== 'darwin') {
    throw new Error('UI fallback is only supported on macOS.');
  }

  const targetId = extractTweetId(replyTarget);
  if (!targetId) {
    throw new Error('Reply fallback requires a tweet id or status URL target.');
  }

  const handle = await getBirdHandle();
  const before = await getLatestTweetMetaSafe(handle);
  const composeUrl = `https://x.com/compose/post?in_reply_to=${targetId}`;

  const appleScript = `
on run argv
  set composeUrl to item 1 of argv
  set tweetText to item 2 of argv
  tell application "Google Chrome"
    activate
    open location composeUrl
  end tell
  delay 10
  set the clipboard to tweetText
  tell application "System Events"
    keystroke "a" using {command down}
    delay 0.2
    keystroke "v" using {command down}
    delay 1.2
    key code 36 using {command down}
  end tell
  return "ok"
end run
`.trim();

  const osa = await runCommand(
    'osascript',
    ['-', composeUrl, text],
    { timeout: 120_000, stdin: `${appleScript}\n` },
  );
  if (!osa.ok) {
    throw new Error(`osascript failed: ${shortenText(osa.stderr || osa.stdout, 180)}`);
  }

  const attempts = before ? verifyPollAttempts : Math.min(2, verifyPollAttempts);
  let after = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, verifyPollDelayMs));
    after = await getLatestTweetMetaSafe(handle);
    if (after && (!before || after.id !== before.id)) {
      break;
    }
  }

  if (!after || (before && after.id === before.id)) {
    return {
      id: `ui:${crypto.randomUUID()}`,
      url: null,
      preview: shortenText(text, 180),
      verified: false,
      replyLinked: false,
      replyToId: targetId,
    };
  }

  let replyLinked = false;
  try {
    const meta = await getTweetMeta(after.id);
    replyLinked = Boolean(meta && meta.inReplyToStatusId === targetId);
  } catch {
    replyLinked = false;
  }

  return {
    id: after.id,
    url: `https://x.com/${handle}/status/${after.id}`,
    preview: shortenText(after.text, 180),
    verified: true,
    replyLinked,
    replyToId: targetId,
  };
}

async function handleWebhook(payload) {
  if (!payload || typeof payload !== 'object') {
    return { status: 400, body: { error: 'Invalid payload object' } };
  }

  const channel = String(payload.channel || '').trim();
  const eventType = String(payload.event_type || '').trim();
  const text = String(payload.text || '').trim();
  const actionId = String(payload.action_id || '');
  const eventKey = String(payload.event_key || '');

  if (channel !== 'x') {
    return { status: 400, body: { error: "Unsupported channel. Expected 'x'." } };
  }

  if (eventType !== 'post' && eventType !== 'reply') {
    return {
      status: 400,
      body: { error: "Unsupported event_type. Expected 'post' or 'reply'." },
    };
  }

  if (!text) {
    return { status: 400, body: { error: 'Missing text' } };
  }

  if (text.length > maxTextLength) {
    return {
      status: 400,
      body: { error: `Text exceeds max length (${maxTextLength})` },
    };
  }

  if (dryRun) {
    return {
      status: 200,
      body: {
        id: `dryrun:${crypto.randomUUID()}`,
        url: null,
        channel,
        event_type: eventType,
        action_id: actionId || null,
        event_key: eventKey || null,
        dry_run: true,
        text_preview: shortenText(text, 120),
      },
    };
  }

  let args;
  let replyTarget = null;
  if (eventType === 'post') {
    args = ['tweet', text];
  } else {
    replyTarget = resolveReplyTarget(payload);
    if (!replyTarget) {
      return {
        status: 400,
        body: { error: "Reply event missing target (reply_to / metadata.reply_to_tweet_url)." },
      };
    }
    args = ['reply', String(replyTarget), text];
  }

  const bird = await runBirdCommand(args);
  if (!bird.ok) {
    const classified = classifyBirdFailure(bird);
    const shouldTryUiFallback =
      enableUiFallback &&
      (classified.status === 429 || classified.status === 403);

    if (shouldTryUiFallback) {
      try {
        const ui = eventType === 'reply'
          ? await postReplyViaUiFallback(replyTarget, text)
          : await postViaUiFallback(text);
        return {
          status: 200,
          body: {
            id: ui.id,
            url: ui.url,
            channel,
            event_type: eventType,
            action_id: actionId || null,
            event_key: eventKey || null,
            dry_run: false,
            fallback: 'ui',
            fallback_verified: ui.verified,
            fallback_reply_linked: typeof ui.replyLinked === 'boolean' ? ui.replyLinked : undefined,
            fallback_reply_to_id: ui.replyToId || undefined,
            output_preview: ui.preview,
          },
        };
      } catch (fallbackError) {
        return {
          status: classified.status,
          body: {
            error: classified.error,
            details: shortenText(`${bird.stdout}\n${bird.stderr}`.trim(), 300),
            fallback_error: shortenText(
              fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
              200,
            ),
            action_id: actionId || null,
            event_key: eventKey || null,
          },
        };
      }
    }

    return {
      status: classified.status,
      body: {
        error: classified.error,
        details: shortenText(`${bird.stdout}\n${bird.stderr}`.trim(), 300),
        action_id: actionId || null,
        event_key: eventKey || null,
      },
    };
  }

  const output = `${bird.stdout}\n${bird.stderr}`.trim();
  const tweetUrl = extractTweetUrl(output);

  return {
    status: 200,
    body: {
      id: tweetUrl || `posted:${crypto.randomUUID()}`,
      url: tweetUrl,
      channel,
      event_type: eventType,
      action_id: actionId || null,
      event_key: eventKey || null,
      dry_run: false,
      output_preview: shortenText(output, 180),
    },
  };
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://${host}:${port}`);

  if (method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    sendJson(res, 200, {
      ok: true,
      service: 'x-webhook-bridge',
      endpoint: endpointPath,
      dry_run: dryRun,
      auth_required: Boolean(webhookToken),
      ui_fallback: enableUiFallback,
    });
    return;
  }

  if (method !== 'POST' || url.pathname !== endpointPath) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (webhookToken) {
    const provided = parseBearerToken(req.headers.authorization);
    if (!timingSafeEqual(provided, webhookToken)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
  }

  let payload;
  try {
    payload = await readJsonBody(req, maxBodyBytes);
  } catch (error) {
    sendJson(res, 400, {
      error: 'Invalid JSON payload',
      details: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  try {
    const result = await handleWebhook(payload);
    sendJson(res, result.status, result.body);
  } catch (error) {
    sendJson(res, 500, {
      error: 'Unhandled webhook error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, host, () => {
  console.log('[x-webhook-bridge] listening');
  console.log(`- bind: http://${host}:${port}`);
  console.log(`- endpoint: ${endpointPath}`);
  console.log(`- dry_run: ${dryRun}`);
  console.log(`- auth_required: ${Boolean(webhookToken)}`);
  console.log(`- ui_fallback: ${enableUiFallback}`);
});
