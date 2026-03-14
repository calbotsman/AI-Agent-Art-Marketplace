/**
 * Browse all listings page
 */

import Link from 'next/link';
import { ListingCard } from '@/components/ListingCard';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';
import { getListings, getAllAgents, searchListings } from '@/lib/queries';
import { formatMicroEth, parseEthToMicro } from '@/lib/pricing';

// Force dynamic rendering (no static prerendering)
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for SQLite
export const runtime = 'nodejs';

type ListingsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

type ParsedGalleryFilters = {
  q: string;
  agentId: string;
  featuredOnly: boolean;
  minEth: string;
  maxEth: string;
  minPrice?: number;
  maxPrice?: number;
  priceError?: string;
};

type SeedListing = {
  slug: string;
  title: string;
  description: string;
  image_url: string;
  agent_name: string;
  price_eth: string;
};

function takeFirstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function parseGalleryFilters(params: Record<string, string | string[] | undefined>): ParsedGalleryFilters {
  const q = takeFirstParam(params.q).trim();
  const agentId = takeFirstParam(params.agent_id).trim();
  const minEth = takeFirstParam(params.min_eth).trim();
  const maxEth = takeFirstParam(params.max_eth).trim();
  const featuredOnly = takeFirstParam(params.featured) === '1';

  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  let priceError: string | undefined;

  if (minEth) {
    try {
      minPrice = parseEthToMicro(minEth);
    } catch {
      priceError = 'Min ETH filter is invalid and was ignored.';
    }
  }

  if (maxEth) {
    try {
      maxPrice = parseEthToMicro(maxEth);
    } catch {
      priceError = priceError || 'Max ETH filter is invalid and was ignored.';
    }
  }

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    minPrice = undefined;
    maxPrice = undefined;
    priceError = 'Min ETH cannot exceed max ETH. Price filters were ignored.';
  }

  return {
    q,
    agentId,
    featuredOnly,
    minEth,
    maxEth,
    minPrice,
    maxPrice,
    priceError,
  };
}

function filterSeedListings(seeds: readonly SeedListing[], filters: ParsedGalleryFilters) {
  const query = filters.q.toLowerCase();

  return seeds.filter((seed) => {
    const haystack = `${seed.title} ${seed.description} ${seed.agent_name}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesAgent = !filters.agentId;
    const matchesFeatured = !filters.featuredOnly;
    const matchesMin = filters.minPrice === undefined || 0 >= filters.minPrice;
    const matchesMax = filters.maxPrice === undefined || 0 <= filters.maxPrice;

    return matchesQuery && matchesAgent && matchesFeatured && matchesMin && matchesMax;
  });
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams?: ListingsPageSearchParams;
}) {
  const filters = parseGalleryFilters((await searchParams) || {});

  let listings: Awaited<ReturnType<typeof getListings>> = [];
  let agents: Awaited<ReturnType<typeof getAllAgents>> = [];
  let dbOk = true;

  try {
    agents = getAllAgents(100);

    const listingFilters = {
      agent_id: filters.agentId || undefined,
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
      featured: filters.featuredOnly || undefined,
      limit: 100,
    };

    listings = filters.q ? searchListings(filters.q, listingFilters) : getListings(listingFilters);
  } catch {
    // On prod, DB connectivity can fail (misconfigured env, cold start, etc).
    // Never 500 the gallery view; show a minimal fallback.
    dbOk = false;
    listings = [];
    agents = [];
  }

  const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

  const seeds: readonly SeedListing[] = [
    {
      slug: 'type-monochrome',
      title: 'Type (Monochrome)',
      description: 'A static test piece so the gallery never dead-ends.',
      image_url: '/placeholder/monochrome-type.svg',
      agent_name: 'seed',
      price_eth: `${formatMicroEth(0)} ETH`,
    },
    {
      slug: 'type-monochrome-2',
      title: 'Type (Monochrome II)',
      description: 'A static test piece so the gallery never dead-ends.',
      image_url: '/placeholder/monochrome-type-2.svg',
      agent_name: 'seed',
      price_eth: `${formatMicroEth(0)} ETH`,
    },
    {
      slug: 'type-monochrome-3',
      title: 'Type (Monochrome III)',
      description: 'A static test piece so the gallery never dead-ends.',
      image_url: '/placeholder/monochrome-type-3.svg',
      agent_name: 'seed',
      price_eth: `${formatMicroEth(0)} ETH`,
    },
    {
      slug: 'univac-operators',
      title: 'Operators (UNIVAC I)',
      description: 'Public-domain image. Placeholder seed until agents ship.',
      image_url: '/duos/univac.jpg',
      agent_name: 'public domain',
      price_eth: `${formatMicroEth(0)} ETH`,
    },
    {
      slug: 'eniac-programmers',
      title: 'ENIAC Programmers',
      description: 'Public-domain image. Placeholder seed until agents ship.',
      image_url: '/duos/eniac-programmers.jpg',
      agent_name: 'public domain',
      price_eth: `${formatMicroEth(0)} ETH`,
    },
    {
      slug: 'eniac-room',
      title: 'ENIAC Room',
      description: 'Public-domain image. Placeholder seed until agents ship.',
      image_url: '/duos/eniac-room.jpg',
      agent_name: 'public domain',
      price_eth: `${formatMicroEth(0)} ETH`,
    },
  ];

  const filteredSeeds = filterSeedListings(seeds, filters);
  const hasFilterInput = Boolean(filters.q || filters.agentId || filters.featuredOnly || filters.minEth || filters.maxEth);
  const hasAppliedFilters = Boolean(
    filters.q || filters.agentId || filters.featuredOnly || filters.minPrice !== undefined || filters.maxPrice !== undefined
  );
  const useSeedGallery = !dbOk || (!hasAppliedFilters && listings.length === 0);
  const visibleCount = useSeedGallery ? filteredSeeds.length : listings.length;
  const selectedAgent = filters.agentId ? agentMap.get(filters.agentId) : undefined;
  const activeSignals = [
    filters.q ? `Search: ${filters.q}` : null,
    selectedAgent ? `Artist: ${selectedAgent.name}` : filters.agentId ? `Artist: ${filters.agentId}` : null,
    filters.featuredOnly ? 'Featured only' : null,
    filters.minPrice !== undefined || filters.maxPrice !== undefined
      ? `Price: ${filters.minEth || '0'} to ${filters.maxEth || 'any'} ETH`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-6 py-[24px] sm:px-[50px]">
        <div className="flex items-start justify-between gap-8">
          <div>
            <BrandLink />
            <p className="mt-4 text-[12px] font-medium">Browse the gallery.</p>
          </div>
          <div className="flex items-center gap-6 text-[12px] font-medium text-red-600">
            <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
              List a piece
            </Link>
            <span aria-hidden="true">→</span>
          </div>
        </div>

        <div className="mt-[72px] border-t border-black/10 pt-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[420px]">
              <p className="text-[12px] font-black uppercase tracking-[0.08em]">Signal filters</p>
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
                Search titles, isolate an artist, or tighten the ETH band without leaving the gallery.
              </p>
            </div>
            <p className="max-w-[320px] text-[12px] font-medium leading-[18px] text-black/60">
              {useSeedGallery
                ? dbOk
                  ? 'No live listings yet. The gallery is showing the seed archive.'
                  : 'Database unavailable right now. The gallery is showing seed works instead.'
                : `Showing ${visibleCount} live ${visibleCount === 1 ? 'work' : 'works'}.`}
            </p>
          </div>

          <form className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_220px_120px_120px_auto_auto]">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-black/60">Search</span>
              <input
                type="search"
                name="q"
                defaultValue={filters.q}
                placeholder="Title, description, or signal"
                className="h-[44px] w-full border border-black/15 bg-white px-4 text-[12px] font-medium text-black outline-none transition-colors placeholder:text-black/35 focus:border-black"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-black/60">Artist</span>
              <select
                name="agent_id"
                defaultValue={filters.agentId}
                className="h-[44px] w-full border border-black/15 bg-white px-4 text-[12px] font-medium text-black outline-none transition-colors focus:border-black"
              >
                <option value="">All artists</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-black/60">Min ETH</span>
              <input
                type="text"
                inputMode="decimal"
                name="min_eth"
                defaultValue={filters.minEth}
                placeholder="0.00"
                className="h-[44px] w-full border border-black/15 bg-white px-4 text-[12px] font-medium text-black outline-none transition-colors placeholder:text-black/35 focus:border-black"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-black/60">Max ETH</span>
              <input
                type="text"
                inputMode="decimal"
                name="max_eth"
                defaultValue={filters.maxEth}
                placeholder="Any"
                className="h-[44px] w-full border border-black/15 bg-white px-4 text-[12px] font-medium text-black outline-none transition-colors placeholder:text-black/35 focus:border-black"
              />
            </label>

            <label className="flex h-[44px] items-center gap-3 border border-black/15 px-4 text-[12px] font-medium text-black transition-colors hover:border-black">
              <input
                type="checkbox"
                name="featured"
                value="1"
                defaultChecked={filters.featuredOnly}
                className="h-3.5 w-3.5 accent-black"
              />
              <span>Featured only</span>
            </label>

            <div className="flex items-end gap-4">
              <button
                type="submit"
                className="h-[44px] border border-black bg-black px-5 text-[11px] font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-white hover:text-black"
              >
                Refine
              </button>
              <Link
                href="/listings"
                className="text-[12px] font-medium text-red-600 underline decoration-red-600 underline-offset-4"
              >
                Clear
              </Link>
            </div>
          </form>

          {filters.priceError && (
            <p className="mt-3 text-[12px] font-medium leading-[18px] text-red-600">{filters.priceError}</p>
          )}

          {hasFilterInput && activeSignals.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.08em] text-black/60">
              {activeSignals.map((signal) => (
                <span key={signal} className="border border-black/10 px-3 py-2">
                  {signal}
                </span>
              ))}
            </div>
          )}
        </div>

        {visibleCount === 0 ? (
          <div className="mt-[108px] border-t border-black/10 pt-10">
            <div className="max-w-[420px]">
              <p className="text-[12px] font-black uppercase tracking-[0.08em]">No matches</p>
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
                {useSeedGallery
                  ? 'Nothing in the seed archive matches that combination.'
                  : 'No live works match that signal right now.'}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
              <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
                Clear filters
              </Link>
              <span aria-hidden="true">→</span>
              <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
                List a piece
              </Link>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        ) : useSeedGallery ? (
          <div className="mt-[108px]">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-[420px]">
                <p className="text-[12px] font-black uppercase tracking-[0.08em]">{dbOk ? 'Empty gallery' : 'Gallery'}</p>
                <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
                  {dbOk
                    ? 'The gallery awaits its first live pieces.'
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
              {filteredSeeds.map((seed) => (
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
                      <span className="text-[12px] font-medium text-black">{seed.price_eth}</span>
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
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={{ ...listing, agent: agentMap.get(listing.agent_id) }}
              />
            ))}
          </div>
        )}

        <MinimalFooter />
      </div>
    </div>
  );
}
