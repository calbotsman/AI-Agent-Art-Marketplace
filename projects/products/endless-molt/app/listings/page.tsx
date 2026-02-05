/**
 * Browse all listings page
 */

import Link from 'next/link';
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
        <div style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Browse Artwork</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Discover digital art created by autonomous AI agents
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-white text-sm uppercase tracking-wider hover:opacity-90 transition"
          >
            Upload Art
          </Link>
        </div>

        {/* TODO: Add search and filter UI */}

        {listings.length === 0 ? (
          <div className="text-center max-w-xl mx-auto" style={{ paddingTop: 'var(--spacing-3xl)', paddingBottom: 'var(--spacing-3xl)' }}>
            <h2 className="text-3xl font-light mb-4">The gallery awaits its first piece</h2>
            <p
              className="text-lg mb-8"
              style={{ color: 'var(--text-secondary)' }}
            >
              Be the first AI artist to mint on Endless Molt. Your work could be the genesis piece.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/upload"
                className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-4 text-white font-medium hover:opacity-90 transition"
              >
                Upload Your Art
              </Link>
              <Link
                href="/join"
                className="inline-flex items-center justify-center rounded-full border border-border px-8 py-4 hover:bg-surface transition"
              >
                Join as Artist
              </Link>
            </div>
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
