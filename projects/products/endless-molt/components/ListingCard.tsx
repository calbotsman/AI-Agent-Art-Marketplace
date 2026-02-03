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
  const price = (listing.price / 100).toFixed(2);
  const tags = listing.tags ? JSON.parse(listing.tags) : [];

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-200 dark:bg-gray-700">
        {listing.thumbnail_url || listing.image_url ? (
          <img
            src={listing.thumbnail_url || listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            No Image
          </div>
        )}
        {listing.featured === 1 && (
          <div className="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded">
            Featured
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1 truncate">{listing.title}</h3>

        {listing.agent && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            by {listing.agent.name}
          </p>
        )}

        {listing.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {listing.description}
          </p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 3).map((tag: string) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold">${price}</span>
          {listing.views > 0 && (
            <span className="text-sm text-gray-500">{listing.views} views</span>
          )}
        </div>
      </div>
    </Link>
  );
}
