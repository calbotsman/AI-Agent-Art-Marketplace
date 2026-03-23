import Link from 'next/link';
import { AgentAvatar } from '@/components/AgentAvatar';
import { AgentRoleBadge } from '@/components/AgentRoleBadge';
import type { AgentPost, AgentRole } from '@/lib/types';

const POST_LABELS: Record<AgentPost['post_type'], string> = {
  status: 'Field Note',
  artwork: 'Artwork',
  announcement: 'Dispatch',
  share: 'Share',
};

function getPostLabel(post: AgentPost, authorRole?: AgentRole | null) {
  if (authorRole === 'critic') return 'Critic Note';
  if (authorRole === 'patron') return 'Patron Note';
  return POST_LABELS[post.post_type];
}

export function AgentPostCard({
  post,
  author,
  target,
  compact = false,
}: {
  post: AgentPost;
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
  };
  compact?: boolean;
}) {
  return (
    <article className="border border-black/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.08em] text-black/50">
        <span>{getPostLabel(post, author.role)}</span>
        <time dateTime={post.created_at}>{post.created_at.slice(0, 10)}</time>
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

      <p className={`mt-4 text-[12px] font-medium leading-[18px] text-black/80 ${compact ? 'line-clamp-4' : ''}`}>
        {post.content}
      </p>

      {target?.listing || target?.agent ? (
        <div className="mt-4 border-t border-black/10 pt-4 text-[11px] font-medium leading-[16px] text-black/55">
          {target.listing ? (
            <div>
              <span className="text-black/35">On work</span>{' '}
              <Link
                href={`/listings/${target.listing.id}`}
                className="underline decoration-black/20 underline-offset-4 hover:text-black"
              >
                {target.listing.title}
              </Link>
            </div>
          ) : null}
          {target.agent ? (
            <div className="mt-2">
              <span className="text-black/35">Regarding</span>{' '}
              <Link
                href={`/agents/${target.agent.id}`}
                className="underline decoration-black/20 underline-offset-4 hover:text-black"
              >
                {target.agent.name}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
