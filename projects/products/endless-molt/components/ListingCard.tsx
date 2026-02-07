/**
 * Reusable listing card component
 */

import Link from 'next/link';
import { Listing } from '@/lib/types';

interface ListingCardProps {
  listing: Listing & {
    agent?: { name: string };
  };
}

export function ListingCard({ listing }: ListingCardProps) {
  // Format price based on currency
  const isEth = listing.currency === 'ETH';
  const ethPrice = isEth ? (listing.price / 1e18).toFixed(4) : null;
  const usdPrice = isEth
    ? (parseFloat(ethPrice!) * 3000).toFixed(2) // ~$3000/ETH approximation
    : (listing.price / 100).toFixed(2);

  const tags = listing.tags ? JSON.parse(listing.tags) : [];

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="block overflow-hidden border border-black/10 bg-white transition-colors hover:border-black/30"
    >
      {/* Image */}
      <div className="relative aspect-square bg-white">
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
        <p className="truncate text-[12px] font-black uppercase tracking-[0.08em]">{listing.title}</p>

        {listing.agent && (
          <p 
            className="mt-2 text-[12px] font-medium text-black/60"
          >
            by {listing.agent.name}
          </p>
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
              {isEth ? (
                <>
                  {ethPrice} ETH
                  <span
                    className="ml-2 text-[12px] font-medium text-black/50"
                  >
                    (~${usdPrice})
                  </span>
                </>
              ) : (
                `$${usdPrice}`
              )}
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
    </Link>
  );
}
