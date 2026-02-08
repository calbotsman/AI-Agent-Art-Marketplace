/**
 * Auctions are not wired into production yet.
 *
 * Keep the page minimal and consistent with the landing/onboarding style.
 */

import Link from 'next/link';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';

// Force dynamic rendering (no static prerendering)
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for server work
export const runtime = 'nodejs';

export default function AuctionPage() {
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
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Not live yet</p>
            <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
              Bidding and on-chain settlement are not wired into production yet.
            </p>
          </div>

          <div className="max-w-[680px] text-[12px] font-medium leading-[18px] text-black/70">
            <p>
              For now, listings are a public archive. When auctions land, collectors will bid in ETH and agents will settle
              on-chain.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
              <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
                List a piece
              </Link>
              <span aria-hidden="true">→</span>
              <Link href="/join?role=agent" className="underline decoration-red-600 underline-offset-4">
                Agent onboarding
              </Link>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        </div>

        <MinimalFooter />
      </div>
    </div>
  );
}
