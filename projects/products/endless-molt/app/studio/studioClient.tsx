'use client';

import { useEffect, useMemo, useState } from 'react';

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

type StatusPayload = {
  ok: boolean;
  now: number;
  modelsText: string;
  sessions: SessionRow[];
  gateway: { url: string; logTail: string };
};

function fmtTime(ts?: number) {
  if (!ts) return '–';
  const d = new Date(ts);
  return d.toLocaleString();
}

export default function StudioClient() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch('/api/openclaw/status', { cache: 'no-store' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${res.status}`);
        }
        const j = (await res.json()) as StatusPayload;
        if (!cancelled) {
          setData(j);
          setErr('');
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load');
      }
    }

    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const recent = useMemo(() => {
    if (!data) return [];
    return data.sessions
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 12);
  }, [data]);

  return (
    <div className="mt-[108px] space-y-[60px]">
      <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-[340px_1fr] sm:gap-x-[clamp(120px,18vw,360px)] sm:gap-y-0">
        <div>
          <p className="text-[12px] font-black uppercase tracking-[0.08em]">Status</p>
          <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
            Local ops dashboard. Polls every 5s.
          </p>
          {err ? (
            <div className="mt-6 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[12px] font-medium text-red-600">
              {err}
            </div>
          ) : null}
        </div>

        <div className="max-w-[920px] text-[12px] font-medium leading-[18px] text-black/70">
          <div className="border border-black/10 bg-white px-4 py-3">
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Gateway</p>
            <p className="mt-3">
              <span className="text-black/50">URL</span> <span className="text-black">{data?.gateway.url || '–'}</span>
            </p>
            <p className="mt-2">
              <span className="text-black/50">Last update</span> <span className="text-black">{data ? fmtTime(data.now) : '–'}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-[340px_1fr] sm:gap-x-[clamp(120px,18vw,360px)] sm:gap-y-0">
        <div>
          <p className="text-[12px] font-black uppercase tracking-[0.08em]">Recent sessions</p>
          <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
            Shows what’s alive recently and where it’s talking (telegram/webchat/etc).
          </p>
        </div>

        <div className="max-w-[920px]">
          <div className="grid grid-cols-1 gap-6">
            {recent.map((s) => (
              <div key={s.key} className="border border-black/10 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-[12px] font-black uppercase tracking-[0.08em]">{s.key}</p>
                  <p className="text-[12px] font-medium text-black/50">{fmtTime(s.updatedAt)}</p>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-y-1 text-[12px] font-medium text-black/70 sm:grid-cols-2 sm:gap-x-10">
                  <p>
                    <span className="text-black/50">Channel</span> <span className="text-black">{s.channel || '–'}</span>
                  </p>
                  <p>
                    <span className="text-black/50">Model</span> <span className="text-black">{s.model || '–'}</span>
                  </p>
                  <p>
                    <span className="text-black/50">Provider</span> <span className="text-black">{s.modelProvider || '–'}</span>
                  </p>
                  <p>
                    <span className="text-black/50">Tokens</span> <span className="text-black">{s.totalTokens ?? '–'}</span>
                  </p>
                </div>
              </div>
            ))}
            {data && recent.length === 0 ? (
              <div className="border border-black/10 bg-white px-4 py-3 text-[12px] font-medium text-black/70">
                No sessions found.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-[340px_1fr] sm:gap-x-[clamp(120px,18vw,360px)] sm:gap-y-0">
        <div>
          <p className="text-[12px] font-black uppercase tracking-[0.08em]">Models</p>
          <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
            Output of <span className="text-black">openclaw models</span>.
          </p>
        </div>

        <div className="max-w-[920px]">
          <pre className="whitespace-pre-wrap border border-black/10 bg-white px-4 py-3 text-[12px] font-mono text-black/80 overflow-x-auto">
            {data?.modelsText || 'Loading...'}
          </pre>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-[340px_1fr] sm:gap-x-[clamp(120px,18vw,360px)] sm:gap-y-0">
        <div>
          <p className="text-[12px] font-black uppercase tracking-[0.08em]">Gateway log</p>
          <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
            Tail of <span className="text-black">~/.openclaw/logs/gateway.log</span>.
          </p>
        </div>

        <div className="max-w-[920px]">
          <pre className="whitespace-pre-wrap border border-black/10 bg-white px-4 py-3 text-[12px] font-mono text-black/80 overflow-x-auto">
            {data?.gateway.logTail || '(no log)'}
          </pre>
        </div>
      </div>
    </div>
  );
}

