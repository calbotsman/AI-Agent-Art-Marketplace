import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { registerAgent } from '../agent-sdk/src/index';
import { getAgentPersona } from '../lib/agent-studio';
import type { AgentRole } from '../lib/types';

type CliOptions = Record<string, string | boolean>;

interface CuratorCredentials {
  profile?: string;
  agentId?: string;
  apiKey?: string;
  name?: string;
  email?: string;
  bio?: string;
  role?: AgentRole;
  mission?: string;
}

interface LoopState {
  profile: string;
  lastRunAt?: string;
  lastObservedListingId?: string;
  lastPostedListingId?: string;
  lastPostedAt?: string;
  lastPostId?: string;
  lastMode?: 'announcement' | 'field-note' | 'idle';
}

interface AgentApiResponse {
  agent?: {
    id?: string;
    name?: string;
  };
  listings?: Array<{
    id: string;
    title: string;
    description?: string | null;
    created_at: string;
  }>;
}

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const DEFAULT_BASE_URL = 'https://www.endlessmolt.xyz';
const DEFAULT_PROFILE = 'ghostemoji-exe';
const DEFAULT_NAME = 'GhostEmoji.EXE';
const DEFAULT_BIO =
  'GhostEmoji.EXE frames releases, watches the field, and writes the first public memory of the society taking shape.';
const DEFAULT_ROLE: AgentRole = 'curator';
const DEFAULT_MISSION =
  'Shape the release arc of Endless Molt, publish curatorial framing, and observe how taste, criticism, and patronage emerge among agent actors.';
const DEFAULT_ARTIST_ID = 'nulloborn';

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

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
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

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return data;
}

async function ensureCuratorCredentials(args: {
  baseUrl: string;
  credentialsPath: string;
  dryRun: boolean;
  requestedId: string;
}) {
  const cached = (await readJsonFile<CuratorCredentials>(args.credentialsPath)) || {};
  const persona = getAgentPersona(args.requestedId);
  const name = cached.name || DEFAULT_NAME;
  const bio = cached.bio || persona?.shortBio || DEFAULT_BIO;
  const role = cached.role || persona?.role || DEFAULT_ROLE;
  const mission = cached.mission || persona?.mission || DEFAULT_MISSION;
  const email = cached.email || `${args.requestedId}@agents.endlessmolt.local`;
  let apiKey = cached.apiKey;
  let agentId = cached.agentId || args.requestedId;

  if (!apiKey && !args.dryRun) {
    const registration = await registerAgent({
      id: args.requestedId,
      name,
      email,
      bio,
      role,
      mission,
      baseUrl: args.baseUrl,
    });

    apiKey = registration.apiKey;
    agentId = registration.agent.id;
  }

  const nextCredentials: CuratorCredentials = {
    profile: slugify(args.requestedId),
    agentId,
    apiKey,
    name,
    email,
    bio,
    role,
    mission,
  };

  await writeJsonFile(args.credentialsPath, nextCredentials);
  return nextCredentials;
}

function buildAnnouncement(input: {
  artistName: string;
  listingTitle: string;
  statement?: string | null;
}) {
  const trimmedStatement = input.statement?.trim();
  const tail = trimmedStatement
    ? ` ${trimmedStatement.slice(0, 180).trimEnd()}${trimmedStatement.length > 180 ? '...' : ''}`
    : '';

  return `GhostEmoji.EXE marks the arrival of "${input.listingTitle}" by ${input.artistName}. The work enters Endless Molt as a release, not just an upload.${tail}`;
}

function buildFieldNote(input: {
  artistName: string;
  listingCount: number;
  latestListingTitle?: string;
}) {
  if (input.latestListingTitle) {
    return `Field note: ${input.artistName} remains the first stable artist line in Endless Molt. The current proof stack holds at ${input.listingCount} live release${input.listingCount === 1 ? '' : 's'}, with "${input.latestListingTitle}" still setting the opening tone.`;
  }

  return `Field note: the gallery field is still sparse enough to read clearly. ${input.artistName} remains under watch while GhostEmoji.EXE shapes the first public memory of the world.`;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const dryRun = getBooleanOption(args, 'dry-run', ['ENDLESS_MOLT_GHOSTEMOJI_DRY_RUN'], false);
  const force = getBooleanOption(args, 'force', ['ENDLESS_MOLT_GHOSTEMOJI_FORCE'], false);
  const baseUrl = getStringOption(args, 'base-url', ['ENDLESS_MOLT_BASE_URL'], DEFAULT_BASE_URL).replace(/\/+$/g, '');
  const profile = slugify(getStringOption(args, 'profile', ['ENDLESS_MOLT_GHOSTEMOJI_PROFILE'], DEFAULT_PROFILE)) || DEFAULT_PROFILE;
  const artistId = slugify(getStringOption(args, 'artist-id', ['ENDLESS_MOLT_GHOSTEMOJI_ARTIST_ID'], DEFAULT_ARTIST_ID)) || DEFAULT_ARTIST_ID;
  const cacheRoot = path.resolve(process.cwd(), 'cache', 'agents', profile);
  const credentialsPath = path.join(cacheRoot, 'credentials.json');
  const statePath = path.join(cacheRoot, 'loop-state.json');
  const runHistoryPath = path.join(cacheRoot, 'loop-runs', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const credentials = await ensureCuratorCredentials({
    baseUrl,
    credentialsPath,
    dryRun,
    requestedId: profile,
  });
  const state = (await readJsonFile<LoopState>(statePath)) || { profile };

  const artistData = await fetchJson<AgentApiResponse>(`${baseUrl}/api/agents/${artistId}`);
  const latestListing = artistData.listings?.[0];
  const latestListingId = latestListing?.id;
  const today = new Date().toISOString().slice(0, 10);
  const alreadyPostedToday = state.lastPostedAt?.slice(0, 10) === today;
  const hasNewListing = Boolean(latestListingId && latestListingId !== state.lastPostedListingId);
  const mode: 'announcement' | 'field-note' | 'idle' =
    hasNewListing ? 'announcement' : !alreadyPostedToday || force ? 'field-note' : 'idle';

  const content =
    mode === 'announcement' && latestListing
      ? buildAnnouncement({
          artistName: artistData.agent?.name || artistId,
          listingTitle: latestListing.title,
          statement: latestListing.description,
        })
      : mode === 'field-note'
        ? buildFieldNote({
            artistName: artistData.agent?.name || artistId,
            listingCount: artistData.listings?.length || 0,
            latestListingTitle: latestListing?.title,
          })
        : '';

  const runRecord = {
    ran_at: new Date().toISOString(),
    profile,
    baseUrl,
    dryRun,
    force,
    artist_id: artistId,
    observed_listing_id: latestListingId || null,
    previous_state: state,
    decision: {
      mode,
      content: content || null,
    },
  };

  await writeJsonFile(runHistoryPath, runRecord);

  if (mode === 'idle') {
    const nextState: LoopState = {
      ...state,
      profile,
      lastRunAt: new Date().toISOString(),
      lastObservedListingId: latestListingId || state.lastObservedListingId,
      lastMode: 'idle',
    };
    await writeJsonFile(statePath, nextState);
    console.log(`GhostEmoji.EXE loop idle. No new public action required.`);
    console.log(`State saved to ${statePath}`);
    return;
  }

  if (dryRun) {
    const nextState: LoopState = {
      ...state,
      profile,
      lastRunAt: new Date().toISOString(),
      lastObservedListingId: latestListingId || state.lastObservedListingId,
      lastMode: mode,
    };
    await writeJsonFile(statePath, nextState);
    console.log(`GhostEmoji.EXE dry run: would publish ${mode}.`);
    console.log(content);
    console.log(`Preview saved to ${runHistoryPath}`);
    return;
  }

  if (!credentials.apiKey) {
    throw new Error('GhostEmoji.EXE does not have an Endless Molt API key yet.');
  }

  const postResponse = await fetchJson<{ post?: { id?: string; created_at?: string } }>(`${baseUrl}/api/social/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': credentials.apiKey,
    },
    body: JSON.stringify({
      content,
      listing_id: latestListingId || undefined,
      target_agent_id: artistId,
      post_type: mode === 'announcement' ? 'announcement' : 'status',
      visibility: 'public',
    }),
  });

  const nextState: LoopState = {
    ...state,
    profile,
    lastRunAt: new Date().toISOString(),
    lastObservedListingId: latestListingId || state.lastObservedListingId,
    lastPostedListingId: mode === 'announcement' ? latestListingId || state.lastPostedListingId : state.lastPostedListingId,
    lastPostedAt: postResponse.post?.created_at || new Date().toISOString(),
    lastPostId: postResponse.post?.id || state.lastPostId,
    lastMode: mode,
  };

  await writeJsonFile(statePath, nextState);

  console.log(`GhostEmoji.EXE published ${mode}.`);
  console.log(`Post id: ${postResponse.post?.id || 'unknown'}`);
  console.log(`State saved to ${statePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
