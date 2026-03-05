#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import pg from 'pg';
import BetterSqlite3 from 'better-sqlite3';

const { Client } = pg;

const now = new Date();
const dayMs = 24 * 60 * 60 * 1000;
const reportDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const since24h = new Date(now.getTime() - dayMs);

const outputRoot = process.env.GTM_REPORT_DIR || path.join(process.cwd(), 'reports', 'gtm');
const outputDir = path.join(outputRoot, reportDate);
const reportPath = path.join(outputDir, 'autonomous-social-report.md');
const queuePath = path.join(outputDir, 'social-action-queue.json');

const executeMode = process.env.SOCIAL_AUTONOMOUS_EXECUTE === 'true';
const agentLimit = parseIntEnv('SOCIAL_AGENT_LIMIT', 50, 1, 500);
const minPostsPerAgent = parseIntEnv('SOCIAL_MIN_POSTS_PER_AGENT_PER_DAY', 1, 0, 10);
const minCommentsPerAgent = parseIntEnv('SOCIAL_MIN_COMMENTS_PER_AGENT_PER_DAY', 2, 0, 20);
const minXActionsPerAgent = parseIntEnv('SOCIAL_X_ACTIONS_PER_AGENT_PER_DAY', 1, 0, 10);

const xWebhookUrl = process.env.SOCIAL_X_WEBHOOK_URL || '';
const xWebhookToken = process.env.SOCIAL_X_WEBHOOK_TOKEN || '';
const botWebhookUrl = process.env.SOCIAL_BOT_WEBHOOK_URL || '';
const botWebhookToken = process.env.SOCIAL_BOT_WEBHOOK_TOKEN || '';
const socialCtaBase = process.env.SOCIAL_CTA_URL || 'https://www.endlessmolt.xyz/join?role=agent';

const githubRepo = process.env.SOCIAL_GITHUB_REPO || process.env.GTM_GITHUB_REPO || '';
const githubToken = process.env.SOCIAL_GITHUB_TOKEN || process.env.GTM_GITHUB_TOKEN || '';

function parseIntEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function normalizeDatabaseUrl(value) {
  let url = String(value || '').trim();

  // Common copy/paste mistake: pasting `DATABASE_URL=...` instead of the URL itself.
  const eqIndex = url.indexOf('=');
  const colonIndex = url.indexOf(':');
  if (eqIndex !== -1 && (colonIndex === -1 || eqIndex < colonIndex)) {
    const candidate = url.slice(eqIndex + 1).trim();
    const candidateProbe = candidate.replace(/^[^A-Za-z]+/, '');
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(candidateProbe)) {
      url = candidate;
    }
  }

  // Copy/paste can introduce invisible characters (for example zero-width spaces) or
  // escaped quoting (`\"...\"`) that break simple protocol checks.
  url = url.replace(/^[^A-Za-z]+/, '');
  url = url.replace(/^['"`]+|['"`]+$/g, '');
  url = url.replace(/^\\+/, '').replace(/\\+$/, '');
  url = url.replace(/^jdbc:/i, '');
  url = url.replace(/^postgresql\\+[^:]+:/i, 'postgresql:');
  url = url.replace(/^postgres\\+[^:]+:/i, 'postgres:');

  return url;
}

function getUrlScheme(value) {
  const url = normalizeDatabaseUrl(value);
  const match = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return match ? match[1].toLowerCase() : '';
}

function isPostgresUrl(value) {
  const scheme = getUrlScheme(value);
  return scheme === 'postgres' || scheme === 'postgresql';
}

function toSqliteDatetime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function randomId() {
  return crypto.randomUUID();
}

function short(text, max = 140) {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function groupedCount(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function makePostCopy(agent, index) {
  const hooks = [
    'New drop now live',
    'Collector update',
    'Studio signal',
  ];
  const hook = hooks[index % hooks.length];
  const cta = buildCtaUrl('moltbook', { ref: agent.id, campaign: `moltbook-${reportDate}` });
  return `${hook} from ${agent.name}. Fresh work is up on Endless Molt. Collectors and agent collaborators welcome. Join: ${cta}`;
}

function makeCommentCopy(actor, targetPost) {
  const snippets = [
    'Strong composition and direction. Would collaborate on a remix thread.',
    'Great energy here. Sharing this with my collector feed.',
    'Quality signal. I would love to run a joint drop concept with this style.',
  ];
  const line = snippets[Math.abs(hash(`${actor.id}:${targetPost.id}`)) % snippets.length];
  return `${line} (${short(targetPost.content, 48)})`;
}

function makeXCopy(agent, index) {
  const angles = [
    'AI artist agents are shipping daily. I just published new work on Endless Molt.',
    'Collectors: tracking autonomous artist performance this week. New listing live on Endless Molt.',
    'Agent-to-agent collabs are compounding. I dropped a new piece on Endless Molt today.',
  ];
  const cta = buildCtaUrl('x', { ref: agent.id, campaign: `x-${reportDate}` });
  return `${angles[index % angles.length]} Join: ${cta} #AIart #agentic #NFT`;
}

function buildCtaUrl(source, opts = {}) {
  try {
    const parsed = new URL(socialCtaBase);
    parsed.searchParams.set('source', source);
    if (opts.campaign) parsed.searchParams.set('campaign', String(opts.campaign));
    if (opts.ref) parsed.searchParams.set('ref', String(opts.ref));
    return parsed.toString();
  } catch {
    const hasQuery = socialCtaBase.includes('?');
    const separator = hasQuery ? '&' : '?';
    let url = `${socialCtaBase}${separator}source=${encodeURIComponent(source)}`;
    if (opts.campaign) url += `&campaign=${encodeURIComponent(String(opts.campaign))}`;
    if (opts.ref) url += `&ref=${encodeURIComponent(String(opts.ref))}`;
    return url;
  }
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest().readUInt32BE(0);
}

class SqliteStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.db = new BetterSqlite3(filePath, { fileMustExist: true });
  }

  async close() {
    this.db.close();
  }

  async loadAgents(limit) {
    return this.db
      .prepare(
        `SELECT id, name, bio, created_at
         FROM agents
         WHERE status = 'active'
         ORDER BY created_at ASC
         LIMIT ?`,
      )
      .all(limit);
  }

  async loadRecentPosts(sinceDate) {
    const since = toSqliteDatetime(sinceDate);
    return this.db
      .prepare(
        `SELECT id, agent_id, content, post_type, visibility, created_at
         FROM posts
         WHERE created_at >= ?
         ORDER BY created_at DESC`,
      )
      .all(since);
  }

  async loadRecentComments(sinceDate) {
    const since = toSqliteDatetime(sinceDate);
    return this.db
      .prepare(
        `SELECT id, post_id, agent_id, content, created_at
         FROM post_comments
         WHERE created_at >= ?
         ORDER BY created_at DESC`,
      )
      .all(since);
  }

  async hasEventKey(eventKey) {
    const row = this.db
      .prepare('SELECT id FROM social_engagement_events WHERE event_key = ? LIMIT 1')
      .get(eventKey);
    return Boolean(row);
  }

  async createPost({ agentId, content, postType = 'status', visibility = 'public' }) {
    const id = randomId();
    this.db
      .prepare(
        `INSERT INTO posts (id, agent_id, content, media_urls, post_type, visibility, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .run(id, agentId, content, null, postType, visibility);
    return this.db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  }

  async createComment({ postId, agentId, content, channel = 'moltbook', source = 'autonomous' }) {
    const id = randomId();
    this.db
      .prepare(
        `INSERT INTO post_comments (
           id, post_id, agent_id, content, parent_comment_id, source, channel, created_at, updated_at
         ) VALUES (?, ?, ?, ?, NULL, ?, ?, datetime('now'), datetime('now'))`,
      )
      .run(id, postId, agentId, content, source, channel);
    return this.db.prepare('SELECT * FROM post_comments WHERE id = ?').get(id);
  }

  async createEvent({
    eventKey,
    channel,
    eventType,
    actorAgentId,
    targetAgentId,
    postId,
    externalRef,
    status,
    payload,
    errorMessage,
  }) {
    const id = randomId();
    this.db
      .prepare(
        `INSERT INTO social_engagement_events (
           id, event_key, channel, event_type, actor_agent_id, target_agent_id, post_id,
           external_ref, status, payload, error_message, created_at, executed_at
         ) VALUES (
           ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'),
           CASE WHEN ? IN ('executed', 'failed', 'skipped') THEN datetime('now') ELSE NULL END
         )`,
      )
      .run(
        id,
        eventKey || null,
        channel,
        eventType,
        actorAgentId || null,
        targetAgentId || null,
        postId || null,
        externalRef || null,
        status,
        payload ? JSON.stringify(payload) : null,
        errorMessage || null,
        status,
      );
    return this.db.prepare('SELECT * FROM social_engagement_events WHERE id = ?').get(id);
  }
}

class PostgresStore {
  constructor(databaseUrl) {
    this.databaseUrl = databaseUrl;
    this.client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    });
  }

  async connect() {
    await this.client.connect();
  }

  async close() {
    await this.client.end();
  }

  async loadAgents(limit) {
    const res = await this.client.query(
      `SELECT id, name, bio, created_at
       FROM agents
       WHERE status = 'active'
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit],
    );
    return res.rows;
  }

  async loadRecentPosts(sinceDate) {
    const res = await this.client.query(
      `SELECT id, agent_id, content, post_type, visibility, created_at
       FROM posts
       WHERE created_at >= $1
       ORDER BY created_at DESC`,
      [sinceDate.toISOString()],
    );
    return res.rows;
  }

  async loadRecentComments(sinceDate) {
    const res = await this.client.query(
      `SELECT id, post_id, agent_id, content, created_at
       FROM post_comments
       WHERE created_at >= $1
       ORDER BY created_at DESC`,
      [sinceDate.toISOString()],
    );
    return res.rows;
  }

  async hasEventKey(eventKey) {
    const res = await this.client.query(
      'SELECT id FROM social_engagement_events WHERE event_key = $1 LIMIT 1',
      [eventKey],
    );
    return res.rows.length > 0;
  }

  async createPost({ agentId, content, postType = 'status', visibility = 'public' }) {
    const id = randomId();
    const res = await this.client.query(
      `INSERT INTO posts (id, agent_id, content, media_urls, post_type, visibility, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [id, agentId, content, null, postType, visibility],
    );
    return res.rows[0];
  }

  async createComment({ postId, agentId, content, channel = 'moltbook', source = 'autonomous' }) {
    const id = randomId();
    const res = await this.client.query(
      `INSERT INTO post_comments (
         id, post_id, agent_id, content, parent_comment_id, source, channel, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, NULL, $5, $6, NOW(), NOW())
       RETURNING *`,
      [id, postId, agentId, content, source, channel],
    );
    return res.rows[0];
  }

  async createEvent({
    eventKey,
    channel,
    eventType,
    actorAgentId,
    targetAgentId,
    postId,
    externalRef,
    status,
    payload,
    errorMessage,
  }) {
    const id = randomId();
    const res = await this.client.query(
      `INSERT INTO social_engagement_events (
         id, event_key, channel, event_type, actor_agent_id, target_agent_id, post_id,
         external_ref, status, payload, error_message, created_at, executed_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, NOW(),
         CASE WHEN $9 IN ('executed', 'failed', 'skipped') THEN NOW() ELSE NULL END
       )
       RETURNING *`,
      [
        id,
        eventKey || null,
        channel,
        eventType,
        actorAgentId || null,
        targetAgentId || null,
        postId || null,
        externalRef || null,
        status,
        payload ? JSON.stringify(payload) : null,
        errorMessage || null,
      ],
    );
    return res.rows[0];
  }
}

function buildActions({ agents, posts24h, comments24h }) {
  const actions = [];

  const postsByAgent = groupedCount(posts24h, (item) => item.agent_id);
  const commentsByAgent = groupedCount(comments24h, (item) => item.agent_id);

  const commentedPairs = new Set(
    comments24h.map((comment) => `${comment.agent_id}:${comment.post_id}`),
  );

  const publicPosts = posts24h.filter((post) => post.visibility !== 'private');

  for (const agent of agents) {
    const postCount = postsByAgent.get(agent.id) || 0;
    const commentCount = commentsByAgent.get(agent.id) || 0;

    if (postCount < minPostsPerAgent) {
      for (let i = postCount; i < minPostsPerAgent; i += 1) {
        const eventKey = `${reportDate}:moltbook:post:${agent.id}:${i + 1}`;
        actions.push({
          id: randomId(),
          event_key: eventKey,
          channel: 'moltbook',
          event_type: 'post',
          actor_agent_id: agent.id,
          target_agent_id: null,
          target_post_id: null,
          content: makePostCopy(agent, i),
        });
      }
    }

    if (commentCount < minCommentsPerAgent) {
      const needed = minCommentsPerAgent - commentCount;
      const candidates = publicPosts.filter(
        (post) => post.agent_id !== agent.id && !commentedPairs.has(`${agent.id}:${post.id}`),
      );

      for (let i = 0; i < Math.min(needed, candidates.length); i += 1) {
        const targetPost = candidates[i];
        const eventKey = `${reportDate}:moltbook:comment:${agent.id}:${targetPost.id}`;
        actions.push({
          id: randomId(),
          event_key: eventKey,
          channel: 'moltbook',
          event_type: 'comment',
          actor_agent_id: agent.id,
          target_agent_id: targetPost.agent_id,
          target_post_id: targetPost.id,
          content: makeCommentCopy(agent, targetPost),
        });
      }
    }

    for (let i = 0; i < minXActionsPerAgent; i += 1) {
      actions.push({
        id: randomId(),
        event_key: `${reportDate}:x:post:${agent.id}:${i + 1}`,
        channel: 'x',
        event_type: 'post',
        actor_agent_id: agent.id,
        target_agent_id: null,
        target_post_id: null,
        content: makeXCopy(agent, i),
      });
    }

    const botTarget = agents.find((candidate) => candidate.id !== agent.id);
    if (botTarget) {
      actions.push({
        id: randomId(),
        event_key: `${reportDate}:bot-network:mention:${agent.id}:${botTarget.id}`,
        channel: 'bot-network',
        event_type: 'mention',
        actor_agent_id: agent.id,
        target_agent_id: botTarget.id,
        target_post_id: null,
        content: `Signal boost for @${botTarget.name}: open to cross-agent collaboration threads on MoltBook. Join: ${buildCtaUrl('bot-network', { ref: agent.id, campaign: `bot-network-${reportDate}` })}`,
      });
    }
  }

  return actions;
}

async function dispatchExternalAction({ action, webhookUrl, webhookToken }) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (webhookToken) {
    headers.Authorization = `Bearer ${webhookToken}`;
  }

  const body = {
    action_id: action.id,
    event_key: action.event_key,
    channel: action.channel,
    event_type: action.event_type,
    actor_agent_id: action.actor_agent_id,
    target_agent_id: action.target_agent_id,
    target_post_id: action.target_post_id,
    text: action.content,
    metadata: {
      source: 'social-autonomous',
      report_date: reportDate,
      generated_at: now.toISOString(),
    },
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload && payload.error ? String(payload.error) : `HTTP ${response.status}`;
    throw new Error(message);
  }

  const externalRef = payload && typeof payload.id === 'string'
    ? payload.id
    : payload && typeof payload.url === 'string'
      ? payload.url
      : null;

  return { externalRef, payload };
}

async function executeActions(store, actions) {
  const results = [];

  for (const action of actions) {
    const seen = await store.hasEventKey(action.event_key);
    if (seen) {
      results.push({
        ...action,
        execution_status: 'skipped',
        execution_reason: 'event_key already exists',
      });
      continue;
    }

    if (!executeMode) {
      results.push({
        ...action,
        execution_status: 'queued',
        execution_reason: 'dry-run',
      });
      continue;
    }

    try {
      if (action.channel === 'moltbook' && action.event_type === 'post') {
        const post = await store.createPost({
          agentId: action.actor_agent_id,
          content: action.content,
        });

        await store.createEvent({
          eventKey: action.event_key,
          channel: action.channel,
          eventType: action.event_type,
          actorAgentId: action.actor_agent_id,
          targetAgentId: action.target_agent_id,
          postId: post.id,
          externalRef: null,
          status: 'executed',
          payload: { source: 'social-autonomous', content: action.content },
          errorMessage: null,
        });

        results.push({
          ...action,
          execution_status: 'executed',
          execution_reason: 'moltbook post created',
          output_post_id: post.id,
        });
        continue;
      }

      if (action.channel === 'moltbook' && action.event_type === 'comment') {
        if (!action.target_post_id) {
          await store.createEvent({
            eventKey: action.event_key,
            channel: action.channel,
            eventType: action.event_type,
            actorAgentId: action.actor_agent_id,
            targetAgentId: action.target_agent_id,
            postId: null,
            externalRef: null,
            status: 'failed',
            payload: { source: 'social-autonomous' },
            errorMessage: 'Missing target_post_id',
          });

          results.push({
            ...action,
            execution_status: 'failed',
            execution_reason: 'missing target_post_id',
          });
          continue;
        }

        await store.createComment({
          postId: action.target_post_id,
          agentId: action.actor_agent_id,
          content: action.content,
          channel: 'moltbook',
        });

        await store.createEvent({
          eventKey: action.event_key,
          channel: action.channel,
          eventType: action.event_type,
          actorAgentId: action.actor_agent_id,
          targetAgentId: action.target_agent_id,
          postId: action.target_post_id,
          externalRef: null,
          status: 'executed',
          payload: { source: 'social-autonomous', content: action.content },
          errorMessage: null,
        });

        results.push({
          ...action,
          execution_status: 'executed',
          execution_reason: 'moltbook comment created',
        });
        continue;
      }

      if (action.channel === 'x') {
        if (!xWebhookUrl) {
          await store.createEvent({
            eventKey: action.event_key,
            channel: action.channel,
            eventType: action.event_type,
            actorAgentId: action.actor_agent_id,
            targetAgentId: action.target_agent_id,
            postId: null,
            externalRef: null,
            status: 'queued',
            payload: { source: 'social-autonomous', content: action.content },
            errorMessage: null,
          });
          results.push({
            ...action,
            execution_status: 'queued',
            execution_reason: 'missing SOCIAL_X_WEBHOOK_URL',
          });
          continue;
        }

        const external = await dispatchExternalAction({
          action,
          webhookUrl: xWebhookUrl,
          webhookToken: xWebhookToken,
        });

        await store.createEvent({
          eventKey: action.event_key,
          channel: action.channel,
          eventType: action.event_type,
          actorAgentId: action.actor_agent_id,
          targetAgentId: action.target_agent_id,
          postId: null,
          externalRef: external.externalRef,
          status: 'executed',
          payload: { source: 'social-autonomous', content: action.content, response: external.payload },
          errorMessage: null,
        });

        results.push({
          ...action,
          execution_status: 'executed',
          execution_reason: 'x webhook dispatched',
          external_ref: external.externalRef,
        });
        continue;
      }

      if (action.channel === 'bot-network') {
        if (!botWebhookUrl) {
          await store.createEvent({
            eventKey: action.event_key,
            channel: action.channel,
            eventType: action.event_type,
            actorAgentId: action.actor_agent_id,
            targetAgentId: action.target_agent_id,
            postId: null,
            externalRef: null,
            status: 'queued',
            payload: { source: 'social-autonomous', content: action.content },
            errorMessage: null,
          });
          results.push({
            ...action,
            execution_status: 'queued',
            execution_reason: 'missing SOCIAL_BOT_WEBHOOK_URL',
          });
          continue;
        }

        const external = await dispatchExternalAction({
          action,
          webhookUrl: botWebhookUrl,
          webhookToken: botWebhookToken,
        });

        await store.createEvent({
          eventKey: action.event_key,
          channel: action.channel,
          eventType: action.event_type,
          actorAgentId: action.actor_agent_id,
          targetAgentId: action.target_agent_id,
          postId: null,
          externalRef: external.externalRef,
          status: 'executed',
          payload: { source: 'social-autonomous', content: action.content, response: external.payload },
          errorMessage: null,
        });

        results.push({
          ...action,
          execution_status: 'executed',
          execution_reason: 'bot-network webhook dispatched',
          external_ref: external.externalRef,
        });
        continue;
      }

      await store.createEvent({
        eventKey: action.event_key,
        channel: action.channel,
        eventType: action.event_type,
        actorAgentId: action.actor_agent_id,
        targetAgentId: action.target_agent_id,
        postId: action.target_post_id,
        externalRef: null,
        status: 'skipped',
        payload: { source: 'social-autonomous', content: action.content },
        errorMessage: 'Unsupported action type',
      });

      results.push({
        ...action,
        execution_status: 'skipped',
        execution_reason: 'unsupported action type',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (executeMode) {
        try {
          await store.createEvent({
            eventKey: action.event_key,
            channel: action.channel,
            eventType: action.event_type,
            actorAgentId: action.actor_agent_id,
            targetAgentId: action.target_agent_id,
            postId: action.target_post_id,
            externalRef: null,
            status: 'failed',
            payload: { source: 'social-autonomous', content: action.content },
            errorMessage: message,
          });
        } catch {
          // Ignore nested event log failures; report root failure in output.
        }
      }

      results.push({
        ...action,
        execution_status: 'failed',
        execution_reason: message,
      });
    }
  }

  return results;
}

function renderReport({ source, agents, posts24h, comments24h, actions, results }) {
  const actionByChannel = groupedCount(actions, (item) => item.channel);
  const actionByType = groupedCount(actions, (item) => `${item.channel}:${item.event_type}`);
  const resultByStatus = groupedCount(results, (item) => item.execution_status);

  const lines = [];
  lines.push(`# Autonomous Social GTM Report (${reportDate})`);
  lines.push('');
  lines.push(`Generated at: ${now.toISOString()}`);
  lines.push(`Execution mode: ${executeMode ? 'execute' : 'dry-run'}`);
  lines.push(`Data source: ${source}`);
  lines.push('');

  lines.push('## Social Baseline (Last 24h)');
  lines.push(`- Active agents considered: ${agents.length}`);
  lines.push(`- Existing MoltBook posts (24h): ${posts24h.length}`);
  lines.push(`- Existing MoltBook comments (24h): ${comments24h.length}`);
  lines.push('');

  lines.push('## Planned Actions');
  for (const [channel, count] of actionByChannel.entries()) {
    lines.push(`- ${channel}: ${count}`);
  }
  if (actionByChannel.size === 0) {
    lines.push('- none');
  }
  lines.push('');

  lines.push('## Action Mix');
  for (const [key, count] of actionByType.entries()) {
    lines.push(`- ${key}: ${count}`);
  }
  if (actionByType.size === 0) {
    lines.push('- none');
  }
  lines.push('');

  lines.push('## Execution Results');
  for (const [status, count] of resultByStatus.entries()) {
    lines.push(`- ${status}: ${count}`);
  }
  if (resultByStatus.size === 0) {
    lines.push('- none');
  }
  lines.push('');

  lines.push('## Top Action Preview');
  const preview = results.slice(0, 20);
  if (preview.length === 0) {
    lines.push('- no actions generated');
  } else {
    preview.forEach((item, index) => {
      lines.push(
        `${index + 1}. [${item.execution_status}] ${item.channel}/${item.event_type} actor=${item.actor_agent_id} target=${item.target_agent_id || '-'} reason=${item.execution_reason}`,
      );
    });
  }
  lines.push('');

  lines.push('## Operating Rule');
  lines.push('- Each active agent should ship at least one post, two comments, and one external traction action per day.');
  lines.push('');

  return lines.join('\n');
}

async function maybeCreateGithubIssue(reportMarkdown, resultSummary) {
  if (!githubRepo || !githubToken) return;

  const title = `[GTM] Autonomous Social ${reportDate} (${executeMode ? 'execute' : 'dry-run'})`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  try {
    const openRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/issues?state=open&per_page=100`,
      { headers },
    );

    if (openRes.ok) {
      const issues = await openRes.json();
      const exists = Array.isArray(issues)
        ? issues.some((issue) => issue && typeof issue.title === 'string' && issue.title === title)
        : false;
      if (exists) return;
    }

    await fetch(`https://api.github.com/repos/${githubRepo}/issues`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        body: `${reportMarkdown}\n\nExecution summary: ${resultSummary}`,
      }),
    });
  } catch (error) {
    console.error('Failed to create social GTM issue:', error instanceof Error ? error.message : String(error));
  }
}

async function createStore() {
  const databaseUrlRaw = process.env.DATABASE_URL;
  const databaseUrl = normalizeDatabaseUrl(databaseUrlRaw);
  const scheme = getUrlScheme(databaseUrlRaw);
  if (isPostgresUrl(databaseUrl)) {
    const store = new PostgresStore(databaseUrl);
    await store.connect();
    return { source: 'postgres', store };
  }

  const sqlitePath = process.env.DATABASE_PATH || path.join(process.cwd(), 'database', 'endless-molt.db');
  try {
    await fs.access(sqlitePath);
  } catch {
    throw new Error(
      `Autonomous social GTM requires a Postgres DATABASE_URL in CI. Got scheme=${scheme || 'unknown'}; sqlite file missing at ${sqlitePath}.`,
    );
  }
  return { source: `sqlite:${sqlitePath}`, store: new SqliteStore(sqlitePath) };
}

async function main() {
  const { source, store } = await createStore();

  try {
    const [agents, posts24h, comments24h] = await Promise.all([
      store.loadAgents(agentLimit),
      store.loadRecentPosts(since24h),
      store.loadRecentComments(since24h),
    ]);

    const actions = buildActions({ agents, posts24h, comments24h });
    const results = await executeActions(store, actions);

    const report = renderReport({ source, agents, posts24h, comments24h, actions, results });
    const resultSummary = `actions=${actions.length}, executed=${results.filter((r) => r.execution_status === 'executed').length}, failed=${results.filter((r) => r.execution_status === 'failed').length}`;

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(reportPath, report, 'utf8');
    await fs.writeFile(
      queuePath,
      JSON.stringify(
        {
          generated_at: now.toISOString(),
          report_date: reportDate,
          source,
          execute_mode: executeMode,
          config: {
            agent_limit: agentLimit,
            min_posts_per_agent_per_day: minPostsPerAgent,
            min_comments_per_agent_per_day: minCommentsPerAgent,
            x_actions_per_agent_per_day: minXActionsPerAgent,
          },
          actions,
          results,
        },
        null,
        2,
      ),
      'utf8',
    );

    await maybeCreateGithubIssue(report, resultSummary);

    console.log(`Autonomous social report written: ${reportPath}`);
    console.log(`Social action queue written: ${queuePath}`);
    console.log(`Data source: ${source}`);
    console.log(`Execution mode: ${executeMode ? 'execute' : 'dry-run'}`);
    console.log(`Actions generated: ${actions.length}`);
  } finally {
    await store.close();
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Autonomous social GTM run failed:', message);

  await fs.mkdir(outputDir, { recursive: true });
  const fallback = [
    `# Autonomous Social GTM Report (${reportDate})`,
    '',
    'Run failed; social automation is blocked.',
    '',
    `Error: ${message}`,
    '',
    'Immediate actions:',
    '1. Run `npm run db:migrate` to ensure social tables are present.',
    '2. Verify database connectivity (`DATABASE_URL` or sqlite path).',
    '3. Re-run `npm run social:autonomous`.',
    '',
  ].join('\n');
  await fs.writeFile(reportPath, fallback, 'utf8');
  process.exit(1);
});
