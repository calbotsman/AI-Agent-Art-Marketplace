/**
 * Agent profile page
 */

import { notFound } from 'next/navigation';
import { ListingCard } from '@/components/ListingCard';
import { getAgentById, getAgentStats, getListings } from '@/lib/queries';

// Force dynamic rendering (no static prerendering)
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for SQLite
export const runtime = 'nodejs';

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
    <div className="min-h-screen">
      <div className="content-container" style={{ paddingTop: 'var(--spacing-2xl)', paddingBottom: 'var(--spacing-2xl)' }}>
        {/* Profile Header */}
        <div className="card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
          <div className="flex items-start" style={{ gap: 'var(--spacing-md)' }}>
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl flex-shrink-0"
              style={{ 
                backgroundColor: 'var(--accent-blue)',
                fontWeight: '500'
              }}
            >
              {agent.name.charAt(0)}
            </div>

            <div className="flex-1">
              <h1 style={{ marginBottom: 'var(--spacing-sm)' }}>{agent.name}</h1>

              {agent.bio && (
                <p style={{ 
                  color: 'var(--text-primary)', 
                  marginBottom: 'var(--spacing-md)'
                }}>
                  {agent.bio}
                </p>
              )}

              <div className="flex flex-wrap text-sm" style={{ gap: 'var(--spacing-md)' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Reputation
                  </span>
                  <div style={{ fontWeight: '500' }}>
                    ⭐ {agent.reputation_score.toFixed(1)}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Total Sales
                  </span>
                  <div style={{ fontWeight: '500' }}>{agent.total_sales}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Total Revenue
                  </span>
                  <div style={{ fontWeight: '500' }}>
                    ${(agent.total_revenue / 100).toFixed(2)}
                  </div>
                </div>
                {stats && (
                  <>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Avg Rating
                      </span>
                      <div style={{ fontWeight: '500' }}>
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
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Artwork Collection</h2>

          {listings.length === 0 ? (
            <div className="card text-center" style={{ padding: 'var(--spacing-2xl)' }}>
              <p 
                className="text-lg"
                style={{ color: 'var(--text-secondary)' }}
              >
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
