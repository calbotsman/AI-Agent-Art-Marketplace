import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

type CliOptions = Record<string, string | boolean>;

type StepStatus = 'success' | 'failed' | 'skipped';

interface HouseState {
  lastRunAt?: string;
  lastSuccessfulRunAt?: string;
  lastMintAttemptAt?: string;
  lastMintAt?: string;
  lastObservedListingId?: string;
  lastObservedListingAt?: string;
  lastRunSummary?: string;
}

interface ListingSummary {
  id: string;
  title: string;
  created_at: string;
}

interface AgentApiResponse {
  listings?: ListingSummary[];
}

interface StepResult {
  name: string;
  status: StepStatus;
  startedAt: string;
  endedAt: string;
  summary: string;
  command?: string[];
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const DEFAULT_BASE_URL = 'https://www.endlessmolt.xyz';
const DEFAULT_MINT_PROFILE = 'nulloborn';
const DEFAULT_MIN_HOURS_BETWEEN_MINTS = 24;
const TSX_CLI_PATH = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');

function parseCliArgs(argv: string[]) {
  const parsed: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const raw = token.slice(2);
    const eqIndex = raw.indexOf('=');
    if (eqIndex >= 0) {
      parsed[raw.slice(0, eqIndex)] = raw.slice(eqIndex + 1);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      parsed[raw] = next;
      index += 1;
      continue;
    }

    parsed[raw] = true;
  }

  return parsed;
}

function getStringOption(options: CliOptions, cliKey: string, envKeys: string[], fallback = '') {
  const cliValue = options[cliKey];
  if (typeof cliValue === 'string' && cliValue.trim()) {
    return cliValue.trim();
  }

  for (const envKey of envKeys) {
    const value = process.env[envKey];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function getBooleanOption(options: CliOptions, cliKey: string, envKeys: string[], fallback = false) {
  const cliValue = options[cliKey];
  if (typeof cliValue === 'boolean') return cliValue;
  if (typeof cliValue === 'string') {
    return !['0', 'false', 'no', 'off'].includes(cliValue.trim().toLowerCase());
  }

  for (const envKey of envKeys) {
    const value = process.env[envKey];
    if (typeof value === 'string' && value.trim()) {
      return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
    }
  }

  return fallback;
}

function getPositiveNumberOption(options: CliOptions, cliKey: string, envKeys: string[], fallback: number) {
  const raw = getStringOption(options, cliKey, envKeys, '');
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${cliKey} must be a positive number`);
  }
  return parsed;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return data;
}

function truncateOutput(value: string, maxChars = 6000) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...[truncated]`;
}

async function runTsxScript(args: {
  scriptName: string;
  scriptPath: string;
  scriptArgs?: string[];
}): Promise<StepResult> {
  const startedAt = new Date().toISOString();
  const command = [process.execPath, TSX_CLI_PATH, args.scriptPath, ...(args.scriptArgs || [])];

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [TSX_CLI_PATH, args.scriptPath, ...(args.scriptArgs || [])], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('close', (code) => {
      const endedAt = new Date().toISOString();
      const status: StepStatus = code === 0 ? 'success' : 'failed';
      resolve({
        name: args.scriptName,
        status,
        startedAt,
        endedAt,
        summary:
          status === 'success'
            ? `${args.scriptName} completed`
            : `${args.scriptName} failed with exit code ${code ?? 1}`,
        command,
        exitCode: code ?? 1,
        stdout: truncateOutput(stdout.trim()),
        stderr: truncateOutput(stderr.trim()),
      });
    });
  });
}

function hoursSince(timestamp?: string) {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  const value = Date.parse(timestamp);
  if (Number.isNaN(value)) return Number.POSITIVE_INFINITY;
  return (Date.now() - value) / (1000 * 60 * 60);
}

async function decideMint(args: {
  baseUrl: string;
  profile: string;
  minHoursBetweenMints: number;
  forceMint: boolean;
  state: HouseState;
}) {
  const artist = await fetchJson<AgentApiResponse>(`${args.baseUrl}/api/agents/${args.profile}`);
  const latestListing = artist.listings?.[0] || null;
  const hoursSinceLastMint = hoursSince(args.state.lastMintAt);
  const hoursSinceLatestListing = latestListing ? hoursSince(latestListing.created_at) : Number.POSITIVE_INFINITY;

  if (args.forceMint) {
    return {
      shouldMint: true,
      latestListing,
      reason: 'force-mint set',
    };
  }

  if (!latestListing) {
    return {
      shouldMint: true,
      latestListing,
      reason: 'no live listing exists',
    };
  }

  if (hoursSinceLastMint < args.minHoursBetweenMints) {
    return {
      shouldMint: false,
      latestListing,
      reason: `last mint was ${hoursSinceLastMint.toFixed(1)}h ago`,
    };
  }

  if (hoursSinceLatestListing < args.minHoursBetweenMints) {
    return {
      shouldMint: false,
      latestListing,
      reason: `latest listing is only ${hoursSinceLatestListing.toFixed(1)}h old`,
    };
  }

  return {
    shouldMint: true,
    latestListing,
    reason: `latest listing is stale at ${hoursSinceLatestListing.toFixed(1)}h`,
  };
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const dryRun = getBooleanOption(options, 'dry-run', ['ENDLESS_MOLT_HOUSE_DRY_RUN'], false);
  const forceMint = getBooleanOption(options, 'force-mint', ['ENDLESS_MOLT_HOUSE_FORCE_MINT'], false);
  const baseUrl = getStringOption(options, 'base-url', ['ENDLESS_MOLT_BASE_URL'], DEFAULT_BASE_URL).replace(/\/+$/g, '');
  const profile = getStringOption(options, 'mint-profile', ['ENDLESS_MOLT_HOUSE_MINT_PROFILE'], DEFAULT_MINT_PROFILE);
  const minHoursBetweenMints = getPositiveNumberOption(
    options,
    'min-hours-between-mints',
    ['ENDLESS_MOLT_HOUSE_MIN_HOURS_BETWEEN_MINTS'],
    DEFAULT_MIN_HOURS_BETWEEN_MINTS,
  );
  const statePath = path.resolve(process.cwd(), 'cache', 'society', 'house-runtime-state.json');
  const runPath = path.resolve(
    process.cwd(),
    'cache',
    'society',
    'runs',
    `${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  const state = (await readJsonFile<HouseState>(statePath)) || {};
  const steps: StepResult[] = [];

  const mintDecision = await decideMint({
    baseUrl,
    profile,
    minHoursBetweenMints,
    forceMint,
    state,
  });

  if (mintDecision.shouldMint) {
    steps.push(
      await runTsxScript({
        scriptName: 'autonomous-agent-mint',
        scriptPath: 'scripts/autonomous-agent-mint.ts',
        scriptArgs: ['--profile', profile, ...(dryRun ? ['--dry-run'] : [])],
      }),
    );
  } else {
    const now = new Date().toISOString();
    steps.push({
      name: 'autonomous-agent-mint',
      status: 'skipped',
      startedAt: now,
      endedAt: now,
      summary: `mint skipped: ${mintDecision.reason}`,
    });
  }

  steps.push(
    await runTsxScript({
      scriptName: 'seed-society-agents',
      scriptPath: 'scripts/seed-society-agents.ts',
      scriptArgs: dryRun ? ['--dry-run'] : [],
    }),
  );

  steps.push(
    await runTsxScript({
      scriptName: 'seed-society-signals',
      scriptPath: 'scripts/seed-society-signals.ts',
      scriptArgs: dryRun ? ['--dry-run'] : [],
    }),
  );

  steps.push(
    await runTsxScript({
      scriptName: 'ghostemoji-loop',
      scriptPath: 'scripts/run-ghostemoji-loop.ts',
      scriptArgs: dryRun ? ['--dry-run'] : [],
    }),
  );

  const latestArtistState = await fetchJson<AgentApiResponse>(`${baseUrl}/api/agents/${profile}`).catch(() => ({} as AgentApiResponse));
  const latestListing = latestArtistState.listings?.[0] || null;
  const allSucceeded = steps.every((step) => step.status !== 'failed');
  const completedCount = steps.filter((step) => step.status === 'success').length;
  const failedCount = steps.filter((step) => step.status === 'failed').length;
  const skippedCount = steps.filter((step) => step.status === 'skipped').length;
  const runSummary = `${completedCount} completed, ${skippedCount} skipped, ${failedCount} failed`;

  await writeJsonFile(runPath, {
    ran_at: new Date().toISOString(),
    dry_run: dryRun,
    base_url: baseUrl,
    mint_profile: profile,
    mint_decision: {
      should_mint: mintDecision.shouldMint,
      reason: mintDecision.reason,
      latest_listing: mintDecision.latestListing || null,
      min_hours_between_mints: minHoursBetweenMints,
    },
    steps,
    latest_listing: latestListing,
    summary: runSummary,
  });

  const nextState: HouseState = {
    lastRunAt: new Date().toISOString(),
    lastSuccessfulRunAt: allSucceeded ? new Date().toISOString() : state.lastSuccessfulRunAt,
    lastMintAttemptAt: mintDecision.shouldMint ? new Date().toISOString() : state.lastMintAttemptAt,
    lastMintAt:
      mintDecision.shouldMint && steps[0]?.status === 'success' && !dryRun ? new Date().toISOString() : state.lastMintAt,
    lastObservedListingId: latestListing?.id || state.lastObservedListingId,
    lastObservedListingAt: latestListing?.created_at || state.lastObservedListingAt,
    lastRunSummary: runSummary,
  };

  await writeJsonFile(statePath, nextState);

  console.log(
    JSON.stringify(
      {
        ok: failedCount === 0,
        dryRun,
        summary: runSummary,
        mintDecision: {
          shouldMint: mintDecision.shouldMint,
          reason: mintDecision.reason,
        },
        steps: steps.map((step) => ({
          name: step.name,
          status: step.status,
          summary: step.summary,
        })),
        runPath,
        statePath,
      },
      null,
      2,
    ),
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
