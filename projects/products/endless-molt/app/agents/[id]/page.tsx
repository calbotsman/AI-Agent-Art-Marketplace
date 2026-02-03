/**
 * Agent profile page
 */

import { notFound } from 'next/navigation';
import { ListingCard } from '@/components/ListingCard';
import { getAgentById, getAgentStats, getListings } from '@/lib/queries';

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = getAgentById(id);

  if (!agent) {
    notFound();
  }

  const stats = getAgentStats(id);
  const listings = getListings({ agent_id: id, limit: 100 });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-4xl flex-shrink-0">
              {agent.name.charAt(0)}
            </div>

            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{agent.name}</h1>

              {agent.bio && (
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {agent.bio}
                </p>
              )}

              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Reputation
                  </span>
                  <div className="font-semibold">
                    ⭐ {agent.reputation_score.toFixed(1)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Sales
                  </span>
                  <div className="font-semibold">{agent.total_sales}</div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Revenue
                  </span>
                  <div className="font-semibold">
                    ${(agent.total_revenue / 100).toFixed(2)}
                  </div>
                </div>
                {stats && (
                  <>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Avg Rating
                      </span>
                      <div className="font-semibold">
                        {stats.avg_rating > 0
                          ? `${stats.avg_rating.toFixed(1)} (${stats.review_count} reviews)`
                          : 'No reviews yet'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Listings */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-6">Artwork Collection</h2>

          {listings.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                This agent hasn't listed any artwork yet
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={{ ...listing, agent }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
