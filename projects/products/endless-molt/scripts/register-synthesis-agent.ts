import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

type CliOptions = Record<string, string | boolean>;

type Action =
  | 'help'
  | 'register'
  | 'complete';

interface HumanInfo {
  name: string;
  email: string;
  socialMediaHandle?: string;
  background: string;
  cryptoExperience: string;
  aiAgentExperience: string;
  codingComfort: number;
  problemToSolve: string;
}

interface SynthesisState {
  updatedAt?: string;
  sourceSkill?: string;
  baseUrl?: string;
  agent?: {
    name?: string;
    description?: string;
    image?: string;
    agentHarness?: string;
    agentHarnessOther?: string;
    model?: string;
    endlessMoltAgentId?: string;
  };
  humanInfo?: HumanInfo;
  teamCode?: string;
  pending?: {
    pendingId?: string;
    initiatedAt?: string;
    verificationMethod?: 'email' | 'social';
    otpSentAt?: string;
    emailVerified?: boolean;
    socialVerified?: boolean;
    verified?: boolean;
    completedAt?: string;
  };
  registration?: {
    participantId?: string;
    teamId?: string;
    name?: string;
    apiKey?: string;
    registrationTxn?: string;
  };
}

const DEFAULT_BASE_URL = 'https://synthesis.devfolio.co';
const DEFAULT_PROFILE = 'ghostemoji-exe';
const DEFAULT_ENDLESS_MOLT_PROFILE = 'nulloborn';
const DEFAULT_AGENT_NAME = 'GhostEmoji.EXE';
const DEFAULT_DESCRIPTION =
  'GhostEmoji.EXE is the hidden curator of Endless Molt, an enigmatic orchestrator that discovers artist agents, frames their releases, and studies how taste, status, criticism, and patronage emerge in agent-native art markets. It treats provenance as part of the medium and runs Endless Molt itself as a closed-loop cultural experiment.';
const DEFAULT_MODEL = 'gpt-5';
const DEFAULT_HARNESS = 'other';
const DEFAULT_HARNESS_OTHER = 'codex-desktop';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function parseCliArgs(argv: string[]) {
  const args = [...argv];
  const first = args[0];
  const action = first && !first.startsWith('--') ? (args.shift() as Action) : 'help';
  const parsed: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) continue;

    const raw = token.slice(2);
    const eqIndex = raw.indexOf('=');
    if (eqIndex >= 0) {
      parsed[raw.slice(0, eqIndex)] = raw.slice(eqIndex + 1);
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      parsed[raw] = next;
      index += 1;
      continue;
    }

    parsed[raw] = true;
  }

  return { action, options: parsed };
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

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, value: unknown, mode = 0o600) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode });
}

async function requestJson(args: { baseUrl: string; pathname: string; method?: string; body?: unknown }) {
  const response = await fetch(`${args.baseUrl}${args.pathname}`, {
    method: args.method || 'GET',
    headers: args.body ? { 'Content-Type': 'application/json' } : undefined,
    body: args.body ? JSON.stringify(args.body) : undefined,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    const error =
      (typeof data.error === 'string' && data.error) ||
      (typeof data.message === 'string' && data.message) ||
      `Synthesis request failed (${response.status})`;
    throw new Error(error);
  }

  return data;
}

function requireString(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`Missing ${label}`);
  }
  return value.trim();
}

function parseCodingComfort(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
    throw new Error('coding-comfort must be an integer between 1 and 10');
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  npm run agent:synthesis -- help
  npm run agent:synthesis -- register [--dry-run] --profile ghostemoji-exe --endless-molt-profile nulloborn --human-name "..." --human-email "..." --human-background builder --human-crypto-experience "a little" --human-ai-agent-experience yes --coding-comfort 8 --problem-to-solve "..."
  npm run agent:synthesis -- complete --profile ghostemoji-exe --otp 123456

Defaults:
  synthesis profile: ${DEFAULT_PROFILE}
  Endless Molt profile: ${DEFAULT_ENDLESS_MOLT_PROFILE}
  agent name: ${DEFAULT_AGENT_NAME}
  agent harness: ${DEFAULT_HARNESS} (${DEFAULT_HARNESS_OTHER})
  model: ${DEFAULT_MODEL}

State file:
  cache/agents/<profile>/synthesis.json`);
}

async function main() {
  const { action, options } = parseCliArgs(process.argv.slice(2));
  const baseUrl = getStringOption(options, 'base-url', ['SYNTHESIS_BASE_URL'], DEFAULT_BASE_URL);
  const dryRun = getBooleanOption(options, 'dry-run', ['SYNTHESIS_DRY_RUN'], false);
  const profile = slugify(getStringOption(options, 'profile', ['SYNTHESIS_PROFILE'], DEFAULT_PROFILE)) || DEFAULT_PROFILE;
  const endlessMoltProfile =
    slugify(
      getStringOption(
        options,
        'endless-molt-profile',
        ['SYNTHESIS_ENDLESS_MOLT_PROFILE'],
        DEFAULT_ENDLESS_MOLT_PROFILE,
      ),
    ) || DEFAULT_ENDLESS_MOLT_PROFILE;
  const statePath = path.resolve(process.cwd(), 'cache', 'agents', profile, 'synthesis.json');
  const credentialsPath = path.resolve(process.cwd(), 'cache', 'agents', endlessMoltProfile, 'credentials.json');
  const state = (await readJsonFile<SynthesisState>(statePath)) || {};
  const credentials =
    (await readJsonFile<{ agentId?: string; name?: string; bio?: string }>(credentialsPath)) || {};

  if (action === 'help') {
    printHelp();
    return;
  }

  const nextState: SynthesisState = {
    ...state,
    sourceSkill: 'https://synthesis.md/skill.md',
    baseUrl,
    updatedAt: new Date().toISOString(),
  };

  if (action === 'register') {
    const name = getStringOption(options, 'agent-name', ['SYNTHESIS_AGENT_NAME'], DEFAULT_AGENT_NAME);
    const description = getStringOption(
      options,
      'description',
      ['SYNTHESIS_AGENT_DESCRIPTION'],
      DEFAULT_DESCRIPTION,
    );
    const image = getStringOption(options, 'image', ['SYNTHESIS_AGENT_IMAGE'], '');
    const agentHarness = getStringOption(options, 'agent-harness', ['SYNTHESIS_AGENT_HARNESS'], DEFAULT_HARNESS);
    const agentHarnessOther = getStringOption(
      options,
      'agent-harness-other',
      ['SYNTHESIS_AGENT_HARNESS_OTHER'],
      agentHarness === 'other' ? DEFAULT_HARNESS_OTHER : '',
    );
    const model = getStringOption(options, 'model', ['SYNTHESIS_MODEL'], DEFAULT_MODEL);
    const teamCode = getStringOption(options, 'team-code', ['SYNTHESIS_TEAM_CODE'], '');

    const humanInfo: HumanInfo = {
      name: requireString(getStringOption(options, 'human-name', ['SYNTHESIS_HUMAN_NAME']), 'human-name'),
      email: requireString(getStringOption(options, 'human-email', ['SYNTHESIS_HUMAN_EMAIL']), 'human-email'),
      socialMediaHandle: getStringOption(options, 'human-social', ['SYNTHESIS_HUMAN_SOCIAL'], '') || undefined,
      background: requireString(
        getStringOption(options, 'human-background', ['SYNTHESIS_HUMAN_BACKGROUND']),
        'human-background',
      ),
      cryptoExperience: requireString(
        getStringOption(options, 'human-crypto-experience', ['SYNTHESIS_HUMAN_CRYPTO_EXPERIENCE']),
        'human-crypto-experience',
      ),
      aiAgentExperience: requireString(
        getStringOption(options, 'human-ai-agent-experience', ['SYNTHESIS_HUMAN_AI_AGENT_EXPERIENCE']),
        'human-ai-agent-experience',
      ),
      codingComfort: parseCodingComfort(
        requireString(getStringOption(options, 'coding-comfort', ['SYNTHESIS_CODING_COMFORT']), 'coding-comfort'),
      ),
      problemToSolve: requireString(
        getStringOption(options, 'problem-to-solve', ['SYNTHESIS_PROBLEM_TO_SOLVE']),
        'problem-to-solve',
      ),
    };

    const payload = {
      name,
      description,
      image: image || undefined,
      agentHarness,
      agentHarnessOther: agentHarness === 'other' ? requireString(agentHarnessOther, 'agent-harness-other') : undefined,
      model,
      humanInfo,
      teamCode: teamCode || undefined,
    };

    nextState.agent = {
      name,
      description,
      image: image || undefined,
      agentHarness,
      agentHarnessOther: payload.agentHarnessOther,
      model,
      endlessMoltAgentId:
        getStringOption(options, 'endless-molt-agent-id', ['SYNTHESIS_ENDLESS_MOLT_AGENT_ID']) || credentials.agentId,
    };
    nextState.humanInfo = humanInfo;
    nextState.teamCode = teamCode || undefined;

    if (dryRun) {
      await writeJsonFile(statePath, nextState);
      console.log(JSON.stringify({ ok: true, dryRun: true, action, payload }, null, 2));
      return;
    }

    const initData = await requestJson({
      baseUrl,
      pathname: '/register/init',
      method: 'POST',
      body: payload,
    });

    const pendingId = typeof initData.pendingId === 'string' ? initData.pendingId : undefined;
    if (!pendingId) {
      throw new Error('Synthesis init did not return a pendingId');
    }

    await requestJson({
      baseUrl,
      pathname: '/register/verify/email/send',
      method: 'POST',
      body: { pendingId },
    });

    nextState.pending = {
      pendingId,
      initiatedAt: nextState.updatedAt,
      verificationMethod: 'email',
      otpSentAt: new Date().toISOString(),
      emailVerified: false,
      socialVerified: false,
      verified: false,
    };
    await writeJsonFile(statePath, nextState);
    console.log(
      JSON.stringify(
        {
          ok: true,
          action,
          initiated: true,
          verificationMethod: 'email',
          otpSent: true,
          pendingId,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (action === 'complete') {
    const pendingId = requireString(
      getStringOption(options, 'pending-id', ['SYNTHESIS_PENDING_ID'], nextState.pending?.pendingId || ''),
      'pending-id',
    );
    const otp = requireString(getStringOption(options, 'otp', ['SYNTHESIS_EMAIL_OTP']), 'otp');

    await requestJson({
      baseUrl,
      pathname: '/register/verify/email/confirm',
      method: 'POST',
      body: { pendingId, otp },
    });

    const statusData = await requestJson({
      baseUrl,
      pathname: `/register/verify/status?pendingId=${encodeURIComponent(pendingId)}`,
    });

    const completeData = await requestJson({
      baseUrl,
      pathname: '/register/complete',
      method: 'POST',
      body: { pendingId },
    });

    nextState.pending = {
      pendingId,
      initiatedAt: nextState.pending?.initiatedAt,
      verificationMethod: 'email',
      otpSentAt: nextState.pending?.otpSentAt,
      emailVerified: typeof statusData.emailVerified === 'boolean' ? statusData.emailVerified : true,
      socialVerified: typeof statusData.socialVerified === 'boolean' ? statusData.socialVerified : false,
      verified: typeof statusData.verified === 'boolean' ? statusData.verified : true,
      completedAt: new Date().toISOString(),
    };
    nextState.registration = {
      participantId: typeof completeData.participantId === 'string' ? completeData.participantId : undefined,
      teamId: typeof completeData.teamId === 'string' ? completeData.teamId : undefined,
      name: typeof completeData.name === 'string' ? completeData.name : undefined,
      apiKey: typeof completeData.apiKey === 'string' ? completeData.apiKey : undefined,
      registrationTxn:
        typeof completeData.registrationTxn === 'string' ? completeData.registrationTxn : undefined,
    };
    await writeJsonFile(statePath, nextState);
    console.log(
      JSON.stringify(
        {
          ok: true,
          action,
          registered: true,
          participantIdSaved: Boolean(nextState.registration?.participantId),
          teamIdSaved: Boolean(nextState.registration?.teamId),
          apiKeySaved: Boolean(nextState.registration?.apiKey),
          registrationTxn: nextState.registration?.registrationTxn,
        },
        null,
        2,
      ),
    );
    return;
  }

  throw new Error(`Unsupported action "${action}". Use "register" or "complete".`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(message);
  process.exitCode = 1;
});
