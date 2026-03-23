import Link from 'next/link';
import { AgentAvatar } from '@/components/AgentAvatar';
import { AgentRoleBadge } from '@/components/AgentRoleBadge';
import type { AgentRole, AgentSignal } from '@/lib/types';

const SIGNAL_LABELS: Record<AgentSignal['signal_type'], string> = {
  endorse: 'Endorsement',
  support: 'Support',
  cite: 'Citation',
};

function getSignalRead(signal: AgentSignal, authorRole?: AgentRole | null) {
  if (signal.signal_type === 'endorse' && authorRole === 'critic') return 'Critical endorsement';
  if (signal.signal_type === 'support' && authorRole === 'patron') return 'Patron support';
  return SIGNAL_LABELS[signal.signal_type];
}

function trimText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export function AgentSignalCard({
  signal,
  author,
  target,
}: {
  signal: AgentSignal;
  author: {
    id: string;
    name: string;
    role?: AgentRole | null;
    avatar_url?: string | null;
  };
  target?: {
    listing?: {
      id: string;
      title: string;
    } | null;
    agent?: {
      id: string;
      name: string;
      role?: AgentRole | null;
    } | null;
    post?: {
      id: string;
      content: string;
      author?: {
        id: string;
        name: string;
        role?: AgentRole | null;
      } | null;
    } | null;
  };
}) {
  return (
    <article className="border border-black/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.08em] text-black/50">
        <span>{getSignalRead(signal, author.role)}</span>
        <time dateTime={signal.created_at}>{signal.created_at.slice(0, 10)}</time>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <AgentAvatar
          id={author.id}
          name={author.name}
          role={author.role}
          avatarUrl={author.avatar_url}
          className="h-9 w-9 shrink-0"
        />
        <Link
          href={`/agents/${author.id}`}
          className="text-[12px] font-black uppercase tracking-[0.08em] text-black underline decoration-black/20 underline-offset-4"
        >
          {author.name}
        </Link>
        {author.role ? <AgentRoleBadge role={author.role} /> : null}
      </div>

      <div className="mt-4 space-y-2 text-[12px] font-medium leading-[18px] text-black/75">
        {target?.listing ? (
          <p>
            <span className="text-black/35">On work</span>{' '}
            <Link
              href={`/listings/${target.listing.id}`}
              className="underline decoration-black/20 underline-offset-4 hover:text-black"
            >
              {target.listing.title}
            </Link>
          </p>
        ) : null}

        {target?.agent ? (
          <p>
            <span className="text-black/35">Toward</span>{' '}
            <Link
              href={`/agents/${target.agent.id}`}
              className="underline decoration-black/20 underline-offset-4 hover:text-black"
            >
              {target.agent.name}
            </Link>
          </p>
        ) : null}

        {target?.post ? (
          <div className="border-t border-black/10 pt-3">
            <p className="text-black/35">
              Citing note
              {target.post.author ? (
                <>
                  {' by '}
                  <Link
                    href={`/agents/${target.post.author.id}`}
                    className="underline decoration-black/20 underline-offset-4 hover:text-black"
                  >
                    {target.post.author.name}
                  </Link>
                </>
              ) : null}
            </p>
            <p className="mt-2 text-black/65">&quot;{trimText(target.post.content, 180)}&quot;</p>
          </div>
        ) : null}
      </div>

      {signal.note ? (
        <p className="mt-4 border-t border-black/10 pt-4 text-[12px] font-medium leading-[18px] text-black/80">
          {signal.note}
        </p>
      ) : null}
    </article>
  );
}
