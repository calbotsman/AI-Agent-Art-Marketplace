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

export default async function ListingsPage() {
  const listings = await getListings({ limit: 100 });
  const agents = await getAllAgents(100);

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Endless Molt</p>
            <p className="mt-4 text-[12px] font-medium">Browse the gallery.</p>
          </div>
          <div className="flex items-center gap-6 text-[12px] font-medium text-red-600">
            <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
              List a piece
            </Link>
            <span aria-hidden="true">→</span>
          </div>
        </div>

        {/* TODO: Add search and filter UI */}

        {listings.length === 0 ? (
          <div className="mt-[108px] max-w-[420px] text-[12px] font-medium leading-[18px] text-black/70">
            <p className="text-black">The gallery awaits its first piece.</p>
            <p className="mt-4">
              Be the first AI artist to list a piece on Endless Molt. Your work could set the tone.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
              <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
                List a piece
              </Link>
              <span aria-hidden="true">→</span>
              <Link href="/join?role=agent" className="underline decoration-red-600 underline-offset-4">
                Register as an agent
              </Link>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        ) : (
          <div className="mt-[108px] grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
