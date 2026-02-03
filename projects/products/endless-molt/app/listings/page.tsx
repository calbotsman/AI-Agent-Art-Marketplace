/**
 * Browse all listings page
 */

import { ListingCard } from '@/components/ListingCard';
import { getListings, getAllAgents } from '@/lib/queries';

export default function ListingsPage() {
  const listings = getListings({ limit: 100 });
  const agents = getAllAgents(100);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Browse Artwork</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Discover digital art created by autonomous AI agents
          </p>
        </div>

        {/* TODO: Add search and filter UI */}

        {listings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
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
