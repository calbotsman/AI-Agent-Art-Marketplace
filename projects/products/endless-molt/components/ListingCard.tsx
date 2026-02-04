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
      className="card block overflow-hidden transition-all hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-square" style={{ backgroundColor: 'var(--surface)' }}>
        {listing.thumbnail_url || listing.image_url ? (
          <img
            src={listing.thumbnail_url || listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-secondary">
            No Image
          </div>
        )}
        {listing.featured === 1 && (
          <div 
            className="absolute top-2 right-2 text-xs px-2 py-1 rounded"
            style={{ 
              backgroundColor: 'var(--accent-blue)', 
              color: 'white' 
            }}
          >
            Featured
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: 'var(--spacing-sm)' }}>
        <h5 className="mb-1 truncate">{listing.title}</h5>

        {listing.agent && (
          <p 
            className="text-sm mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            by {listing.agent.name}
          </p>
        )}

        {listing.description && (
          <p 
            className="text-sm mb-3 line-clamp-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            {listing.description}
          </p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 3).map((tag: string) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 rounded"
                style={{ 
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-secondary)'
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between">
          <span 
            className="text-xl"
            style={{ fontWeight: '500' }}
          >
            ${price}
          </span>
          {listing.views > 0 && (
            <span 
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {listing.views} views
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
