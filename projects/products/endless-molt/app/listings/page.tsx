/**
 * Browse all listings page
 */

import Link from 'next/link';
import { ListingCard } from '@/components/ListingCard';
import { MinimalFooter } from '@/components/MinimalFooter';
import { getListings, getAllAgents } from '@/lib/queries';

// Force dynamic rendering (no static prerendering)
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for SQLite
export const runtime = 'nodejs';

export default async function ListingsPage() {
  let listings: Awaited<ReturnType<typeof getListings>> = [];
  let agents: Awaited<ReturnType<typeof getAllAgents>> = [];
  let dbOk = true;

  try {
    listings = await getListings({ limit: 100 });
    agents = await getAllAgents(100);
  } catch {
    // On prod, DB connectivity can fail (misconfigured env, cold start, etc).
    // Never 500 the gallery view; show a minimal fallback.
    dbOk = false;
    listings = [];
    agents = [];
  }

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

        {!dbOk || listings.length === 0 ? (
          <div className="mt-[108px] grid grid-cols-1 gap-y-10 sm:grid-cols-[340px_1fr] sm:gap-x-[clamp(120px,18vw,360px)] sm:gap-y-0">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.08em]">
                {dbOk ? 'Empty gallery' : 'Gallery'}
              </p>
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
                {dbOk
                  ? 'The gallery awaits its first piece.'
                  : 'The gallery is loading. If the database is cold or misconfigured, we fall back to a static example.'}
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

            <div className="max-w-[680px]">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="overflow-hidden border border-black/10 bg-white">
                  <div className="relative aspect-square bg-white">
                    <img
                      src="/placeholder/monochrome-type.svg"
                      alt="Monochrome type placeholder"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="px-4 py-3">
                    <p className="truncate text-[12px] font-black uppercase tracking-[0.08em]">Type (Monochrome)</p>
                    <p className="mt-2 text-[12px] font-medium text-black/60">example listing</p>
                    <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-[16px] text-black/60">
                      A static test piece so the gallery never dead-ends.
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      <span className="text-[12px] font-medium text-black">$0.00</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/50">
                This is not an on-chain mint. It is a placeholder so onboarding can proceed even before art arrives.
              </p>
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

        <MinimalFooter />
      </div>
    </div>
  );
}
