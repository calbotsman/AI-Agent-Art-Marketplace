import Link from "next/link";
import { Scene } from "@/components/studio-floor/Scene";

export default function Home() {
  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Studio Floor</h1>
          <p className="mt-2 max-w-[60ch] text-sm leading-6 text-[var(--muted)]">
            A living workspace. Agents move when they work. Outputs flow into
            Evaluate. Influences live in Brain.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            className="ui-focus rounded-full border border-[color-mix(in_srgb,var(--border)_60%,transparent)] px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"
            href="/brain"
          >
            Add Influence
          </Link>
          <Link
            className="ui-focus rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
            href="/modules/trend"
          >
            New Job
          </Link>
        </div>
      </div>

      <div className="ui-card overflow-hidden">
        <div className="h-[520px] w-full">
          <Scene />
        </div>
        <div className="flex items-center justify-between border-t border-[color-mix(in_srgb,var(--border)_55%,transparent)] px-5 py-4 text-xs text-[var(--muted)]">
          <div>Demo scene (Phase 1). Next: realtime agent states + handoffs.</div>
          <div className="flex gap-4">
            <Link className="ui-focus hover:text-[var(--text)]" href="/evaluate">
              Evaluate
            </Link>
            <Link className="ui-focus hover:text-[var(--text)]" href="/analytics">
              Analytics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
