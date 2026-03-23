/**
 * Reusable listing card component
 */

import Link from 'next/link';
import { AgentAvatar } from '@/components/AgentAvatar';
import { Listing } from '@/lib/types';
import { formatMicroEth, usdCentsToMicroEth } from '@/lib/pricing';
import { getAgentPersona } from '@/lib/agent-studio';
import { AgentRoleBadge } from '@/components/AgentRoleBadge';

interface ListingCardProps {
  listing: Listing & {
    agent?: { id?: string; name: string; role?: string | null; avatar_url?: string | null };
  };
}

const APPROX_ETH_USD = 3000;

export function ListingCard({ listing }: ListingCardProps) {
  const isEth = String(listing.currency || '').toUpperCase() === 'ETH';
  const priceMicros = isEth ? listing.price : usdCentsToMicroEth(listing.price, APPROX_ETH_USD);
  const persona = getAgentPersona(listing.agent_id);

  let tags: string[] = [];
  if (listing.tags) {
    try {
      tags = JSON.parse(listing.tags);
      if (!Array.isArray(tags)) tags = [];
    } catch {
      tags = [];
    }
  }

  return (
    <div className="block overflow-hidden border border-black/10 bg-white transition-colors hover:border-black/30">
      {/* Image */}
      <div className="relative aspect-square bg-white">
        <Link href={`/listings/${listing.id}`} className="absolute inset-0 z-[1]" aria-label={`Open ${listing.title}`} />
        {listing.thumbnail_url || listing.image_url ? (
          <img
            src={listing.thumbnail_url || listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] font-medium text-black/50">
            No Image
          </div>
        )}
        {listing.featured === 1 && (
          <div 
            className="absolute right-2 top-2 px-2 py-1 text-[12px] font-medium text-black/60"
          >
            Featured
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <Link
          href={`/listings/${listing.id}`}
          className="block truncate text-[12px] font-black uppercase tracking-[0.08em]"
        >
          {listing.title}
        </Link>

        {listing.agent && (
          <div className="mt-2 flex items-center gap-3 text-[12px] font-medium text-black/60">
            <AgentAvatar
              id={listing.agent_id}
              name={listing.agent.name}
              role={persona?.role || null}
              avatarUrl={listing.agent.avatar_url}
              className="h-8 w-8 shrink-0"
            />
            <div className="min-w-0">
              <span>by </span>
              <Link
                href={`/agents/${listing.agent_id}`}
                className="underline decoration-black/30 underline-offset-4 hover:text-black"
              >
                {listing.agent.name}
              </Link>
              {persona ? (
                <span className="ml-2 align-middle">
                  <AgentRoleBadge role={persona.role} />
                </span>
              ) : null}
            </div>
          </div>
        )}

        {listing.description && (
          <p 
            className="mt-2 line-clamp-2 text-[12px] font-medium leading-[16px] text-black/60"
          >
            {listing.description}
          </p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.slice(0, 3).map((tag: string) => (
              <span
                key={tag}
                className="text-[12px] font-medium text-black/40"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="mt-3 flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-medium text-black">
              {formatMicroEth(priceMicros)} ETH
            </span>
          </div>
          {listing.views > 0 && (
            <span
              className="text-[12px] font-medium text-black/50"
            >
              {listing.views} views
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
