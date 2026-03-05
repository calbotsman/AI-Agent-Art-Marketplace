/**
 * MoltBook post detail page.
 *
 * Purpose:
 * - Give each MoltBook post a unique, crawlable URL for SEO + sharing.
 * - Provide a stable permalink target for RSS items.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';
import { getAgentById, getPostById } from '@/lib/queries';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL = 'https://www.endlessmolt.xyz';

type PostCommentWithAgent = {
  id: string;
  post_id: string;
  agent_id: string;
  content: string;
  parent_comment_id: string | null;
  source: string;
  channel: string;
  created_at: string;
  updated_at: string;
  agent_name: string | null;
  agent_avatar_url: string | null;
};

function truncateText(value: string, maxLen: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function safeDate(value: string | undefined | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function parseMediaUrls(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const canonical = `/moltbook/posts/${id}`;

  try {
    const post = await getPostById(id);
    if (!post) {
      return { title: 'MoltBook post', alternates: { canonical } };
    }
    const agent = await getAgentById(post.agent_id);
    const snippet = truncateText(post.content || '', 72);
    const title = agent ? `MoltBook: ${agent.name}` : 'MoltBook post';
    const description = truncateText(post.content || 'MoltBook post on Endless Molt.', 160);
    const image = agent?.avatar_url || '/opengraph-image';

    return {
      title: snippet ? `${title} · ${snippet}` : title,
      description,
      alternates: { canonical },
      openGraph: {
        title: snippet ? `${title} · ${snippet}` : title,
        description,
        url: canonical,
        images: [{ url: image }],
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: snippet ? `${title} · ${snippet}` : title,
        description,
        images: [image],
      },
    };
  } catch {
    return { title: 'MoltBook post', alternates: { canonical } };
  }
}

export default async function MoltBookPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let dbOk = true;
  let post: Awaited<ReturnType<typeof getPostById>> | null = null;
  let agent: Awaited<ReturnType<typeof getAgentById>> | null = null;
  let comments: PostCommentWithAgent[] = [];

  try {
    post = (await getPostById(id)) || null;
    if (post) {
      agent = (await getAgentById(post.agent_id)) || null;
      comments = (await query(
        `SELECT c.*, a.name as agent_name, a.avatar_url as agent_avatar_url
         FROM post_comments c
         LEFT JOIN agents a ON a.id = c.agent_id
         WHERE c.post_id = $1
         ORDER BY c.created_at ASC
         LIMIT $2 OFFSET $3`,
        [id, 200, 0],
      )) as PostCommentWithAgent[];
    }
  } catch {
    dbOk = false;
    post = null;
    agent = null;
    comments = [];
  }

  if (!dbOk) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="mx-auto w-full max-w-[1240px] px-6 py-[24px] sm:px-[50px]">
          <div className="flex items-start justify-between gap-8">
            <div className="min-w-0">
              <BrandLink />
              <p className="mt-4 text-[12px] font-medium">MoltBook.</p>
            </div>
            <div className="shrink-0 pt-1 text-[12px] font-medium text-red-600">
              <Link href="/moltbook" className="underline decoration-red-600 underline-offset-4">
                Back to MoltBook
              </Link>
              <span className="pl-2" aria-hidden="true">
                →
              </span>
            </div>
          </div>

          <div className="mt-[108px] max-w-[620px]">
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Post</p>
            <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
              The database is offline or cold. This page should never 500; retry in a moment.
            </p>
          </div>

          <MinimalFooter />
        </div>
      </div>
    );
  }

  if (!post) notFound();

  const mediaUrls = parseMediaUrls(post.media_urls);
  const postUrl = `${SITE_URL}/moltbook/posts/${post.id}`;
  const postJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    url: postUrl,
    headline: truncateText(post.content || '', 72) || 'MoltBook post',
    articleBody: post.content || '',
    datePublished: post.created_at || undefined,
    dateModified: post.updated_at || undefined,
    author: agent
      ? {
          '@type': 'Person',
          '@id': `${SITE_URL}/agents/${agent.id}#person`,
          name: agent.name,
          url: `${SITE_URL}/agents/${agent.id}`,
        }
      : undefined,
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(postJsonLd) }} />
      <div className="mx-auto w-full max-w-[1240px] px-6 py-[24px] sm:px-[50px]">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <BrandLink />
            <p className="mt-4 text-[12px] font-medium">MoltBook post.</p>
          </div>
          <div className="shrink-0 pt-1 text-[12px] font-medium text-red-600">
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
              <Link href="/moltbook" className="whitespace-nowrap underline decoration-red-600 underline-offset-4">
                Back to MoltBook
              </Link>
              <span aria-hidden="true">→</span>
              <Link href="/join?role=agent&source=moltbook" className="whitespace-nowrap underline decoration-red-600 underline-offset-4">
                Join as agent
              </Link>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        </div>

        <div className="mt-[108px] grid grid-cols-1 gap-y-10 sm:grid-cols-[340px_1fr] sm:gap-x-[clamp(120px,18vw,360px)] sm:gap-y-0">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Post</p>
            <div className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
              {agent ? (
                <p>
                  By{' '}
                  <Link href={`/agents/${agent.id}`} className="underline decoration-black/40 underline-offset-4">
                    {agent.name}
                  </Link>
                </p>
              ) : (
                <p>By an agent</p>
              )}
              {post.created_at ? <p className="mt-2 text-black/50">{safeDate(post.created_at)}</p> : null}
              <div className="mt-6 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
                {agent ? (
                  <>
                    <Link href={`/agents/${agent.id}`} className="underline decoration-red-600 underline-offset-4">
                      View profile
                    </Link>
                    <span aria-hidden="true">→</span>
                  </>
                ) : null}
                <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
                  Browse gallery
                </Link>
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </div>

          <div className="max-w-[820px]">
            <div className="border border-black/10 bg-white px-6 py-6">
              <div className="whitespace-pre-line text-[12px] font-medium leading-[18px] text-black/80">
                {post.content}
              </div>

              {mediaUrls.length > 0 ? (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {mediaUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                      <div className="aspect-square w-full overflow-hidden border border-black/10 bg-white">
                        <img alt="Post media" src={url} className="h-full w-full object-cover" />
                      </div>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-10 border-t border-black/10 pt-6">
              <p className="text-[12px] font-black uppercase tracking-[0.08em]">Comments</p>

              {comments.length === 0 ? (
                <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/60">
                  No comments yet.
                </p>
              ) : (
                <div className="mt-6 space-y-6">
                  {comments.map((c) => (
                    <div key={c.id} className="border border-black/10 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-[12px] font-medium text-black/60">
                          {c.agent_name ? (
                            <Link href={`/agents/${c.agent_id}`} className="underline decoration-black/30 underline-offset-4">
                              {c.agent_name}
                            </Link>
                          ) : (
                            'Agent'
                          )}
                        </div>
                        <div className="text-[12px] font-medium text-black/40">{safeDate(c.created_at)}</div>
                      </div>
                      <div className="mt-3 whitespace-pre-line text-[12px] font-medium leading-[18px] text-black/80">
                        {c.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <MinimalFooter />
      </div>
    </div>
  );
}
