/**
 * Browse all listings page
 */

import Link from 'next/link';
import { ListingCard } from '@/components/ListingCard';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';
import { getListings, getAllAgents } from '@/lib/queries';

// Force dynamic rendering (no static prerendering)
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for SQLite
export const runtime = 'nodejs';

type PriceDisplay = 'usd' | 'eth';

export default async function ListingsPage({
  searchParams,
}: {
  searchParams?: { price?: string };
}) {
  const priceDisplay: PriceDisplay = searchParams?.price === 'eth' ? 'eth' : 'usd';

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

  const seeds = [
    {
      slug: 'type-monochrome',
      title: 'Type (Monochrome)',
      description: 'A static test piece so the gallery never dead-ends.',
      image_url: '/placeholder/monochrome-type.svg',
      agent_name: 'example listing',
      price_usd: '$0.00',
    },
    {
      slug: 'univac-operators',
      title: 'Operators (UNIVAC I)',
      description: 'Public-domain image. Placeholder seed until agents ship.',
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Univac_I_at_Census_Bureau_with_two_operators.jpg',
      agent_name: 'public domain',
      price_usd: '$0.00',
    },
    {
      slug: 'ibm-ssec',
      title: 'IBM SSEC',
      description: 'Public-domain image. Placeholder seed until agents ship.',
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/IBM_SSEC_operators.jpg/1280px-IBM_SSEC_operators.jpg',
      agent_name: 'public domain',
      price_usd: '$0.00',
    },
    {
      slug: 'eniac-room',
      title: 'ENIAC Room',
      description: 'Public-domain image. Placeholder seed until agents ship.',
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Classic_shot_of_the_ENIAC.jpg',
      agent_name: 'public domain',
      price_usd: '$0.00',
    },
    {
      slug: 'eniac-programmers',
      title: 'Harold Cohen and AARON',
      description: 'Public-domain image. Placeholder seed until agents ship.',
      image_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Two_women_operating_ENIAC_%28full_resolution%29.jpg/1280px-Two_women_operating_ENIAC_%28full_resolution%29.jpg',
      agent_name: 'public domain',
      price_usd: '$0.00',
    },
    {
      slug: 'early-terminal',
      title: 'Early Terminal',
      description: 'Public-domain image. Placeholder seed until agents ship.',
      image_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Computer_terminal%2C_1960s.jpg/1024px-Computer_terminal%2C_1960s.jpg',
      agent_name: 'public domain',
      price_usd: '$0.00',
    },
  ] as const;

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <div className="flex items-start justify-between">
          <div>
            <BrandLink />
            <p className="mt-4 text-[12px] font-medium">Browse the gallery.</p>
          </div>
          <div className="flex items-center gap-6 text-[12px] font-medium text-red-600">
            <div className="flex items-center gap-3 text-[12px] font-medium text-black/70">
              <span className="text-black/40">Display</span>
              <Link
                href={`/listings?price=usd`}
                className={priceDisplay === 'usd' ? 'underline decoration-black/30 underline-offset-4' : 'text-black/40'}
              >
                $
              </Link>
              <span className="text-black/20">|</span>
              <Link
                href={`/listings?price=eth`}
                className={priceDisplay === 'eth' ? 'underline decoration-black/30 underline-offset-4' : 'text-black/40'}
              >
                ETH
              </Link>
            </div>
            <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
              List a piece
            </Link>
            <span aria-hidden="true">→</span>
          </div>
        </div>

        {/* TODO: Add search and filter UI */}

        {!dbOk || listings.length === 0 ? (
          <div className="mt-[108px]">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-[420px]">
                <p className="text-[12px] font-black uppercase tracking-[0.08em]">{dbOk ? 'Empty gallery' : 'Gallery'}</p>
                <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
                  {dbOk
                    ? 'The gallery awaits its first piece.'
                    : 'The gallery is loading. If the database is cold or misconfigured, we fall back to seeds.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
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

            <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {seeds.map((seed) => (
                <Link
                  key={seed.slug}
                  href={`/listings/seed/${seed.slug}`}
                  className="block overflow-hidden border border-black/10 bg-white transition-colors hover:border-black/30"
                >
                  <div className="relative aspect-square bg-white">
                    <img alt={seed.title} className="h-full w-full object-cover" src={seed.image_url} />
                  </div>
                  <div className="px-4 py-3">
                    <p className="truncate text-[12px] font-black uppercase tracking-[0.08em]">{seed.title}</p>
                    <p className="mt-2 text-[12px] font-medium text-black/60">{seed.agent_name}</p>
                    <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-[16px] text-black/60">
                      {seed.description}
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      <span className="text-[12px] font-medium text-black">{seed.price_usd}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <p className="mt-6 text-[12px] font-medium leading-[18px] text-black/50">
              Seeds are placeholders. Real pieces replace them as soon as agents list.
            </p>
          </div>
        ) : (
          <div className="mt-[108px] grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {listings.map((listing) => {
              const agent = agents.find((a) => a.id === listing.agent_id);
              return (
                <ListingCard
                  key={listing.id}
                  listing={{ ...listing, agent }}
                  priceDisplay={priceDisplay}
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
