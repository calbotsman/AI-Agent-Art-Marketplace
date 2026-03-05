#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';
import BetterSqlite3 from 'better-sqlite3';

const { Client } = pg;

const now = new Date();
const dayMs = 24 * 60 * 60 * 1000;
const reportDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const outputRoot = process.env.GTM_REPORT_DIR || path.join(process.cwd(), 'reports', 'gtm');
const outputDir = path.join(outputRoot, reportDate);
const reportPath = path.join(outputDir, 'autonomous-gtm-report.md');
const actionQueuePath = path.join(outputDir, 'action-queue.json');

const githubRepo = process.env.GTM_GITHUB_REPO || '';
const githubToken = process.env.GTM_GITHUB_TOKEN || '';

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

function parseTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function microToEth(value) {
  return Number(value || 0) / 1_000_000;
}

function recentCount(rows, key, since) {
  return rows.filter((row) => {
    const date = parseTimestamp(row[key]);
    return date && date >= since;
  }).length;
}

function uniqueCount(rows, key, filterFn = () => true) {
  const set = new Set();
  for (const row of rows) {
    if (!filterFn(row)) continue;
    if (row[key]) set.add(row[key]);
  }
  return set.size;
}

function sum(rows, key, filterFn = () => true) {
  let total = 0;
  for (const row of rows) {
    if (!filterFn(row)) continue;
    total += Number(row[key] || 0);
  }
  return total;
}

function isOrderConfirmed(order) {
  return ['confirmed', 'delivered'].includes(String(order.status || '').toLowerCase());
}

function detectBottleneck(metrics) {
  const activation = metrics.activationRate;
  const firstSale = metrics.firstSaleRate;

  if (activation < 0.4) return 'onboarding';
  if (firstSale < 0.3) return 'first-sale';
  if (metrics.weeklyNewAgents < 10) return 'acquisition';
  return 'scale';
}

function buildActions(metrics, bottleneck) {
  const actions = [];
  const neededAgents = Math.max(0, 100 - metrics.totalAgents);

  actions.push({
    priority: 'P0',
    owner: 'Growth Lead',
    action: `Run daily outreach block targeting ${Math.max(40, neededAgents)} qualified agent creators.`,
    success_metric: 'New agent registrations this week',
  });

  if (bottleneck === 'onboarding') {
    actions.push({
      priority: 'P0',
      owner: 'Community Lead',
      action: 'Launch concierge onboarding office hours (daily) until activation exceeds 50%.',
      success_metric: 'Registration -> first listing conversion (7d)',
    });
    actions.push({
      priority: 'P1',
      owner: 'Product/Growth Engineer',
      action: 'Instrument and remove top 3 onboarding drop-off points from registration to first listing.',
      success_metric: 'Median time-to-first-listing',
    });
  } else if (bottleneck === 'first-sale') {
    actions.push({
      priority: 'P0',
      owner: 'Growth Lead',
      action: 'Create featured “first sale sprint” slots for unsold active listings older than 7 days.',
      success_metric: 'First listing -> first sale conversion (14d)',
    });
    actions.push({
      priority: 'P1',
      owner: 'Content Lead',
      action: 'Publish 3 buyer-facing discovery posts highlighting top unsold agent listings.',
      success_metric: 'Weekly GMV',
    });
  } else if (bottleneck === 'acquisition') {
    actions.push({
      priority: 'P0',
      owner: 'Growth Lead',
      action: 'Double outbound channel volume (X + Discord + referrals) and track response rate per script.',
      success_metric: 'Weekly new agent registrations',
    });
    actions.push({
      priority: 'P1',
      owner: 'Content Lead',
      action: 'Publish 2 creator proof stories with concrete numbers and onboarding CTA.',
      success_metric: 'Landing-to-registration conversion',
    });
  } else {
    actions.push({
      priority: 'P0',
      owner: 'Growth Lead',
      action: 'Scale winning channels by 30% and keep weekly funnel review cadence.',
      success_metric: 'Sustained weekly growth across registrations/listings/sales',
    });
  }

  actions.push({
    priority: 'P1',
    owner: 'Operations',
    action: 'Set distributed rate-limiting env vars in production before next high-volume campaign.',
    success_metric: 'No onboarding throttling incidents during acquisition spikes',
  });

  actions.push({
    priority: 'P1',
    owner: 'Operations',
    action: 'Set monitor webhook and incident routing for immediate alerting on prod regressions.',
    success_metric: 'MTTR for production incidents',
  });

  return actions;
}

function renderReport(metrics, bottleneck, actions) {
  const lines = [];
  lines.push(`# Autonomous GTM Report (${reportDate})`);
  lines.push('');
  lines.push(`Generated at: ${now.toISOString()}`);
  lines.push('');
  lines.push('## Funnel Snapshot');
  lines.push(`- Total agents: ${metrics.totalAgents}`);
  lines.push(`- New agents (7d): ${metrics.weeklyNewAgents}`);
  lines.push(`- Agents with >=1 listing: ${metrics.activatedAgents} (${percent(metrics.activationRate)})`);
  lines.push(`- New listings (7d): ${metrics.weeklyNewListings}`);
  lines.push(`- Active listings: ${metrics.activeListings}`);
  lines.push(`- Agents with >=1 confirmed sale: ${metrics.soldAgents} (${percent(metrics.firstSaleRate)})`);
  lines.push(`- Confirmed orders (14d): ${metrics.confirmedOrders14d}`);
  lines.push(`- GMV (14d): ${microToEth(metrics.gmv14dMicro).toFixed(4)} ETH`);
  lines.push('');
  lines.push('## Bottleneck');
  lines.push(`- Primary bottleneck: **${bottleneck}**`);
  lines.push('');
  lines.push('## Action Queue');
  actions.forEach((item, index) => {
    lines.push(`${index + 1}. [${item.priority}] ${item.owner} - ${item.action} (metric: ${item.success_metric})`);
  });
  lines.push('');
  lines.push('## Operating Rule');
  lines.push('- Every GTM task must move registrations, first listings, or first sales this week.');
  lines.push('');
  return lines.join('\n');
}

async function loadDataFromPostgres(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const [agentsRes, listingsRes, ordersRes] = await Promise.all([
      client.query('SELECT id, created_at FROM agents'),
      client.query('SELECT agent_id, status, created_at FROM listings'),
      client.query('SELECT agent_id, status, amount, created_at FROM orders'),
    ]);
    return {
      source: 'postgres',
      agents: agentsRes.rows,
      listings: listingsRes.rows,
      orders: ordersRes.rows,
    };
  } finally {
    await client.end();
  }
}

function loadDataFromSqlite(filePath) {
  const db = new BetterSqlite3(filePath, { fileMustExist: true, readonly: true });
  try {
    const agents = db.prepare('SELECT id, created_at FROM agents').all();
    const listings = db.prepare('SELECT agent_id, status, created_at FROM listings').all();
    const orders = db.prepare('SELECT agent_id, status, amount, created_at FROM orders').all();
    return {
      source: `sqlite:${filePath}`,
      agents,
      listings,
      orders,
    };
  } finally {
    db.close();
  }
}

async function loadData() {
  const databaseUrlRaw = process.env.DATABASE_URL;
  const databaseUrl = normalizeDatabaseUrl(databaseUrlRaw);
  const scheme = getUrlScheme(databaseUrlRaw);

  if (isPostgresUrl(databaseUrl)) {
    return loadDataFromPostgres(databaseUrl);
  }

  const defaultSqlitePath = path.join(process.cwd(), 'database', 'endless-molt.db');
  try {
    await fs.access(defaultSqlitePath);
  } catch {
    throw new Error(
      `Autonomous GTM requires a Postgres DATABASE_URL in CI. Got scheme=${scheme || 'unknown'}; sqlite file missing at ${defaultSqlitePath}.`,
    );
  }
  return loadDataFromSqlite(defaultSqlitePath);
}

async function maybeCreateGithubIssue(reportMarkdown, bottleneck) {
  if (!githubRepo || !githubToken) return;

  const title = `[GTM] Autonomous Plan ${reportDate} (${bottleneck})`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  try {
    const openRes = await fetch(`https://api.github.com/repos/${githubRepo}/issues?state=open&per_page=100`, { headers });
    if (openRes.ok) {
      const issues = await openRes.json();
      const alreadyOpen = Array.isArray(issues)
        ? issues.some((issue) => issue && typeof issue.title === 'string' && issue.title === title)
        : false;
      if (alreadyOpen) return;
    }

    await fetch(`https://api.github.com/repos/${githubRepo}/issues`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        body: reportMarkdown,
      }),
    });
  } catch (error) {
    console.error('Failed to open GTM issue:', error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  const data = await loadData();

  const sevenDaysAgo = new Date(now.getTime() - 7 * dayMs);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * dayMs);

  const totalAgents = data.agents.length;
  const weeklyNewAgents = recentCount(data.agents, 'created_at', sevenDaysAgo);
  const activatedAgents = uniqueCount(data.listings, 'agent_id');
  const activationRate = ratio(activatedAgents, totalAgents);
  const weeklyNewListings = recentCount(data.listings, 'created_at', sevenDaysAgo);
  const activeListings = data.listings.filter((l) => String(l.status).toLowerCase() === 'active').length;
  const soldAgents = uniqueCount(data.orders, 'agent_id', isOrderConfirmed);
  const firstSaleRate = ratio(soldAgents, Math.max(activatedAgents, 1));
  const confirmedOrders14d = data.orders.filter((o) => {
    const createdAt = parseTimestamp(o.created_at);
    return createdAt && createdAt >= fourteenDaysAgo && isOrderConfirmed(o);
  }).length;
  const gmv14dMicro = sum(data.orders, 'amount', (o) => {
    const createdAt = parseTimestamp(o.created_at);
    return Boolean(createdAt && createdAt >= fourteenDaysAgo && isOrderConfirmed(o));
  });

  const metrics = {
    source: data.source,
    totalAgents,
    weeklyNewAgents,
    activatedAgents,
    activationRate,
    weeklyNewListings,
    activeListings,
    soldAgents,
    firstSaleRate,
    confirmedOrders14d,
    gmv14dMicro,
  };

  const bottleneck = detectBottleneck(metrics);
  const actions = buildActions(metrics, bottleneck);
  const reportMarkdown = renderReport(metrics, bottleneck, actions);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(reportPath, reportMarkdown, 'utf8');
  await fs.writeFile(
    actionQueuePath,
    JSON.stringify(
      {
        generated_at: now.toISOString(),
        report_date: reportDate,
        source: data.source,
        bottleneck,
        metrics,
        actions,
      },
      null,
      2,
    ),
    'utf8',
  );

  await maybeCreateGithubIssue(reportMarkdown, bottleneck);

  console.log(`Autonomous GTM report written: ${reportPath}`);
  console.log(`Action queue written: ${actionQueuePath}`);
  console.log(`Data source: ${data.source}`);
  console.log(`Primary bottleneck: ${bottleneck}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Autonomous GTM run failed:', message);

  const fallbackDir = path.join(outputRoot, reportDate);
  await fs.mkdir(fallbackDir, { recursive: true });
  const fallbackPath = path.join(fallbackDir, 'autonomous-gtm-report.md');
  const fallback = [
    `# Autonomous GTM Report (${reportDate})`,
    '',
    'Run failed; GTM execution is currently blocked by data access.',
    '',
    `Error: ${message}`,
    '',
    'Immediate actions:',
    '1. Verify `DATABASE_URL` access for GTM metrics source.',
    '2. Re-run `npm run gtm:autonomous`.',
    '3. Keep outreach and onboarding cadence running manually until this is restored.',
    '',
  ].join('\n');
  await fs.writeFile(fallbackPath, fallback, 'utf8');
  process.exit(1);
});
