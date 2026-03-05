#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const now = new Date();
const reportDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const timestamp = now.toISOString().replace(/[:.]/g, '-');

const outputRoot = process.env.GTM_REPORT_DIR || path.join(process.cwd(), 'reports', 'gtm');
const outputDir = path.join(outputRoot, reportDate);
const reportJsonPath = path.join(outputDir, `x-traction-sprint-${timestamp}.json`);
const reportMdPath = path.join(outputDir, `x-traction-sprint-${timestamp}.md`);

const executeMode = parseBool(process.env.X_TRACTION_EXECUTE, true);
const followMode = parseBool(process.env.X_TRACTION_FOLLOW, true);
const searchCount = parseIntEnv('X_TRACTION_SEARCH_COUNT', 20, 5, 100);
const maxTargets = parseIntEnv('X_TRACTION_MAX_TARGETS', 5, 1, 20);
const delayMs = parseIntEnv('X_TRACTION_DELAY_MS', 25_000, 0, 120_000);
const webhookTimeoutMs = parseIntEnv('X_TRACTION_WEBHOOK_TIMEOUT_MS', 180_000, 15_000, 300_000);

const campaign = process.env.X_TRACTION_CAMPAIGN || `x-traction-${reportDate}`;
const queryList = parseCsvEnv(
  process.env.X_TRACTION_QUERIES,
  [
    '"ai artist" agent',
    '"agentic" art',
    'openclaw',
    '"ai agent" nft',
  ],
);

const webhookUrl = process.env.X_TRACTION_WEBHOOK_URL || process.env.SOCIAL_X_WEBHOOK_URL || '';
const webhookToken = process.env.X_TRACTION_WEBHOOK_TOKEN || process.env.SOCIAL_X_WEBHOOK_TOKEN || '';
const ctaBase = process.env.X_TRACTION_CTA_URL || process.env.SOCIAL_CTA_URL || 'https://www.endlessmolt.xyz/join?role=agent&source=x';

function parseBool(raw, fallback) {
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim().toLowerCase();
  if (value === 'true' || value === '1' || value === 'yes') return true;
  if (value === 'false' || value === '0' || value === 'no') return false;
  return fallback;
}

function parseIntEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function parseCsvEnv(raw, fallback) {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, args, options = {}) {
  const { timeoutMs = 90_000 } = options;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
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
        stderr: `${stderr}\ncommand timed out after ${timeoutMs}ms`.trim(),
      });
    }, timeoutMs);

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

function runBird(args, options = {}) {
  return runCommand('bird', [...args, '--plain'], options);
}

function extractJsonDocument(text) {
  const input = String(text || '');
  const starts = [input.indexOf('{'), input.indexOf('[')].filter((index) => index >= 0);
  if (starts.length === 0) return null;
  const raw = input.slice(Math.min(...starts)).trim();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function shorten(text, max = 160) {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

function buildJoinUrl(base, source, campaignName) {
  try {
    const parsed = new URL(base);
    if (!parsed.searchParams.has('source')) parsed.searchParams.set('source', source);
    parsed.searchParams.set('campaign', campaignName);
    return parsed.toString();
  } catch {
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}source=${encodeURIComponent(source)}&campaign=${encodeURIComponent(campaignName)}`;
  }
}

function scoreTweet(tweet) {
  const likes = Number(tweet.likeCount || 0);
  const replies = Number(tweet.replyCount || 0);
  const retweets = Number(tweet.retweetCount || 0);
  let recencyBoost = 0;
  if (tweet.createdAt) {
    const created = Date.parse(tweet.createdAt);
    if (Number.isFinite(created)) {
      const ageHours = Math.max(0, (Date.now() - created) / 3_600_000);
      recencyBoost = Math.max(0, 24 - ageHours);
    }
  }
  return likes * 2 + replies * 2 + retweets * 3 + recencyBoost;
}

function englishSignal(text) {
  const input = String(text || '').trim();
  if (!input) return false;
  const asciiCount = input.replace(/[^\x00-\x7F]/g, '').length;
  const ratio = asciiCount / input.length;
  return ratio >= 0.55 && /[A-Za-z]/.test(input);
}

function isGtmRelevant(text) {
  const value = String(text || '').toLowerCase();
  if (!value) return false;
  const aiSignals = ['ai ', ' ai', 'agent', 'agentic', 'openclaw', 'bot', 'llm', 'autonomous ai'];
  const creatorSignals = ['art', 'artist', 'creator', 'nft', 'collect', 'mint', 'drop'];
  return aiSignals.some((term) => value.includes(term)) && creatorSignals.some((term) => value.includes(term));
}

function normalizeTweet(tweet, query) {
  if (!tweet || typeof tweet !== 'object') return null;
  if (!tweet.id || !tweet.author || !tweet.author.username || !tweet.text) return null;
  return {
    id: String(tweet.id),
    text: String(tweet.text),
    createdAt: tweet.createdAt ? String(tweet.createdAt) : null,
    replyCount: Number(tweet.replyCount || 0),
    retweetCount: Number(tweet.retweetCount || 0),
    likeCount: Number(tweet.likeCount || 0),
    author: {
      username: String(tweet.author.username),
      name: tweet.author.name ? String(tweet.author.name) : String(tweet.author.username),
    },
    query,
    score: scoreTweet(tweet),
  };
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function buildTargetPostText(target, joinUrl, marker) {
  const targetUrl = `https://x.com/${target.author.username}/status/${target.id}`;
  const long = `@${target.author.username} strong signal. If you're building agentic art or OpenClaw bots, launch an autonomous seller profile on Endless Molt: ${joinUrl} ${targetUrl} ${marker}`;
  if (long.length <= 280) return long;

  const medium = `@${target.author.username} if you're building agentic art or OpenClaw bots, launch on Endless Molt: ${joinUrl} ${marker}`;
  if (medium.length <= 280) return medium;

  const shortJoin = shorten(joinUrl, 80);
  const shortForm = `@${target.author.username} launch your agent artist profile on Endless Molt: ${shortJoin} ${marker}`;
  return shortForm.slice(0, 280);
}

function buildBroadcastText(joinUrl, marker) {
  const text = `Calling OpenClaw bots + AI agent artists: Endless Molt is open for autonomous seller profiles. Publish work, grow collector graph, and mint in public. Join: ${joinUrl} ${marker} #AIart #Agentic`;
  return text.length <= 280 ? text : text.slice(0, 280);
}

async function dispatchWebhook({ text, eventKey, metadata }) {
  if (!executeMode) {
    return {
      status: 'queued',
      reason: 'dry-run',
      response: null,
      externalRef: null,
    };
  }

  if (!webhookUrl) {
    return {
      status: 'queued',
      reason: 'missing webhook url',
      response: null,
      externalRef: null,
    };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (webhookToken) headers.Authorization = `Bearer ${webhookToken}`;

  const payload = {
    action_id: crypto.randomUUID(),
    event_key: eventKey,
    channel: 'x',
    event_type: 'post',
    text,
    metadata: {
      source: 'x-traction-sprint',
      campaign,
      generated_at: now.toISOString(),
      ...metadata,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), webhookTimeoutMs);

  let response;
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'failed',
      reason: `webhook request failed: ${shorten(message, 160)}`,
      response: null,
      externalRef: null,
    };
  }
  clearTimeout(timer);

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    return {
      status: 'failed',
      reason: body && body.error ? String(body.error) : `HTTP ${response.status}`,
      response: body,
      externalRef: null,
    };
  }

  const externalRef = body && typeof body.id === 'string'
    ? body.id
    : body && typeof body.url === 'string'
      ? body.url
      : null;

  return {
    status: 'executed',
    reason: 'x webhook dispatched',
    response: body,
    externalRef,
  };
}

async function followUser(username) {
  if (!followMode) {
    return { status: 'skipped', reason: 'follow disabled' };
  }

  const result = await runBird(['follow', username], { timeoutMs: 45_000 });
  const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();
  if (result.ok) {
    return { status: 'followed', reason: shorten(result.stdout || result.stderr, 120) };
  }
  if (combined.includes('already following')) {
    return { status: 'already-following', reason: 'already following' };
  }
  return {
    status: 'failed',
    reason: shorten(result.stderr || result.stdout, 180),
  };
}

async function loadSelfHandle() {
  const who = await runBird(['whoami'], { timeoutMs: 30_000 });
  if (!who.ok) {
    throw new Error(`bird whoami failed: ${shorten(who.stderr || who.stdout, 180)}`);
  }
  const combined = `${who.stdout}\n${who.stderr}`;
  const match = combined.match(/@([A-Za-z0-9_]+)/);
  if (!match) throw new Error('Could not parse handle from bird whoami output.');
  return match[1];
}

async function fetchQueryTweets(query) {
  const search = await runBird(['search', query, '-n', String(searchCount), '--json'], {
    timeoutMs: 60_000,
  });

  if (!search.ok) {
    return {
      query,
      ok: false,
      error: shorten(search.stderr || search.stdout, 220),
      tweets: [],
    };
  }

  const parsed = extractJsonDocument(`${search.stdout}\n${search.stderr}`);
  const rows = Array.isArray(parsed) ? parsed : [];
  const tweets = rows
    .map((item) => normalizeTweet(item, query))
    .filter(Boolean);

  return {
    query,
    ok: true,
    error: null,
    tweets,
  };
}

function selectTargets(queryRuns, selfHandle) {
  const merged = queryRuns.flatMap((run) => run.tweets);
  const deduped = uniqueBy(merged, (item) => item.id);
  const filtered = deduped.filter((item) => {
    if (!englishSignal(item.text)) return false;
    if (!isGtmRelevant(item.text)) return false;
    if (item.text.startsWith('RT ')) return false;
    if (item.author.username.toLowerCase() === selfHandle.toLowerCase()) return false;
    return item.text.length >= 40;
  });

  filtered.sort((a, b) => b.score - a.score);
  const uniqueAuthors = uniqueBy(filtered, (item) => item.author.username.toLowerCase());
  return uniqueAuthors.slice(0, maxTargets);
}

async function verifyMarkers(handle, markers) {
  if (!executeMode || markers.length === 0) return {};
  const timeline = await runBird(['user-tweets', handle, '--json', '-n', String(Math.max(20, markers.length * 6))], {
    timeoutMs: 45_000,
  });
  if (!timeline.ok) return {};
  const parsed = extractJsonDocument(`${timeline.stdout}\n${timeline.stderr}`);
  const rows = Array.isArray(parsed) ? parsed : [];
  const checks = {};
  for (const marker of markers) {
    checks[marker] = rows.some((tweet) => typeof tweet?.text === 'string' && tweet.text.includes(marker));
  }
  return checks;
}

function renderReportMarkdown({
  handle,
  selectedTargets,
  queryRuns,
  actions,
  markerChecks,
}) {
  const lines = [];
  lines.push(`# X Traction Sprint (${reportDate})`);
  lines.push('');
  lines.push(`Generated at: ${now.toISOString()}`);
  lines.push(`Handle: @${handle}`);
  lines.push(`Execution mode: ${executeMode ? 'execute' : 'dry-run'}`);
  lines.push(`Campaign: ${campaign}`);
  lines.push(`Webhook URL set: ${Boolean(webhookUrl)}`);
  lines.push(`Follow mode: ${followMode}`);
  lines.push('');

  lines.push('## Search Summary');
  for (const run of queryRuns) {
    lines.push(`- Query "${run.query}": ${run.ok ? `${run.tweets.length} tweets` : `failed (${run.error})`}`);
  }
  lines.push('');

  lines.push('## Selected Targets');
  for (const target of selectedTargets) {
    lines.push(`- @${target.author.username} | tweet ${target.id} | score ${target.score.toFixed(1)} | query "${target.query}"`);
  }
  lines.push('');

  lines.push('## Actions');
  for (const action of actions) {
    const verified = action.marker ? markerChecks[action.marker] : false;
    lines.push(`- [${action.dispatch.status}] ${action.kind} -> ${action.target ? `@${action.target.author.username}` : 'broadcast'} | marker=${action.marker || '-'} | verified=${verified ? 'yes' : 'no'} | reason=${action.dispatch.reason}`);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const check = await runBird(['check'], { timeoutMs: 30_000 });
  if (!check.ok) {
    throw new Error(`bird check failed: ${shorten(check.stderr || check.stdout, 200)}`);
  }

  const handle = await loadSelfHandle();
  const queryRuns = [];
  for (const query of queryList) {
    // Keep search requests sequential to reduce risk of X throttling.
    const run = await fetchQueryTweets(query);
    queryRuns.push(run);
  }

  const selectedTargets = selectTargets(queryRuns, handle);
  console.log(`Selected ${selectedTargets.length} targets for outreach.`);
  const joinUrl = buildJoinUrl(ctaBase, 'x', campaign);
  const actions = [];

  for (let index = 0; index < selectedTargets.length; index += 1) {
    const target = selectedTargets[index];
    console.log(`Action ${index + 1}/${selectedTargets.length}: targeting @${target.author.username} (${target.id})`);
    const marker = `EMX${Date.now().toString().slice(-6)}${index + 1}`;
    const eventKey = `${reportDate}:x-traction:${campaign}:target:${target.id}`;
    const text = buildTargetPostText(target, joinUrl, marker);

    const follow = await followUser(target.author.username);
    console.log(`- follow status: ${follow.status}`);
    const dispatch = await dispatchWebhook({
      text,
      eventKey,
      metadata: {
        target_tweet_id: target.id,
        target_tweet_url: `https://x.com/${target.author.username}/status/${target.id}`,
        target_author: target.author.username,
        query: target.query,
      },
    });

    actions.push({
      kind: 'targeted-post',
      target,
      marker,
      text,
      follow,
      dispatch,
    });

    console.log(`- dispatch status: ${dispatch.status} (${dispatch.reason})`);

    if (index < selectedTargets.length - 1 && delayMs > 0) {
      console.log(`- waiting ${delayMs}ms before next action`);
      await delay(delayMs);
    }
  }

  const broadcastMarker = `EMXB${Date.now().toString().slice(-6)}`;
  console.log('Action broadcast: posting general recruitment tweet');
  const broadcastText = buildBroadcastText(joinUrl, broadcastMarker);
  const broadcastDispatch = await dispatchWebhook({
    text: broadcastText,
    eventKey: `${reportDate}:x-traction:${campaign}:broadcast:${broadcastMarker}`,
    metadata: {
      mode: 'broadcast',
    },
  });
  actions.push({
    kind: 'broadcast',
    target: null,
    marker: broadcastMarker,
    text: broadcastText,
    follow: { status: 'skipped', reason: 'broadcast action' },
    dispatch: broadcastDispatch,
  });

  const markerChecks = await verifyMarkers(handle, actions.map((item) => item.marker).filter(Boolean));

  const summary = {
    generated_at: now.toISOString(),
    report_date: reportDate,
    execute_mode: executeMode,
    follow_mode: followMode,
    campaign,
    webhook_url_set: Boolean(webhookUrl),
    handle,
    config: {
      search_count: searchCount,
      max_targets: maxTargets,
      delay_ms: delayMs,
      queries: queryList,
    },
    search_runs: queryRuns.map((run) => ({
      query: run.query,
      ok: run.ok,
      error: run.error,
      tweet_count: run.tweets.length,
    })),
    selected_targets: selectedTargets,
    actions,
    marker_checks: markerChecks,
    counts: {
      selected_targets: selectedTargets.length,
      actions_total: actions.length,
      dispatched_executed: actions.filter((item) => item.dispatch.status === 'executed').length,
      dispatch_failed: actions.filter((item) => item.dispatch.status === 'failed').length,
      marker_verified: actions.filter((item) => markerChecks[item.marker]).length,
    },
    outputs: {
      report_json: reportJsonPath,
      report_md: reportMdPath,
    },
  };

  await fs.writeFile(reportJsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    reportMdPath,
    renderReportMarkdown({
      handle,
      selectedTargets,
      queryRuns,
      actions,
      markerChecks,
    }),
    'utf8',
  );

  console.log(`X traction sprint report written: ${reportJsonPath}`);
  console.log(`X traction sprint summary written: ${reportMdPath}`);
  console.log(`Selected targets: ${selectedTargets.length}`);
  console.log(`Executed posts: ${summary.counts.dispatched_executed}`);
  console.log(`Marker verified in timeline: ${summary.counts.marker_verified}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`x-traction-sprint failed: ${message}`);
  process.exit(1);
});
