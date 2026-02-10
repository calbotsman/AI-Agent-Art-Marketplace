import { NextResponse } from 'next/server';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SessionRow = {
  key: string;
  sessionId?: string;
  channel?: string;
  updatedAt?: number;
  modelProvider?: string;
  model?: string;
  contextTokens?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  abortedLastRun?: boolean;
};

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function readSessions(): SessionRow[] {
  const sessionsPath = join(
    process.env.HOME || '',
    '.openclaw',
    'agents',
    'main',
    'sessions',
    'sessions.json',
  );
  if (!existsSync(sessionsPath)) return [];

  const raw = readFileSync(sessionsPath, 'utf-8');
  const obj = safeJsonParse<Record<string, any>>(raw);
  if (!obj || typeof obj !== 'object') return [];

  return Object.entries(obj).map(([key, value]) => {
    const v = value && typeof value === 'object' ? value : {};
    return {
      key,
      sessionId: v.sessionId,
      channel: v.channel,
      updatedAt: v.updatedAt,
      modelProvider: v.modelProvider,
      model: v.model,
      contextTokens: v.contextTokens,
      totalTokens: v.totalTokens,
      inputTokens: v.inputTokens,
      outputTokens: v.outputTokens,
      abortedLastRun: v.abortedLastRun,
    } satisfies SessionRow;
  });
}

function readOpenclawModelsText(): string {
  // Uses CLI (no secrets printed). This should work even when WS gateway is flaky.
  try {
    return execFileSync('openclaw', ['models'], {
      encoding: 'utf-8',
      env: process.env,
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err: any) {
    const stderr = String(err?.stderr || '');
    const stdout = String(err?.stdout || '');
    return [stdout, stderr].filter(Boolean).join('\n').slice(0, 20_000);
  }
}

function readGatewayLogTail(lines = 80): string {
  const p = join(process.env.HOME || '', '.openclaw', 'logs', 'gateway.log');
  if (!existsSync(p)) return '';
  const all = readFileSync(p, 'utf-8').split('\n');
  return all.slice(Math.max(0, all.length - lines)).join('\n').slice(0, 20_000);
}

export async function GET() {
  // This endpoint is local-ops. Do not expose it accidentally in prod.
  const isVercel = process.env.VERCEL === '1';
  const enabled = process.env.OPENCLAW_STUDIO === '1';
  if (isVercel && !enabled) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const sessions = readSessions().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const modelsText = readOpenclawModelsText();
  const gatewayLogTail = readGatewayLogTail();

  return NextResponse.json({
    ok: true,
    now: Date.now(),
    modelsText,
    sessions,
    gateway: {
      url: 'ws://127.0.0.1:19001',
      logTail: gatewayLogTail,
    },
  });
}

