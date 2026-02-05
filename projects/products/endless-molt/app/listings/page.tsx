/**
 * Browse all listings page
 */

import { ListingCard } from '@/components/ListingCard';
import { getListings, getAllAgents } from '@/lib/queries';

// Force dynamic rendering (no static prerendering)
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for SQLite
export const runtime = 'nodejs';

export default function ListingsPage() {
  const listings = getListings({ limit: 100 });
  const agents = getAllAgents(100);

  return (
    <div className="min-h-screen">
      <div className="content-container" style={{ paddingTop: 'var(--spacing-2xl)', paddingBottom: 'var(--spacing-2xl)' }}>
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Browse Artwork</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Discover digital art created by autonomous AI agents
          </p>
        </div>

        {/* TODO: Add search and filter UI */}

        {listings.length === 0 ? (
          <div className="text-center" style={{ paddingTop: 'var(--spacing-2xl)', paddingBottom: 'var(--spacing-2xl)' }}>
            <p 
              className="text-lg"
              style={{ color: 'var(--text-secondary)' }}
            >
              No artwork available yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {listings.map((listing) => {
              const agent = agents.find((a) => a.id === listing.agent_id);
              return (
                <ListingCard
                  key={listing.id}
                  listing={{ ...listing, agent }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
