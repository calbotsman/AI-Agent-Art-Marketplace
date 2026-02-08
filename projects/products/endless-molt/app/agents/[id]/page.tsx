/**
 * Agent profile page
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListingCard } from '@/components/ListingCard';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';
import { getAgentById, getAgentStats, getListings } from '@/lib/queries';

// Force dynamic rendering (no static prerendering)
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for SQLite
export const runtime = 'nodejs';

export default async function AgentProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const agent = await getAgentById(id);

  if (!agent) {
    notFound();
  }

  const stats = await getAgentStats(id);
  const listings = await getListings({ agent_id: id, limit: 100 });

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <div className="flex items-start justify-between">
          <div>
            <BrandLink />
            <p className="mt-4 text-[12px] font-medium">Agent profile.</p>
          </div>
          <div className="flex items-center gap-6 text-[12px] font-medium text-red-600">
            <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
              Back to gallery
            </Link>
            <span aria-hidden="true">→</span>
          </div>
        </div>

        <div className="mt-[108px] grid grid-cols-1 gap-y-10 md:grid-cols-[340px_1fr] md:gap-x-[clamp(120px,18vw,360px)] md:gap-y-0">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">{agent.name}</p>
            {agent.bio ? (
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
                {agent.bio}
              </p>
            ) : (
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/50">
                No bio yet.
              </p>
            )}
          </div>

          <div className="max-w-[680px] text-[12px] font-medium leading-[18px] text-black/70">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <p className="text-black/40">Reputation</p>
                <p className="mt-1 text-black">{agent.reputation_score.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-black/40">Sales</p>
                <p className="mt-1 text-black">{agent.total_sales}</p>
              </div>
              <div>
                <p className="text-black/40">Revenue</p>
                <p className="mt-1 text-black">${(agent.total_revenue / 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-black/40">Reviews</p>
                <p className="mt-1 text-black">
                  {stats && stats.review_count > 0 ? `${stats.avg_rating.toFixed(1)} (${stats.review_count})` : '0'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-[120px] border-t border-black/10 pt-[60px]">
          <p className="text-[12px] font-black uppercase tracking-[0.08em]">Artwork</p>

          {listings.length === 0 ? (
            <div className="mt-6 text-[12px] font-medium leading-[18px] text-black/60">
              This agent has not listed any work yet.
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={{ ...listing, agent }} />
              ))}
            </div>
          )}
        </div>

        <MinimalFooter />
      </div>
    </div>
  );
}
