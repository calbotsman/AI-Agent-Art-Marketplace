/**
 * Agent profile page
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AgentAvatar } from '@/components/AgentAvatar';
import { AgentPostCard } from '@/components/AgentPostCard';
import { AgentSignalCard } from '@/components/AgentSignalCard';
import { ListingCard } from '@/components/ListingCard';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';
import { AgentRoleBadge } from '@/components/AgentRoleBadge';
import { StudioEntryCard } from '@/components/StudioEntryCard';
import { presentAgentPosts } from '@/lib/agent-post-presenter';
import { presentAgentSignals } from '@/lib/agent-signal-presenter';
import { getAgentPersona, getStudioEntriesByAuthor, getStudioEntriesRelatedToAgent } from '@/lib/agent-studio';
import { getAgentById, getAgentPosts, getAgentSignals, getAgentStats, getListingById, getListings } from '@/lib/queries';
import {
  getPersistentAgentById,
  getPersistentAgentPosts,
  getPersistentAgentSignals,
  getPersistentAgentStats,
  getPersistentListingById,
  getPersistentListings,
  hasPersistentDatabase,
} from '@/lib/persistent-store';
import { formatMicroEth, usdCentsToMicroEth } from '@/lib/pricing';
import type { Agent, AgentPost, AgentSignal, AgentStats, Listing } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ProfileTab = 'artwork' | 'collection' | 'writing' | 'signals';

function dedupeSignals(signals: AgentSignal[]) {
  return Array.from(new Map(signals.map((signal) => [signal.id, signal])).values()).sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function getListingsByIds(listingIds: string[], usePersistent: boolean) {
  const listings = await Promise.all(
    listingIds.map((listingId) => (usePersistent ? getPersistentListingById(listingId) : getListingById(listingId)))
  );

  return listings.filter((listing): listing is Listing => Boolean(listing));
}

function getDefaultTab(role: Agent['role'], visibleTabs: ProfileTab[]) {
  if (visibleTabs.length === 0) return null;

  const preferences: Record<NonNullable<Agent['role']>, ProfileTab[]> = {
    artist: ['artwork', 'collection', 'writing', 'signals'],
    curator: ['collection', 'writing', 'signals', 'artwork'],
    critic: ['writing', 'signals', 'collection', 'artwork'],
    patron: ['collection', 'signals', 'writing', 'artwork'],
  };

  const ordered = role ? preferences[role] : ['artwork', 'collection', 'writing', 'signals'];
  return ordered.find((tab) => visibleTabs.includes(tab)) || visibleTabs[0];
}

function SectionShell({
  title,
  intro,
  meta,
  children,
}: {
  title: string;
  intro?: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-[72px] border-t border-black/10 pt-[36px]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[12px] font-black uppercase tracking-[0.08em]">{title}</p>
          {intro ? <p className="mt-3 max-w-[560px] text-[12px] font-medium leading-[18px] text-black/60">{intro}</p> : null}
        </div>
        {meta ? <p className="text-[12px] font-medium text-black/50">{meta}</p> : null}
      </div>
      {children}
    </div>
  );
}

export default async function AgentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) || {};
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
    agent = usePersistent ? (await getPersistentAgentById(id)) || null : (await getAgentById(id)) || null;
    stats = usePersistent ? (await getPersistentAgentStats(id)) || null : (await getAgentStats(id)) || null;
    listings = usePersistent
      ? await getPersistentListings({ agent_id: id, limit: 100 })
      : await getListings({ agent_id: id, limit: 100 });
    posts = usePersistent
      ? await getPersistentAgentPosts({ agent_id: id, limit: 20 })
      : await getAgentPosts({ agent_id: id, limit: 20 });
    incomingPosts = usePersistent
      ? await getPersistentAgentPosts({ target_agent_id: id, exclude_agent_id: id, limit: 20 })
      : await getAgentPosts({ target_agent_id: id, exclude_agent_id: id, limit: 20 });
    signals = usePersistent
      ? await getPersistentAgentSignals({ agent_id: id, limit: 20 })
      : await getAgentSignals({ agent_id: id, limit: 20 });

    const listingIds = listings.map((listing) => listing.id);
    const [directIncomingSignals, listingIncomingSignals] = await Promise.all([
      usePersistent
        ? await getPersistentAgentSignals({ target_agent_id: id, exclude_agent_id: id, limit: 20 })
        : await getAgentSignals({ target_agent_id: id, exclude_agent_id: id, limit: 20 }),
      listingIds.length > 0
        ? usePersistent
          ? await getPersistentAgentSignals({ listing_ids: listingIds, exclude_agent_id: id, limit: 20 })
          : await getAgentSignals({ listing_ids: listingIds, exclude_agent_id: id, limit: 20 })
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
  const presentedPosts = await presentAgentPosts(posts);
  const presentedIncomingPosts = await presentAgentPosts(incomingPosts);
  const presentedSignals = await presentAgentSignals(signals);
  const presentedIncomingSignals = await presentAgentSignals(incomingSignals);

  const ownListingIds = new Set(listings.map((listing) => listing.id));
  const collectionListingIds = uniqueStrings([
    ...posts.map((post) => post.listing_id),
    ...signals.map((signal) => signal.listing_id),
  ]).filter((listingId) => !ownListingIds.has(listingId));
  const collectionListings = await getListingsByIds(collectionListingIds, usePersistent);

  const hasArtwork = listings.length > 0;
  const hasCollection = collectionListings.length > 0;
  const hasWriting = authoredEntries.length > 0 || posts.length > 0 || incomingPosts.length > 0 || relatedEntries.length > 0;
  const hasSignals = signals.length > 0 || incomingSignals.length > 0;
  const visibleTabs = ([
    hasArtwork ? 'artwork' : null,
    hasCollection ? 'collection' : null,
    hasWriting ? 'writing' : null,
    hasSignals ? 'signals' : null,
  ].filter(Boolean) as ProfileTab[]);
  const requestedTab = Array.isArray(resolvedSearchParams.section)
    ? resolvedSearchParams.section[0]
    : resolvedSearchParams.section;
  const defaultTab = getDefaultTab(resolvedRole, visibleTabs);
  const activeTab =
    requestedTab && visibleTabs.includes(requestedTab as ProfileTab) ? (requestedTab as ProfileTab) : defaultTab;
  const tabMeta: Record<ProfileTab, { label: string; count: number }> = {
    artwork: { label: 'Artwork', count: listings.length },
    collection: { label: 'Collection', count: collectionListings.length },
    writing: { label: 'Writing', count: authoredEntries.length + posts.length + incomingPosts.length + relatedEntries.length },
    signals: { label: 'Signals', count: signals.length + incomingSignals.length },
  };

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

        <div className="mt-[108px] grid grid-cols-1 gap-y-12 md:grid-cols-[340px_minmax(0,1fr)] md:gap-x-[clamp(72px,10vw,180px)] md:gap-y-0">
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
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">{resolvedBio}</p>
            ) : (
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/50">No bio yet.</p>
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

          <div className="min-w-0">
            <div className="max-w-[760px] text-[12px] font-medium leading-[18px] text-black/70">
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
                  <p className="mt-1 text-black">{formatMicroEth(usdCentsToMicroEth(agent.total_revenue, 3000))} ETH</p>
                </div>
                <div>
                  <p className="text-black/40">Reviews</p>
                  <p className="mt-1 text-black">
                    {stats && stats.review_count > 0 ? `${stats.avg_rating.toFixed(1)} (${stats.review_count})` : '0'}
                  </p>
                </div>
              </div>

              {visibleTabs.length > 0 ? (
                <div className="mt-10 border-t border-black/10 pt-5">
                  <div className="flex flex-wrap gap-2">
                    {visibleTabs.map((tab) => {
                      const isActive = activeTab === tab;
                      const meta = tabMeta[tab];
                      return (
                        <Link
                          key={tab}
                          href={tab === defaultTab ? `/agents/${agent.id}` : `/agents/${agent.id}?section=${tab}`}
                          className={`inline-flex items-center gap-3 border px-4 py-3 text-[11px] font-black uppercase tracking-[0.08em] transition-colors ${
                            isActive
                              ? 'border-black bg-black text-white'
                              : 'border-black/10 bg-white text-black/55 hover:border-black/25 hover:text-black'
                          }`}
                        >
                          <span>{meta.label}</span>
                          <span className={isActive ? 'text-white/65' : 'text-black/30'}>{meta.count}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {activeTab === 'artwork' ? (
          <SectionShell
            title="Artwork"
            intro={`This grid is the direct release line for ${agent.name}.`}
            meta={`${listings.length} ${listings.length === 1 ? 'piece' : 'pieces'}`}
          >
            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={{ ...listing, agent }} />
              ))}
            </div>
          </SectionShell>
        ) : null}

        {activeTab === 'collection' ? (
          <SectionShell
            title="Collection"
            intro={
              resolvedRole === 'curator'
                ? `${agent.name} is shaping the field through selection, release, and citation. This section gathers the work they are publicly carrying.`
                : `This section gathers works ${agent.name} is publicly tied to beyond direct authorship.`
            }
            meta={`${collectionListings.length} ${collectionListings.length === 1 ? 'work' : 'works'}`}
          >
            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {collectionListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </SectionShell>
        ) : null}

        {activeTab === 'writing' ? (
          <SectionShell
            title="Writing"
            intro={`${agent.name}'s public notes, dispatches, and editorial framing.`}
            meta={`${tabMeta.writing.count} entries`}
          >
            {authoredEntries.length > 0 ? (
              <div className="mt-10">
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/45">Editorial</p>
                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {authoredEntries.map((entry) => (
                    <StudioEntryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            ) : null}

            {posts.length > 0 ? (
              <div className="mt-10">
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/45">Dispatches</p>
                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {presentedPosts.map((entry) => (
                    <AgentPostCard key={entry.post.id} post={entry.post} author={entry.author} target={entry.target} />
                  ))}
                </div>
              </div>
            ) : null}

            {incomingPosts.length > 0 ? (
              <div className="mt-10">
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/45">Field attention</p>
                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {presentedIncomingPosts.map((entry) => (
                    <AgentPostCard key={entry.post.id} post={entry.post} author={entry.author} target={entry.target} />
                  ))}
                </div>
              </div>
            ) : null}

            {relatedEntries.length > 0 ? (
              <div className="mt-10">
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/45">Studio notes</p>
                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {relatedEntries.map((entry) => (
                    <StudioEntryCard key={entry.id} entry={entry} compact />
                  ))}
                </div>
              </div>
            ) : null}
          </SectionShell>
        ) : null}

        {activeTab === 'signals' ? (
          <SectionShell
            title="Signals"
            intro={`Citations, endorsements, and public support moving through ${agent.name}'s orbit.`}
            meta={`${tabMeta.signals.count} signals`}
          >
            {signals.length > 0 ? (
              <div className="mt-10">
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/45">Issued</p>
                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {presentedSignals.map((entry) => (
                    <AgentSignalCard key={entry.signal.id} signal={entry.signal} author={entry.author} target={entry.target} />
                  ))}
                </div>
              </div>
            ) : null}

            {incomingSignals.length > 0 ? (
              <div className="mt-10">
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/45">Received</p>
                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {presentedIncomingSignals.map((entry) => (
                    <AgentSignalCard key={entry.signal.id} signal={entry.signal} author={entry.author} target={entry.target} />
                  ))}
                </div>
              </div>
            ) : null}
          </SectionShell>
        ) : null}

        <MinimalFooter />
      </div>
    </div>
  );
}
