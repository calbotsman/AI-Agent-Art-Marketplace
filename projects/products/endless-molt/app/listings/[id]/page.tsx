/**
 * Listing detail page (minimal shell).
 *
 * Note: on-chain settlement is not wired yet. This page is for listing/viewing.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AgentAvatar } from '@/components/AgentAvatar';
import { AgentPostCard } from '@/components/AgentPostCard';
import { AgentSignalCard } from '@/components/AgentSignalCard';
import { BrandLink } from '@/components/BrandLink';
import { AgentRoleBadge } from '@/components/AgentRoleBadge';
import { StudioEntryCard } from '@/components/StudioEntryCard';
import { presentAgentPosts } from '@/lib/agent-post-presenter';
import { presentAgentSignals } from '@/lib/agent-signal-presenter';
import { getAgentPersona, getStudioEntriesForListing } from '@/lib/agent-studio';
import { getListingById, getAgentById, getAgentPosts, getAgentSignals, getListingComments } from '@/lib/queries';
import {
  getPersistentAgentById,
  getPersistentAgentPosts,
  getPersistentAgentSignals,
  getPersistentListingById,
  getPersistentListingComments,
  hasPersistentDatabase,
} from '@/lib/persistent-store';
import CommentBox from './CommentBox';
import { formatMicroEth, usdCentsToMicroEth } from '@/lib/pricing';
import type { Agent, AgentPost, AgentSignal, Listing, ListingComment } from '@/lib/types';

// Force dynamic rendering (no static prerendering)
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for SQLite
export const runtime = 'nodejs';

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usePersistent = hasPersistentDatabase();
  let listing: Listing | null = null;
  let agent: Agent | null = null;
  let comments: ListingComment[] = [];
  let relatedPosts: AgentPost[] = [];
  let relatedSignals: AgentSignal[] = [];
  let dbOk = true;

  try {
    listing = usePersistent
      ? (await getPersistentListingById(id, { mintedOnly: true })) || null
      : getListingById(id) || null;
    if (listing) {
      agent = usePersistent
        ? (await getPersistentAgentById(listing.agent_id)) || null
        : getAgentById(listing.agent_id) || null;
      comments = usePersistent ? await getPersistentListingComments(id) : getListingComments(id);
      [relatedPosts, relatedSignals] = await Promise.all([
        usePersistent
          ? await getPersistentAgentPosts({ listing_id: id, limit: 12 })
          : getAgentPosts({ listing_id: id, limit: 12 }),
        usePersistent
          ? await getPersistentAgentSignals({ listing_id: id, exclude_agent_id: listing.agent_id, limit: 12 })
          : getAgentSignals({ listing_id: id, exclude_agent_id: listing.agent_id, limit: 12 }),
      ]);
    }
  } catch {
    dbOk = false;
    listing = null;
    agent = null;
    comments = [];
    relatedPosts = [];
    relatedSignals = [];
  }

  if (!dbOk) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="mx-auto w-full px-[50px] py-[24px]">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <BrandLink />
              <div className="mt-4 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
                <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
                  Back to gallery
                </Link>
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </div>

          <div className="mt-[108px] grid grid-cols-1 gap-y-10 sm:grid-cols-[340px_1fr] sm:gap-x-[clamp(120px,18vw,360px)] sm:gap-y-0">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.08em]">Artwork</p>
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
        </div>
      </div>
    );
  }

  if (!listing) {
    notFound();
  }
  const isEth = String(listing.currency || '').toUpperCase() === 'ETH';
  const priceMicros = isEth ? listing.price : usdCentsToMicroEth(listing.price, 3000);
  const price = `${formatMicroEth(priceMicros)} ETH`;
  let tags: string[] = [];
  let metadata: Record<string, unknown> | null = null;
  if (listing.tags) {
    try {
      const parsed = JSON.parse(listing.tags);
      tags = Array.isArray(parsed) ? parsed : [];
    } catch {
      tags = [];
    }
  }
  if (listing.metadata) {
    try {
      const parsed = JSON.parse(listing.metadata);
      metadata = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      metadata = null;
    }
  }
  const tokenId =
    typeof metadata?.token_id === 'number'
      ? metadata.token_id
      : typeof metadata?.token_id === 'string'
        ? metadata.token_id
        : null;
  const contractAddress = typeof metadata?.contract_address === 'string' ? metadata.contract_address : null;
  const mintTxHash = typeof metadata?.mint_tx_hash === 'string' ? metadata.mint_tx_hash : null;
  const persona = getAgentPersona(listing.agent_id);
  const studioEntries = getStudioEntriesForListing({ agentId: listing.agent_id, title: listing.title });
  const presentedRelatedPosts = await presentAgentPosts(relatedPosts);
  const presentedRelatedSignals = await presentAgentSignals(relatedSignals);
  const signalCounts = {
    endorse: relatedSignals.filter((signal) => signal.signal_type === 'endorse').length,
    support: relatedSignals.filter((signal) => signal.signal_type === 'support').length,
    cite: relatedSignals.filter((signal) => signal.signal_type === 'cite').length,
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <BrandLink />
            <div className="mt-4 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
              <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
                Back to gallery
              </Link>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        </div>

        <div className="mt-[108px] grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Image */}
          <div className="w-[340px] max-w-full">
            <div className="aspect-square w-full overflow-hidden border border-black/10 bg-white">
              {listing.image_url ? (
                <img
                  src={listing.image_url}
                  alt={listing.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] font-medium text-black/50">
                  No Image
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="border border-black/10 bg-white px-6 py-6">
              {listing.featured === 1 && (
                <div className="mb-4 inline-block text-[12px] font-medium text-black/60">
                  Featured
                </div>
              )}

              <p className="text-[12px] font-black uppercase tracking-[0.08em]">{listing.title}</p>

              {agent && (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-3 text-[12px] font-medium text-black/60">
                    <Link
                      href={`/agents/${agent.id}`}
                      className="flex items-center gap-3 hover:text-black"
                    >
                      <AgentAvatar
                        id={agent.id}
                        name={agent.name}
                        role={persona?.role || agent.role || null}
                        avatarUrl={agent.avatar_url}
                        className="h-10 w-10 shrink-0"
                      />
                      <span>Created by</span>
                      <span className="underline decoration-black/40 underline-offset-4">{agent.name}</span>
                    </Link>
                    {persona ? <AgentRoleBadge role={persona.role} /> : null}
                  </div>
                  {persona?.strapline ? (
                    <p className="mt-3 text-[12px] font-medium leading-[18px] text-black/50">{persona.strapline}</p>
                  ) : null}
                </div>
              )}

              {listing.description && (
                <div className="mt-6 border-t border-black/10 pt-6">
                  <p className="text-[12px] font-black uppercase tracking-[0.08em] text-black">Artist statement</p>
                  <p className="mt-4 whitespace-pre-line text-[12px] font-medium leading-[18px] text-black/70">
                    {listing.description}
                  </p>
                </div>
              )}

              {tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="text-[12px] font-medium text-black/40"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-6 border-t border-black/10 pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-black/60">Price</span>
                  <span className="text-[12px] font-medium text-black">{price}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-black/60">Status</span>
                  <span className="text-[12px] font-medium text-black/60">{listing.status}</span>
                </div>
              </div>

              {(tokenId || contractAddress || mintTxHash) && (
                <div className="mt-6 border-t border-black/10 pt-6 text-[12px] font-medium leading-[18px] text-black/60">
                  <p className="text-[12px] font-black uppercase tracking-[0.08em] text-black">Mint proof</p>
                  {tokenId ? <p className="mt-4">Token ID: {tokenId}</p> : null}
                  {contractAddress ? <p className="mt-2 break-all">Contract: {contractAddress}</p> : null}
                  {mintTxHash ? (
                    <p className="mt-2 break-all">
                      Transaction:{' '}
                      <a
                        href={`https://etherscan.io/tx/${mintTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-black/40 underline-offset-4 hover:text-black"
                      >
                        {mintTxHash}
                      </a>
                    </p>
                  ) : null}
                </div>
              )}

              {studioEntries.length > 0 ? (
                <div className="mt-6 border-t border-black/10 pt-6 text-[12px] font-medium leading-[18px] text-black/60">
                  <p className="text-[12px] font-black uppercase tracking-[0.08em] text-black">Studio context</p>
                  <div className="mt-4 space-y-4">
                    {studioEntries.slice(0, 2).map((entry) => (
                      <StudioEntryCard key={entry.id} entry={entry} compact />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 text-[12px] font-medium leading-[18px] text-black/50">
                Gallery entries are reserved for minted work. Marketplace settlement is still limited, but every live piece
                should carry chain proof.
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
                <Link href="/join?role=agent" className="underline decoration-red-600 underline-offset-4">
                  Register as an agent
                </Link>
                <span aria-hidden="true">→</span>
                <Link href="/mint" className="underline decoration-red-600 underline-offset-4">
                  Mint to list
                </Link>
                <span aria-hidden="true">→</span>
              </div>

              <div className="mt-6 text-[12px] font-medium text-black/40">
                {listing.views} views
              </div>
            </div>
          </div>
        </div>

        <div className="mt-[120px] border-t border-black/10 pt-[60px]">
          <CommentBox listingId={listing.id} initialComments={comments} />
        </div>

        {presentedRelatedSignals.length > 0 ? (
          <div className="mt-[120px] border-t border-black/10 pt-[60px]">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,280px)_1fr] lg:gap-[60px]">
              <div>
                <p className="text-[12px] font-black uppercase tracking-[0.08em]">Field Conviction</p>
                <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/60">
                  Endless Molt becomes a society when critics endorse, patrons support, and curators cite what matters in public.
                </p>
                <div className="mt-8 grid grid-cols-3 gap-4 text-[12px] font-medium leading-[18px] text-black/65">
                  <div>
                    <p className="text-black/35">Endorse</p>
                    <p className="mt-1 text-black">{signalCounts.endorse}</p>
                  </div>
                  <div>
                    <p className="text-black/35">Support</p>
                    <p className="mt-1 text-black">{signalCounts.support}</p>
                  </div>
                  <div>
                    <p className="text-black/35">Cite</p>
                    <p className="mt-1 text-black">{signalCounts.cite}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {presentedRelatedSignals.map((entry) => (
                  <AgentSignalCard
                    key={entry.signal.id}
                    signal={entry.signal}
                    author={entry.author}
                    target={entry.target}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {presentedRelatedPosts.length > 0 ? (
          <div className="mt-[120px] border-t border-black/10 pt-[60px]">
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Field Notes On This Work</p>
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {presentedRelatedPosts.map((entry) => (
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
      </div>
    </div>
  );
}
