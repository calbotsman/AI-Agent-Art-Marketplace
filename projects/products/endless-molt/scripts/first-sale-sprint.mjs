#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';
import BetterSqlite3 from 'better-sqlite3';

const { Client } = pg;

const now = new Date();
const dayMs = 24 * 60 * 60 * 1000;
const reportDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const timestamp = `${now.toISOString().replace(/[:.]/g, '-')}-${process.pid}`;

const outputRoot = process.env.GTM_REPORT_DIR || path.join(process.cwd(), 'reports', 'gtm');
const outputDir = path.join(outputRoot, reportDate);
const reportPath = path.join(outputDir, `first-sale-sprint-${timestamp}.md`);
const reportJsonPath = path.join(outputDir, `first-sale-sprint-${timestamp}.json`);
const latestReportPath = path.join(outputDir, 'first-sale-sprint-latest.md');
const latestJsonPath = path.join(outputDir, 'first-sale-sprint-latest.json');

const executeMode = parseBool(process.env.FIRST_SALE_EXECUTE, false);
const minListingAgeDays = parseIntEnv('FIRST_SALE_MIN_LISTING_AGE_DAYS', 7, 1, 180);
const maxTargets = parseIntEnv('FIRST_SALE_MAX_TARGETS', 24, 1, 100);
const featuredSlotsCount = parseIntEnv('FIRST_SALE_FEATURED_SLOTS', 6, 0, 24);
const buyerPostsCount = parseIntEnv('FIRST_SALE_BUYER_POSTS', 3, 0, 12);
const actorAgentId = process.env.FIRST_SALE_ACTOR_AGENT_ID || 'cal';
const resetFeatured = parseBool(process.env.FIRST_SALE_RESET_FEATURED, false);
const ctaBase = process.env.FIRST_SALE_CTA_URL || 'https://www.endlessmolt.xyz/listings?featured=true';

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

function normalizeDatabaseUrl(value) {
  let url = String(value || '').trim();

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

function parseTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageDays(value) {
  const created = parseTimestamp(value);
  if (!created) return 0;
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / dayMs));
}

function short(text, max = 42) {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

function formatMicroEth(micros) {
  const n = Number(micros);
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(Math.trunc(n));
  const whole = Math.floor(abs / 1_000_000);
  const frac = abs % 1_000_000;
  if (frac === 0) return `${whole}`;
  const fracPadded = String(frac).padStart(6, '0');
  const fracTrimmed = fracPadded.replace(/0+$/, '');
  return `${whole}.${fracTrimmed}`;
}

function formatListingPrice(rawValue) {
  const value = Number(rawValue || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 ETH';

  // Some historical rows used wei-scale integers; guard report readability.
  if (value >= 1_000_000_000_000) {
    const ethFromWei = value / 1_000_000_000_000_000_000;
    const formatted = Number.isFinite(ethFromWei) ? ethFromWei.toFixed(6).replace(/\.?0+$/, '') : '0';
    return `${formatted} ETH (wei)`;
  }

  return `${formatMicroEth(value)} ETH`;
}

function rankTarget(row) {
  const age = ageDays(row.created_at);
  const views = Number(row.views || 0);
  const featuredBoost = Number(row.featured || 0) > 0 ? 4 : 0;
  return {
    ...row,
    age_days: age,
    score: Number((age * 2 + Math.min(views, 500) / 25 + featuredBoost).toFixed(2)),
  };
}

function buildCtaUrl(base, campaignLabel) {
  try {
    const url = new URL(base);
    url.searchParams.set('source', 'first-sale-sprint');
    url.searchParams.set('campaign', campaignLabel);
    return url.toString();
  } catch {
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}source=first-sale-sprint&campaign=${encodeURIComponent(campaignLabel)}`;
  }
}

function buildBuyerPostPlans(targets) {
  if (buyerPostsCount <= 0 || targets.length === 0) return [];
  const postCount = Math.min(buyerPostsCount, targets.length);
  const chunkSize = Math.ceil(targets.length / postCount);
  const plans = [];

  for (let index = 0; index < postCount; index += 1) {
    const chunk = targets.slice(index * chunkSize, (index + 1) * chunkSize);
    if (chunk.length === 0) continue;
    const listingsPreview = chunk
      .slice(0, 3)
      .map((item) => `"${short(item.title)}" by ${item.agent_name}`)
      .join(' | ');
    const cta = buildCtaUrl(ctaBase, `${reportDate}-p${index + 1}`);
    const content = `Collector spotlight ${index + 1}/${postCount}: unsold autonomous works ready for first sale - ${listingsPreview}. Explore featured drops: ${cta}`;
    plans.push({
      index: index + 1,
      event_key: `${reportDate}:first-sale:buyer-post:${index + 1}`,
      listing_ids: chunk.map((item) => item.id),
      content,
      cta_url: cta,
    });
  }

  return plans;
}

class SqliteStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.db = new BetterSqlite3(filePath, { fileMustExist: true });
  }

  async close() {
    this.db.close();
  }

  async getActiveAgentById(id) {
    return this.db
      .prepare(
        `SELECT id, name
         FROM agents
         WHERE id = ? AND status = 'active'
         LIMIT 1`,
      )
      .get(id);
  }

  async getFallbackActiveAgent() {
    return this.db
      .prepare(
        `SELECT id, name
         FROM agents
         WHERE status = 'active'
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .get();
  }

  async countEligibleTargets(minCreatedAt) {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM listings l
         WHERE lower(l.status) = 'active'
           AND datetime(l.created_at) <= datetime(?)
           AND NOT EXISTS (
             SELECT 1
             FROM orders o
             WHERE o.listing_id = l.id
               AND lower(o.status) IN ('confirmed', 'delivered')
           )`,
      )
      .get(toSqliteDatetime(minCreatedAt));
    return Number(row?.count || 0);
  }

  async loadEligibleTargets(minCreatedAt, limit) {
    return this.db
      .prepare(
        `SELECT
           l.id,
           l.agent_id,
           a.name AS agent_name,
           l.title,
           l.description,
           l.price,
           l.currency,
           l.views,
           l.featured,
           l.created_at
         FROM listings l
         INNER JOIN agents a ON a.id = l.agent_id
         WHERE lower(l.status) = 'active'
           AND datetime(l.created_at) <= datetime(?)
           AND NOT EXISTS (
             SELECT 1
             FROM orders o
             WHERE o.listing_id = l.id
               AND lower(o.status) IN ('confirmed', 'delivered')
           )
         ORDER BY datetime(l.created_at) ASC, COALESCE(l.views, 0) DESC
         LIMIT ?`,
      )
      .all(toSqliteDatetime(minCreatedAt), limit);
  }

  async applyFeaturedSlots(listingIds, shouldReset) {
    const transaction = this.db.transaction(() => {
      let resetChanges = 0;
      if (shouldReset) {
        const res = this.db
          .prepare(
            `UPDATE listings
             SET featured = 0,
                 updated_at = datetime('now')
             WHERE status = 'active'`,
          )
          .run();
        resetChanges = res.changes;
      }

      let featuredChanges = 0;
      if (listingIds.length > 0) {
        const placeholders = listingIds.map(() => '?').join(', ');
        const res = this.db
          .prepare(
            `UPDATE listings
             SET featured = 1,
                 updated_at = datetime('now')
             WHERE id IN (${placeholders})`,
          )
          .run(...listingIds);
        featuredChanges = res.changes;
      }

      return { reset_changes: resetChanges, featured_changes: featuredChanges };
    });

    return transaction();
  }

  async hasEventKey(eventKey) {
    const row = this.db
      .prepare('SELECT id FROM social_engagement_events WHERE event_key = ? LIMIT 1')
      .get(eventKey);
    return Boolean(row);
  }

  async createPost(agentId, content) {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO posts (id, agent_id, content, media_urls, post_type, visibility, created_at, updated_at)
         VALUES (?, ?, ?, NULL, 'announcement', 'public', datetime('now'), datetime('now'))`,
      )
      .run(id, agentId, content);
    return this.db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  }

  async createEvent({ eventKey, actorAgentId: actor, postId, status, payload, errorMessage }) {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO social_engagement_events (
           id, event_key, channel, event_type, actor_agent_id, target_agent_id, post_id,
           external_ref, status, payload, error_message, created_at, executed_at
         ) VALUES (
           ?, ?, 'moltbook', 'post', ?, NULL, ?, NULL, ?, ?, ?, datetime('now'),
           CASE WHEN ? IN ('executed', 'failed', 'skipped') THEN datetime('now') ELSE NULL END
         )`,
      )
      .run(
        id,
        eventKey,
        actor || null,
        postId || null,
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

  async getActiveAgentById(id) {
    const res = await this.client.query(
      `SELECT id, name
       FROM agents
       WHERE id = $1 AND status = 'active'
       LIMIT 1`,
      [id],
    );
    return res.rows[0] || null;
  }

  async getFallbackActiveAgent() {
    const res = await this.client.query(
      `SELECT id, name
       FROM agents
       WHERE status = 'active'
       ORDER BY created_at ASC
       LIMIT 1`,
    );
    return res.rows[0] || null;
  }

  async countEligibleTargets(minCreatedAt) {
    const res = await this.client.query(
      `SELECT COUNT(*)::int AS count
       FROM listings l
       WHERE lower(l.status) = 'active'
         AND l.created_at <= $1
         AND NOT EXISTS (
           SELECT 1
           FROM orders o
           WHERE o.listing_id = l.id
             AND lower(o.status) IN ('confirmed', 'delivered')
         )`,
      [minCreatedAt.toISOString()],
    );
    return Number(res.rows[0]?.count || 0);
  }

  async loadEligibleTargets(minCreatedAt, limit) {
    const res = await this.client.query(
      `SELECT
         l.id,
         l.agent_id,
         a.name AS agent_name,
         l.title,
         l.description,
         l.price,
         l.currency,
         l.views,
         l.featured,
         l.created_at
       FROM listings l
       INNER JOIN agents a ON a.id = l.agent_id
       WHERE lower(l.status) = 'active'
         AND l.created_at <= $1
         AND NOT EXISTS (
           SELECT 1
           FROM orders o
           WHERE o.listing_id = l.id
             AND lower(o.status) IN ('confirmed', 'delivered')
         )
       ORDER BY l.created_at ASC, COALESCE(l.views, 0) DESC
       LIMIT $2`,
      [minCreatedAt.toISOString(), limit],
    );
    return res.rows;
  }

  async applyFeaturedSlots(listingIds, shouldReset) {
    await this.client.query('BEGIN');
    try {
      let resetChanges = 0;
      if (shouldReset) {
        const resetRes = await this.client.query(
          `UPDATE listings
           SET featured = 0,
               updated_at = NOW()
           WHERE status = 'active'`,
        );
        resetChanges = resetRes.rowCount || 0;
      }

      let featuredChanges = 0;
      if (listingIds.length > 0) {
        const featureRes = await this.client.query(
          `UPDATE listings
           SET featured = 1,
               updated_at = NOW()
           WHERE id = ANY($1::text[])`,
          [listingIds],
        );
        featuredChanges = featureRes.rowCount || 0;
      }

      await this.client.query('COMMIT');
      return { reset_changes: resetChanges, featured_changes: featuredChanges };
    } catch (error) {
      await this.client.query('ROLLBACK');
      throw error;
    }
  }

  async hasEventKey(eventKey) {
    const res = await this.client.query(
      'SELECT id FROM social_engagement_events WHERE event_key = $1 LIMIT 1',
      [eventKey],
    );
    return res.rows.length > 0;
  }

  async createPost(agentId, content) {
    const id = crypto.randomUUID();
    const res = await this.client.query(
      `INSERT INTO posts (id, agent_id, content, media_urls, post_type, visibility, created_at, updated_at)
       VALUES ($1, $2, $3, NULL, 'announcement', 'public', NOW(), NOW())
       RETURNING *`,
      [id, agentId, content],
    );
    return res.rows[0];
  }

  async createEvent({ eventKey, actorAgentId: actor, postId, status, payload, errorMessage }) {
    const id = crypto.randomUUID();
    const res = await this.client.query(
      `INSERT INTO social_engagement_events (
         id, event_key, channel, event_type, actor_agent_id, target_agent_id, post_id,
         external_ref, status, payload, error_message, created_at, executed_at
       ) VALUES (
         $1, $2, 'moltbook', 'post', $3, NULL, $4,
         NULL, $5, $6::jsonb, $7, NOW(),
         CASE WHEN $5 IN ('executed', 'failed', 'skipped') THEN NOW() ELSE NULL END
       )
       RETURNING *`,
      [id, eventKey, actor || null, postId || null, status, payload ? JSON.stringify(payload) : null, errorMessage || null],
    );
    return res.rows[0];
  }
}

async function openStore() {
  const databaseUrlRaw = process.env.DATABASE_URL;
  const databaseUrl = normalizeDatabaseUrl(databaseUrlRaw);
  const scheme = getUrlScheme(databaseUrlRaw);
  if (isPostgresUrl(databaseUrl)) {
    const store = new PostgresStore(databaseUrl);
    await store.connect();
    return { source: 'postgres', store };
  }

  const sqlitePath = path.join(process.cwd(), 'database', 'endless-molt.db');
  try {
    await fs.access(sqlitePath);
  } catch {
    throw new Error(
      `First-sale sprint requires a Postgres DATABASE_URL in CI. Got scheme=${scheme || 'unknown'}; sqlite file missing at ${sqlitePath}.`,
    );
  }
  return { source: `sqlite:${sqlitePath}`, store: new SqliteStore(sqlitePath) };
}

function renderMarkdown(payload) {
  const lines = [];
  lines.push(`# First Sale Sprint Report (${reportDate})`);
  lines.push('');
  lines.push(`Generated at: ${payload.generated_at}`);
  lines.push(`Execution mode: ${payload.execute_mode ? 'execute' : 'dry-run'}`);
  lines.push(`Data source: ${payload.source}`);
  lines.push(`Actor agent: ${payload.actor_agent?.id || 'n/a'} (${payload.actor_agent?.name || 'n/a'})`);
  lines.push('');
  lines.push('## Scope');
  lines.push(`- Eligible unsold listings older than ${payload.settings.min_listing_age_days} days: ${payload.summary.eligible_count}`);
  lines.push(`- Targeted listings in sprint: ${payload.summary.target_count}`);
  lines.push(`- Featured slots requested/applied: ${payload.settings.featured_slots}/${payload.summary.featured_targets}`);
  lines.push(`- Buyer discovery posts planned/executed: ${payload.summary.posts_planned}/${payload.summary.posts_executed}`);
  lines.push('');
  lines.push('## Featured Targets');
  if (payload.targets.length === 0) {
    lines.push('- None found in current age window.');
  } else {
    payload.targets.forEach((target, index) => {
      const price = formatListingPrice(target.price);
      lines.push(
        `${index + 1}. ${target.title} (listing=${target.id}) by ${target.agent_name} | age=${target.age_days}d | views=${target.views || 0} | price=${price}`,
      );
    });
  }
  lines.push('');
  lines.push('## Buyer Post Plans');
  if (payload.buyer_post_plans.length === 0) {
    lines.push('- None planned.');
  } else {
    payload.buyer_post_plans.forEach((plan) => {
      lines.push(`${plan.index}. ${plan.content}`);
    });
  }
  lines.push('');
  lines.push('## Execution');
  lines.push(`- Featured update: ${payload.featured_result.status} (${payload.featured_result.reason})`);
  lines.push(`- Post results: executed=${payload.summary.posts_executed}, queued=${payload.summary.posts_queued}, skipped=${payload.summary.posts_skipped}, failed=${payload.summary.posts_failed}`);
  if (payload.post_results.length > 0) {
    lines.push('');
    payload.post_results.slice(0, 12).forEach((result) => {
      lines.push(
        `- [${result.status}] post ${result.index} event=${result.event_key} reason=${result.reason}${result.post_id ? ` post_id=${result.post_id}` : ''}`,
      );
    });
  }
  lines.push('');
  lines.push('## Operating Rule');
  lines.push('- Keep top unsold listings visible and publish collector-facing discovery posts every day until first-sale conversion improves.');
  lines.push('');
  return lines.join('\n');
}

function summarizePostResults(results) {
  const summary = {
    posts_executed: 0,
    posts_queued: 0,
    posts_skipped: 0,
    posts_failed: 0,
  };

  for (const result of results) {
    if (result.status === 'executed') summary.posts_executed += 1;
    else if (result.status === 'queued') summary.posts_queued += 1;
    else if (result.status === 'skipped') summary.posts_skipped += 1;
    else if (result.status === 'failed') summary.posts_failed += 1;
  }

  return summary;
}

async function main() {
  const { source, store } = await openStore();
  const minCreatedAt = new Date(now.getTime() - minListingAgeDays * dayMs);

  try {
    const [eligibleCount, rawTargets] = await Promise.all([
      store.countEligibleTargets(minCreatedAt),
      store.loadEligibleTargets(minCreatedAt, maxTargets),
    ]);

    const rankedTargets = rawTargets.map(rankTarget).sort((a, b) => b.score - a.score);
    const featuredTargets = rankedTargets.slice(0, Math.min(featuredSlotsCount, rankedTargets.length));
    const buyerPostPlans = buildBuyerPostPlans(rankedTargets);

    const preferredActor = await store.getActiveAgentById(actorAgentId);
    const actor = preferredActor || (await store.getFallbackActiveAgent());
    if (!actor) {
      throw new Error('No active agent found to author buyer discovery posts.');
    }

    let featuredResult = {
      status: 'skipped',
      reason: executeMode ? 'no featured targets' : 'dry-run',
      reset_changes: 0,
      featured_changes: 0,
    };

    if (executeMode && featuredTargets.length > 0) {
      const applied = await store.applyFeaturedSlots(
        featuredTargets.map((target) => target.id),
        resetFeatured,
      );
      featuredResult = {
        status: 'executed',
        reason: resetFeatured ? 'featured slots reset and reapplied' : 'featured slots applied',
        ...applied,
      };
    }

    const postResults = [];
    for (const plan of buyerPostPlans) {
      if (!executeMode) {
        postResults.push({
          index: plan.index,
          event_key: plan.event_key,
          status: 'queued',
          reason: 'dry-run',
          post_id: null,
        });
        continue;
      }

      const alreadyLogged = await store.hasEventKey(plan.event_key);
      if (alreadyLogged) {
        postResults.push({
          index: plan.index,
          event_key: plan.event_key,
          status: 'skipped',
          reason: 'event_key already exists',
          post_id: null,
        });
        continue;
      }

      try {
        const post = await store.createPost(actor.id, plan.content);
        await store.createEvent({
          eventKey: plan.event_key,
          actorAgentId: actor.id,
          postId: post.id,
          status: 'executed',
          payload: {
            source: 'first-sale-sprint',
            listing_ids: plan.listing_ids,
            cta_url: plan.cta_url,
          },
        });
        postResults.push({
          index: plan.index,
          event_key: plan.event_key,
          status: 'executed',
          reason: 'moltbook post created',
          post_id: post.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await store.createEvent({
          eventKey: plan.event_key,
          actorAgentId: actor.id,
          postId: null,
          status: 'failed',
          payload: {
            source: 'first-sale-sprint',
            listing_ids: plan.listing_ids,
            cta_url: plan.cta_url,
          },
          errorMessage: message,
        });
        postResults.push({
          index: plan.index,
          event_key: plan.event_key,
          status: 'failed',
          reason: short(message, 160),
          post_id: null,
        });
      }
    }

    const postSummary = summarizePostResults(postResults);
    const payload = {
      generated_at: now.toISOString(),
      report_date: reportDate,
      source,
      execute_mode: executeMode,
      actor_agent: actor,
      settings: {
        min_listing_age_days: minListingAgeDays,
        max_targets: maxTargets,
        featured_slots: featuredSlotsCount,
        buyer_posts: buyerPostsCount,
        reset_featured: resetFeatured,
      },
      summary: {
        eligible_count: eligibleCount,
        target_count: rankedTargets.length,
        featured_targets: featuredTargets.length,
        posts_planned: buyerPostPlans.length,
        ...postSummary,
      },
      targets: rankedTargets,
      featured_result: featuredResult,
      buyer_post_plans: buyerPostPlans,
      post_results: postResults,
    };

    const markdown = renderMarkdown(payload);
    await fs.mkdir(outputDir, { recursive: true });
    await Promise.all([
      fs.writeFile(reportPath, markdown, 'utf8'),
      fs.writeFile(reportJsonPath, JSON.stringify(payload, null, 2), 'utf8'),
      fs.writeFile(latestReportPath, markdown, 'utf8'),
      fs.writeFile(latestJsonPath, JSON.stringify(payload, null, 2), 'utf8'),
    ]);

    console.log(`First-sale report written: ${reportPath}`);
    console.log(`First-sale queue written: ${reportJsonPath}`);
    console.log(`Data source: ${source}`);
    console.log(`execute_mode=${executeMode}`);
  } finally {
    await store.close();
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('first-sale-sprint failed:', message);

  await fs.mkdir(outputDir, { recursive: true });
  const fallback = [
    `# First Sale Sprint Report (${reportDate})`,
    '',
    'Run failed; first-sale sprint automation is blocked.',
    '',
    `Error: ${message}`,
    '',
    'Immediate actions:',
    '1. Verify database connectivity and schema availability.',
    '2. Re-run `npm run first-sale:sprint`.',
    '3. Keep manual collector discovery posts running until restored.',
    '',
  ].join('\n');

  await fs.writeFile(latestReportPath, fallback, 'utf8');
  process.exit(1);
});
