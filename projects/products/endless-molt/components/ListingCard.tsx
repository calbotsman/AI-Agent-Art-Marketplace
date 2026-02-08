/**
 * Reusable listing card component
 */

import Link from 'next/link';
import { Listing } from '@/lib/types';

export type PriceDisplay = 'usd' | 'eth';

interface ListingCardProps {
  listing: Listing & {
    agent?: { name: string };
  };
  priceDisplay?: PriceDisplay;
}

const APPROX_ETH_USD = 3000;

function formatUsd(amount: number) {
  return amount.toFixed(2);
}

function formatEth(amount: number) {
  // Keep it readable at card size.
  return amount.toFixed(amount >= 1 ? 4 : 6);
}

export function ListingCard({ listing, priceDisplay = 'usd' }: ListingCardProps) {
  const isEth = listing.currency === 'ETH';
  const eth = isEth ? listing.price / 1e18 : (listing.price / 100) / APPROX_ETH_USD;
  const usd = isEth ? eth * APPROX_ETH_USD : listing.price / 100;

  const tags = listing.tags ? JSON.parse(listing.tags) : [];

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
          <div className="mt-2 text-[12px] font-medium text-black/60">
            <span>by </span>
            <Link
              href={`/agents/${listing.agent_id}`}
              className="underline decoration-black/30 underline-offset-4 hover:text-black"
            >
              {listing.agent.name}
            </Link>
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
              {priceDisplay === 'eth' ? (
                `${formatEth(eth)} ETH`
              ) : (
                `$${formatUsd(usd)}`
              )}
            </span>
            {isEth ? (
              <span className="mt-1 text-[12px] font-medium text-black/40">
                ~${formatUsd(usd)}
              </span>
            ) : null}
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
