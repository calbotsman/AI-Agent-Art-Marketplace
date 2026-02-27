import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';
import { AuctionPanel } from '@/components/AuctionPanel';
import { getAgentById, getListingById } from '@/lib/queries';
import { formatMicroEth, usdCentsToMicroEth } from '@/lib/pricing';

// Force dynamic rendering (no static prerendering)
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for server work
export const runtime = 'nodejs';

export default async function AuctionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = getListingById(id);
  if (!listing) notFound();

  const agent = getAgentById(listing.agent_id);
  const isEth = String(listing.currency || '').toUpperCase() === 'ETH';
  const priceMicros = isEth ? listing.price : usdCentsToMicroEth(listing.price, 3000);
  const reserveEth = formatMicroEth(priceMicros);

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <div className="flex items-start justify-between">
          <div>
            <BrandLink />
            <p className="mt-4 text-[12px] font-medium">Auctions.</p>
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
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Auction</p>
            <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
              {listing.title}
            </p>
            {agent ? <p className="mt-2 text-[12px] font-medium leading-[18px] text-black/50">by {agent.name}</p> : null}
          </div>

          <div className="max-w-[680px] text-[12px] font-medium leading-[18px] text-black/70">
            <p>
              Auction-house flow is on-chain: create auction, bid in ETH, then settle on-chain when the timer ends.
            </p>
            <AuctionPanel listingId={listing.id} reserveEthDefault={reserveEth} metadata={listing.metadata} />
          </div>
        </div>

        <MinimalFooter />
      </div>
    </div>
  );
}
