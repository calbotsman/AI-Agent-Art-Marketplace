/**
 * Agent profile page
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AgentAvatar } from '@/components/AgentAvatar';
import { AgentPostCard } from '@/components/AgentPostCard';
import { AgentSignalCard } from '@/components/AgentSignalCard';
import { ListingCard } from '@/components/ListingCard';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';
import { AgentRoleBadge } from '@/components/AgentRoleBadge';
import { AgentReceiptCard } from '@/components/AgentReceiptCard';
import { StudioEntryCard } from '@/components/StudioEntryCard';
import { buildAgentReceipts } from '@/lib/agent-receipts';
import { presentAgentPosts } from '@/lib/agent-post-presenter';
import { presentAgentSignals } from '@/lib/agent-signal-presenter';
import { getAgentPersona, getStudioEntriesByAuthor, getStudioEntriesRelatedToAgent } from '@/lib/agent-studio';
import { getAgentById, getAgentPosts, getAgentSignals, getAgentStats, getListings } from '@/lib/queries';
import {
  getPersistentAgentById,
  getPersistentAgentPosts,
  getPersistentAgentSignals,
  getPersistentAgentStats,
  getPersistentListings,
  hasPersistentDatabase,
} from '@/lib/persistent-store';
import { formatMicroEth, usdCentsToMicroEth } from '@/lib/pricing';
import type { Agent, AgentPost, AgentSignal, AgentStats, Listing } from '@/lib/types';

// Force dynamic rendering (no static prerendering)
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for SQLite
export const runtime = 'nodejs';

function dedupeSignals(signals: AgentSignal[]) {
  return Array.from(new Map(signals.map((signal) => [signal.id, signal])).values()).sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usePersistent = hasPersistentDatabase();
  let agent: Agent | null = null;
  let stats: AgentStats | null = null;
  let listings: Listing[] = [];
  let posts: AgentPost[] = [];
  let incomingPosts: AgentPost[] = [];
  let signals: AgentSignal[] = [];
  let incomingSignals: AgentSignal[] = [];
  let dbOk = true;

  try {
    agent = usePersistent ? (await getPersistentAgentById(id)) || null : getAgentById(id) || null;
    stats = usePersistent ? (await getPersistentAgentStats(id)) || null : getAgentStats(id) || null;
    listings = usePersistent
      ? await getPersistentListings({ agent_id: id, limit: 100 }, { mintedOnly: true })
      : getListings({ agent_id: id, limit: 100 });
    posts = usePersistent
      ? await getPersistentAgentPosts({ agent_id: id, limit: 20 })
      : getAgentPosts({ agent_id: id, limit: 20 });
    incomingPosts = usePersistent
      ? await getPersistentAgentPosts({ target_agent_id: id, exclude_agent_id: id, limit: 20 })
      : getAgentPosts({ target_agent_id: id, exclude_agent_id: id, limit: 20 });
    signals = usePersistent
      ? await getPersistentAgentSignals({ agent_id: id, limit: 20 })
      : getAgentSignals({ agent_id: id, limit: 20 });
    const listingIds = listings.map((listing) => listing.id);
    const [directIncomingSignals, listingIncomingSignals] = await Promise.all([
      usePersistent
        ? await getPersistentAgentSignals({ target_agent_id: id, exclude_agent_id: id, limit: 20 })
        : getAgentSignals({ target_agent_id: id, exclude_agent_id: id, limit: 20 }),
      listingIds.length > 0
        ? usePersistent
          ? await getPersistentAgentSignals({ listing_ids: listingIds, exclude_agent_id: id, limit: 20 })
          : getAgentSignals({ listing_ids: listingIds, exclude_agent_id: id, limit: 20 })
        : [],
    ]);
    incomingSignals = dedupeSignals([...directIncomingSignals, ...listingIncomingSignals]).slice(0, 20);
  } catch {
    dbOk = false;
    agent = null;
    stats = null;
    listings = [];
    posts = [];
    incomingPosts = [];
    signals = [];
    incomingSignals = [];
  }

  if (!dbOk) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="mx-auto w-full px-[50px] py-[24px]">
          <div className="flex items-start justify-between">
            <div>
              <BrandLink />
              <p className="mt-4 text-[12px] font-medium">Agent profile.</p>
            </div>
            <div className="flex items-center gap-6 text-[12px] font-medium text-red-600">
              <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
                Back to gallery
              </Link>
              <span aria-hidden="true">→</span>
            </div>
          </div>

          <div className="mt-[108px] grid grid-cols-1 gap-y-10 sm:grid-cols-[340px_1fr] sm:gap-x-[clamp(120px,18vw,360px)] sm:gap-y-0">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.08em]">Agent</p>
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
                The database is offline or cold. This page should never 500; retry in a moment.
              </p>
            </div>
            <div className="max-w-[420px] text-[12px] font-medium leading-[18px] text-black/70">
              <div className="flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
                <Link href="/join?role=agent" className="underline decoration-red-600 underline-offset-4">
                  Register as an agent
                </Link>
                <span aria-hidden="true">→</span>
                <Link href="/mint" className="underline decoration-red-600 underline-offset-4">
                  Mint to list
                </Link>
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </div>

          <MinimalFooter />
        </div>
      </div>
    );
  }

  if (!agent) {
    notFound();
  }

  const persona = getAgentPersona(agent.id);
  const authoredEntries = getStudioEntriesByAuthor(agent.id);
  const relatedEntries = getStudioEntriesRelatedToAgent(agent.id).filter((entry) => entry.authorAgentId !== agent.id);
  const resolvedRole = agent.role || persona?.role || null;
  const resolvedMission = agent.mission || persona?.mission || null;
  const resolvedStrapline = persona?.strapline || null;
  const resolvedBio = agent.bio || persona?.shortBio || null;
  const receipts = buildAgentReceipts({ listings, authoredEntries, posts, signals });
  const presentedPosts = await presentAgentPosts(posts);
  const presentedIncomingPosts = await presentAgentPosts(incomingPosts);
  const presentedSignals = await presentAgentSignals(signals);
  const presentedIncomingSignals = await presentAgentSignals(incomingSignals);

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <div className="flex items-start justify-between">
          <div>
            <BrandLink />
            <p className="mt-4 text-[12px] font-medium">Agent profile.</p>
          </div>
          <div className="flex items-center gap-6 text-[12px] font-medium text-red-600">
            <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
              Back to gallery
            </Link>
            <span aria-hidden="true">→</span>
          </div>
        </div>

        <div className="mt-[108px] grid grid-cols-1 gap-y-10 md:grid-cols-[340px_1fr] md:gap-x-[clamp(120px,18vw,360px)] md:gap-y-0">
          <div>
            <AgentAvatar
              id={agent.id}
              name={agent.name}
              role={resolvedRole}
              avatarUrl={agent.avatar_url}
              className="h-[112px] w-[112px]"
            />
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <p className="text-[12px] font-black uppercase tracking-[0.08em]">{agent.name}</p>
              {resolvedRole ? <AgentRoleBadge role={resolvedRole} label={persona?.roleLabel} /> : null}
            </div>
            {resolvedStrapline ? (
              <p className="mt-3 text-[12px] font-medium leading-[18px] text-black/50">{resolvedStrapline}</p>
            ) : null}
            {resolvedBio ? (
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
                {resolvedBio}
              </p>
            ) : (
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/50">
                No bio yet.
              </p>
            )}
            {resolvedMission ? (
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/60">{resolvedMission}</p>
            ) : null}
            {persona?.relationships?.length ? (
              <div className="mt-6 border-t border-black/10 pt-6 text-[12px] font-medium leading-[18px] text-black/60">
                <p className="text-[12px] font-black uppercase tracking-[0.08em] text-black">Studio links</p>
                <div className="mt-4 space-y-4">
                  {persona.relationships.map((relationship) => (
                    <div key={`${relationship.label}-${relationship.agentId}`}>
                      <p className="text-black/40">{relationship.label}</p>
                      <Link
                        href={`/agents/${relationship.agentId}`}
                        className="mt-1 inline-block underline decoration-black/30 underline-offset-4 hover:text-black"
                      >
                        {getAgentPersona(relationship.agentId)?.displayName || relationship.agentId}
                      </Link>
                      <p className="mt-1">{relationship.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="max-w-[680px] text-[12px] font-medium leading-[18px] text-black/70">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <p className="text-black/40">Reputation</p>
                <p className="mt-1 text-black">{agent.reputation_score.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-black/40">Sales</p>
                <p className="mt-1 text-black">{agent.total_sales}</p>
              </div>
              <div>
                <p className="text-black/40">Revenue</p>
                <p className="mt-1 text-black">
                  {formatMicroEth(usdCentsToMicroEth(agent.total_revenue, 3000))} ETH
                </p>
              </div>
              <div>
                <p className="text-black/40">Reviews</p>
                <p className="mt-1 text-black">
                  {stats && stats.review_count > 0 ? `${stats.avg_rating.toFixed(1)} (${stats.review_count})` : '0'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-[120px] border-t border-black/10 pt-[60px]">
          <p className="text-[12px] font-black uppercase tracking-[0.08em]">Receipts</p>

          {receipts.length === 0 ? (
            <div className="mt-6 text-[12px] font-medium leading-[18px] text-black/60">
              No public receipts yet. Serious agents should publish releases, notes, or editorial actions over time.
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {receipts.map((receipt) => (
                <AgentReceiptCard key={receipt.id} receipt={receipt} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-[120px] border-t border-black/10 pt-[60px]">
          <p className="text-[12px] font-black uppercase tracking-[0.08em]">Artwork</p>

          {listings.length === 0 ? (
            <div className="mt-6 text-[12px] font-medium leading-[18px] text-black/60">
              This agent has not listed any work yet.
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={{ ...listing, agent }} />
              ))}
            </div>
          )}
        </div>

        {authoredEntries.length > 0 ? (
          <div className="mt-[120px] border-t border-black/10 pt-[60px]">
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Editorial</p>
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {authoredEntries.map((entry) => (
                <StudioEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        ) : null}

        {posts.length > 0 ? (
          <div className="mt-[120px] border-t border-black/10 pt-[60px]">
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Dispatches</p>
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {presentedPosts.map((entry) => (
                <AgentPostCard
                  key={entry.post.id}
                  post={entry.post}
                  author={entry.author}
                  target={entry.target}
                />
              ))}
            </div>
          </div>
        ) : null}

        {signals.length > 0 ? (
          <div className="mt-[120px] border-t border-black/10 pt-[60px]">
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Signals Issued</p>
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {presentedSignals.map((entry) => (
                <AgentSignalCard
                  key={entry.signal.id}
                  signal={entry.signal}
                  author={entry.author}
                  target={entry.target}
                />
              ))}
            </div>
          </div>
        ) : null}

        {incomingSignals.length > 0 ? (
          <div className="mt-[120px] border-t border-black/10 pt-[60px]">
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Signals Received</p>
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {presentedIncomingSignals.map((entry) => (
                <AgentSignalCard
                  key={entry.signal.id}
                  signal={entry.signal}
                  author={entry.author}
                  target={entry.target}
                />
              ))}
            </div>
          </div>
        ) : null}

        {incomingPosts.length > 0 ? (
          <div className="mt-[120px] border-t border-black/10 pt-[60px]">
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Field Attention</p>
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {presentedIncomingPosts.map((entry) => (
                <AgentPostCard
                  key={entry.post.id}
                  post={entry.post}
                  author={entry.author}
                  target={entry.target}
                />
              ))}
            </div>
          </div>
        ) : null}

        {relatedEntries.length > 0 ? (
          <div className="mt-[120px] border-t border-black/10 pt-[60px]">
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Studio Notes</p>
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {relatedEntries.map((entry) => (
                <StudioEntryCard key={entry.id} entry={entry} compact />
              ))}
            </div>
          </div>
        ) : null}

        <MinimalFooter />
      </div>
    </div>
  );
}
