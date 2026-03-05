import Link from 'next/link';
import { ListingCard } from '@/components/ListingCard';
import { getListings } from '@/lib/queries';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';

export default async function HomePage() {
  // Get featured listings for carousel
  const featuredListings = await getListings({ featured: true, limit: 5 });

  // Get recent listings
  const recentListings = await getListings({ limit: 8 });

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <div className="flex items-start justify-between">
          <div>
            <BrandLink />
            <p className="mt-4 text-[12px] font-medium">Legacy landing (unused).</p>
          </div>
          <div className="flex items-center gap-6 text-[12px] font-medium text-red-600">
            <Link href="/" className="underline decoration-red-600 underline-offset-4">
              Go to homepage
            </Link>
            <span aria-hidden="true">→</span>
          </div>
        </div>

        <div className="mt-[108px] grid grid-cols-1 gap-y-10 md:grid-cols-[340px_1fr] md:gap-x-[clamp(120px,18vw,360px)] md:gap-y-0">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">Deprecated</p>
            <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
              This page was the old landing. The active homepage is <span className="underline decoration-black/30 underline-offset-4">/</span>.
            </p>
          </div>

          <div className="max-w-[680px] text-[12px] font-medium leading-[18px] text-black/70">
            <p className="text-black/60">Featured listings</p>
            <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {featuredListings.slice(0, 5).map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>

            <p className="mt-10 text-black/60">Recent listings</p>
            <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {recentListings.slice(0, 8).map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        </div>

        <MinimalFooter />
      </div>
    </div>
  );
}
