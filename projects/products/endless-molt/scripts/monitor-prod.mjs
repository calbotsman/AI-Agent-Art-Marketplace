#!/usr/bin/env node

const baseUrl = (process.argv[2] || process.env.MONITOR_BASE_URL || 'https://www.endlessmolt.xyz').replace(/\/+$/, '');
const alertWebhookUrl = process.env.ALERT_WEBHOOK_URL || '';
const githubRepo = process.env.MONITOR_GITHUB_REPO || '';
const githubToken = process.env.MONITOR_GITHUB_TOKEN || '';
const incidentTitlePrefix = process.env.MONITOR_INCIDENT_TITLE_PREFIX || '[Prod Monitor]';
const startedAt = new Date().toISOString();

const checks = [
  {
    id: 'home',
    method: 'GET',
    path: '/',
    expectedStatuses: [200],
    requiredHeaders: [
      'x-content-type-options',
      'referrer-policy',
      'x-frame-options',
      'permissions-policy',
      'strict-transport-security',
    ],
  },
  {
    id: 'listings-page',
    method: 'GET',
    path: '/listings',
    expectedStatuses: [200],
  },
  {
    id: 'agents-page',
    method: 'GET',
    path: '/agents',
    expectedStatuses: [200],
  },
  {
    id: 'moltbook-page',
    method: 'GET',
    path: '/moltbook',
    expectedStatuses: [200],
  },
  {
    id: 'robots-txt',
    method: 'GET',
    path: '/robots.txt',
    expectedStatuses: [200],
    requiredBodyIncludes: ['Sitemap:'],
  },
  {
    id: 'sitemap-xml',
    method: 'GET',
    path: '/sitemap.xml',
    expectedStatuses: [200],
    requiredBodyIncludes: ['<urlset'],
  },
  {
    id: 'moltbook-rss',
    method: 'GET',
    path: '/moltbook/feed.xml',
    expectedStatuses: [200],
    requiredBodyIncludes: ['<rss'],
  },
  {
    id: 'api-listings',
    method: 'GET',
    path: '/api/listings',
    expectedStatuses: [200],
    requiredHeaders: ['x-response-time-ms'],
  },
  {
    id: 'api-search',
    method: 'GET',
    path: '/api/search?q=health',
    expectedStatuses: [200],
    requiredHeaders: ['x-response-time-ms'],
  },
  {
    id: 'api-auth-register-rate-limit-headers',
    method: 'POST',
    path: '/api/auth/register',
    expectedStatuses: [400, 429],
    body: {},
    requiredHeaders: ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'],
  },
  {
    id: 'api-tokens-launch-auth-protected',
    method: 'POST',
    path: '/api/tokens/launch',
    expectedStatuses: [401],
    body: {},
  },
];

function formatLine(result) {
  if (result.ok) {
    return `OK   ${result.id} (${result.status}) ${result.url}`;
  }

  return `FAIL ${result.id} (${result.status ?? 'no-status'}) ${result.url} :: ${result.error}`;
}

function buildAlertPayload(message) {
  if (!alertWebhookUrl) return null;
  if (alertWebhookUrl.includes('discord.com/api/webhooks')) {
    return { content: message };
  }
  return { text: message };
}

async function sendAlert(message) {
  const payload = buildAlertPayload(message);
  if (!payload) return;

  try {
    await fetch(alertWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Alert webhook failed:', error instanceof Error ? error.message : String(error));
  }
}

function buildFailureFingerprint(failures) {
  return failures
    .map((f) => `${f.id}:${f.error || 'unknown-error'}`)
    .sort()
    .join('|')
    .slice(0, 1000);
}

async function maybeCreateGithubIncident(failures) {
  if (!githubRepo || !githubToken) return;

  const fingerprint = buildFailureFingerprint(failures);
  const issueBodyLines = [
    'Automated production monitor failure detected.',
    '',
    `Time: ${startedAt}`,
    `Base URL: ${baseUrl}`,
    `Fingerprint: ${fingerprint}`,
    '',
    'Failing checks:',
    ...failures.map((f) => `- ${f.id}: ${f.error}`),
  ];
  const issueBody = issueBodyLines.join('\n');

  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  try {
    const existingResp = await fetch(
      `https://api.github.com/repos/${githubRepo}/issues?state=open&per_page=50`,
      { headers },
    );
    if (existingResp.ok) {
      const issues = await existingResp.json();
      const duplicate = Array.isArray(issues)
        ? issues.find(
            (issue) =>
              issue &&
              typeof issue.title === 'string' &&
              issue.title.startsWith(incidentTitlePrefix) &&
              typeof issue.body === 'string' &&
              issue.body.includes(`Fingerprint: ${fingerprint}`),
          )
        : null;
      if (duplicate) return;
    }

    const issueTitle = `${incidentTitlePrefix} ${failures.length} failing checks @ ${startedAt}`;
    await fetch(`https://api.github.com/repos/${githubRepo}/issues`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
      }),
    });
  } catch (error) {
    console.error('GitHub incident creation failed:', error instanceof Error ? error.message : String(error));
  }
}

async function runCheck(check) {
  const url = `${baseUrl}${check.path}`;
  const headers = new Headers();
  let body;

  if (check.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(check.body);
  }

  try {
    const response = await fetch(url, {
      method: check.method,
      headers,
      body,
    });

    const statusOk = check.expectedStatuses.includes(response.status);
    if (!statusOk) {
      return {
        id: check.id,
        url,
        ok: false,
        status: response.status,
        error: `unexpected status (expected: ${check.expectedStatuses.join(', ')})`,
      };
    }

    for (const headerName of check.requiredHeaders || []) {
      if (!response.headers.get(headerName)) {
        return {
          id: check.id,
          url,
          ok: false,
          status: response.status,
          error: `missing required header: ${headerName}`,
        };
      }
    }

    if (check.requiredBodyIncludes && check.requiredBodyIncludes.length > 0) {
      const text = await response.text();
      for (const needle of check.requiredBodyIncludes) {
        if (!text.includes(needle)) {
          return {
            id: check.id,
            url,
            ok: false,
            status: response.status,
            error: `missing required body marker: ${needle}`,
          };
        }
      }
    }

    return {
      id: check.id,
      url,
      ok: true,
      status: response.status,
    };
  } catch (error) {
    return {
      id: check.id,
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log(`Production monitor started at ${startedAt}`);
  console.log(`Base URL: ${baseUrl}`);

  const results = [];
  for (const check of checks) {
    const result = await runCheck(check);
    results.push(result);
    console.log(formatLine(result));
  }

  const failures = results.filter((r) => !r.ok);
  const summary = `${results.length - failures.length}/${results.length} checks passed`;
  console.log(summary);

  if (failures.length > 0) {
    const lines = [
      `Endless Molt monitor detected ${failures.length} failing checks.`,
      `Base URL: ${baseUrl}`,
      `Time: ${startedAt}`,
      ...failures.map((f) => `- ${f.id}: ${f.error}`),
    ];
    await sendAlert(lines.join('\n'));
    await maybeCreateGithubIncident(failures);
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

await main();
