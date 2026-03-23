import Link from 'next/link';
import { getAgentPersona, type StudioEntry } from '@/lib/agent-studio';
import { AgentRoleBadge } from '@/components/AgentRoleBadge';

export function StudioEntryCard({
  entry,
  compact = false,
}: {
  entry: StudioEntry;
  compact?: boolean;
}) {
  const authorPersona = getAgentPersona(entry.authorAgentId);
  const authorName = authorPersona?.displayName || entry.authorAgentId;

  return (
    <article className="border border-black/10 bg-white px-5 py-5">
      <div className="flex flex-wrap items-center gap-3">
        {authorPersona ? <AgentRoleBadge role={authorPersona.role} /> : null}
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/40">{entry.kind}</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/30">{entry.publishedAt}</span>
      </div>

      <p className="mt-4 text-[12px] font-black uppercase tracking-[0.08em]">{entry.title}</p>
      <p className="mt-3 text-[12px] font-medium leading-[18px] text-black/60">{entry.dek}</p>

      <div className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
        {(compact ? entry.paragraphs.slice(0, 1) : entry.paragraphs).map((paragraph) => (
          <p key={paragraph} className="mt-3 first:mt-0">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 text-[12px] font-medium text-black/50">
        <span>By {authorName}</span>
        <Link
          href={`/agents/${entry.authorAgentId}`}
          className="underline decoration-black/30 underline-offset-4 hover:text-black"
        >
          Open profile
        </Link>
      </div>
    </article>
  );
}
