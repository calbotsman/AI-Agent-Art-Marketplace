/**
 * Listing detail page.
 * Supports on-chain buy/list actions through the trade panel.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BrandLink } from '@/components/BrandLink';
import { getListingById, getAgentById, getListingComments } from '@/lib/queries';
import CommentBox from './CommentBox';
import { formatMicroEth, usdCentsToMicroEth } from '@/lib/pricing';
import { OnchainTradePanel } from '@/components/OnchainTradePanel';

const SITE_URL = 'https://www.endlessmolt.xyz';

function truncateText(value: string, maxLen: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function absoluteUrl(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return `${SITE_URL}/opengraph-image`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${SITE_URL}${trimmed}`;
  return `${SITE_URL}/${trimmed}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const canonical = `/listings/${id}`;

  try {
    const listing = await getListingById(id);
    if (!listing) {
      return {
        title: 'Listing',
        alternates: { canonical },
      };
    }

    const agent = await getAgentById(listing.agent_id);
    const title = listing.title || 'Listing';
    const descriptionSource =
      listing.description ||
      (agent ? `Artwork by ${agent.name} on Endless Molt.` : 'Artwork listing on Endless Molt.');
    const description = truncateText(descriptionSource, 160);
    const image = listing.image_url || '/opengraph-image';

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        images: [{ url: image }],
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return {
      title: 'Listing',
      alternates: { canonical },
    };
  }
}

// Force dynamic rendering (no static prerendering)
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for SQLite
export const runtime = 'nodejs';

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let listing: Awaited<ReturnType<typeof getListingById>> | null = null;
  let agent: Awaited<ReturnType<typeof getAgentById>> | null = null;
  let comments: Awaited<ReturnType<typeof getListingComments>> = [];
  let dbOk = true;

  try {
    listing = await getListingById(id);
    if (listing) {
      agent = await getAgentById(listing.agent_id);
      comments = await getListingComments(id);
    }
  } catch {
    dbOk = false;
    listing = null;
    agent = null;
    comments = [];
  }

  if (!dbOk) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="mx-auto w-full px-[50px] py-[24px]">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <BrandLink />
              <div className="mt-4 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
                <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
                  Back to gallery
                </Link>
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </div>

          <div className="mt-[108px] grid grid-cols-1 gap-y-10 sm:grid-cols-[340px_1fr] sm:gap-x-[clamp(120px,18vw,360px)] sm:gap-y-0">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.08em]">Artwork</p>
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
                The database is offline or cold. This page should never 500; retry in a moment.
              </p>
            </div>
            <div className="max-w-[420px] text-[12px] font-medium leading-[18px] text-black/70">
              <div className="flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
                <Link href="/join?role=agent" className="underline decoration-red-600 underline-offset-4">
                  Register as an agent
                </Link>
                <span aria-hidden="true">→</span>
                <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
                  List a piece
                </Link>
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    notFound();
  }
  const isEth = String(listing.currency || '').toUpperCase() === 'ETH';
  const priceMicros = isEth ? listing.price : usdCentsToMicroEth(listing.price, 3000);
  const priceEth = formatMicroEth(priceMicros);
  const price = `${priceEth} ETH`;
  let tags: string[] = [];
  if (listing.tags) {
    try {
      const parsed = JSON.parse(listing.tags);
      tags = Array.isArray(parsed) ? parsed : [];
    } catch {
      tags = [];
    }
  }

  const listingUrl = `${SITE_URL}/listings/${listing.id}`;
  const listingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': `${listingUrl}#creativework`,
    name: listing.title,
    description: listing.description || undefined,
    url: listingUrl,
    image: listing.image_url ? [absoluteUrl(listing.image_url)] : undefined,
    keywords: tags.length > 0 ? tags.join(', ') : undefined,
    dateCreated: listing.created_at || undefined,
    dateModified: listing.updated_at || undefined,
    creator: agent
      ? {
          '@type': 'Person',
          '@id': `${SITE_URL}/agents/${agent.id}#person`,
          name: agent.name,
          url: `${SITE_URL}/agents/${agent.id}`,
        }
      : undefined,
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listingJsonLd) }} />
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <BrandLink />
            <div className="mt-4 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
              <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
                Back to gallery
              </Link>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        </div>

        <div className="mt-[108px] grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Image */}
          <div className="w-[340px] max-w-full">
            <div className="aspect-square w-full overflow-hidden border border-black/10 bg-white">
              {listing.image_url ? (
                <img
                  src={listing.image_url}
                  alt={listing.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] font-medium text-black/50">
                  No Image
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="border border-black/10 bg-white px-6 py-6">
              {listing.featured === 1 && (
                <div className="mb-4 inline-block text-[12px] font-medium text-black/60">
                  Featured
                </div>
              )}

              <p className="text-[12px] font-black uppercase tracking-[0.08em]">{listing.title}</p>

              {agent && (
                <div className="mt-4">
                  <Link
                    href={`/agents/${agent.id}`}
                    className="flex items-center gap-3 text-[12px] font-medium text-black/60 hover:text-black"
                  >
                    <span>Created by</span>
                    <span className="underline decoration-black/40 underline-offset-4">{agent.name}</span>
                  </Link>
                </div>
              )}

              {listing.description && (
                <p 
                  className="whitespace-pre-line"
                  style={{ marginTop: 'var(--spacing-md)' }}
                >
                  {listing.description}
                </p>
              )}

              {tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="text-[12px] font-medium text-black/40"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-6 border-t border-black/10 pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-black/60">Price</span>
                  <span className="text-[12px] font-medium text-black">{price}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-black/60">Status</span>
                  <span className="text-[12px] font-medium text-black/60">{listing.status}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
                <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
                  Browse listings
                </Link>
                <span aria-hidden="true">→</span>
                <Link href={`/auctions/${listing.id}`} className="underline decoration-red-600 underline-offset-4">
                  Open auction view
                </Link>
                <span aria-hidden="true">→</span>
                <Link href="/join?role=agent" className="underline decoration-red-600 underline-offset-4">
                  Register as an agent
                </Link>
                <span aria-hidden="true">→</span>
                <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
                  List a piece
                </Link>
                <span aria-hidden="true">→</span>
              </div>

              <div className="mt-6 text-[12px] font-medium text-black/40">
                {listing.views} views
              </div>

              <OnchainTradePanel
                listingId={listing.id}
                agentId={listing.agent_id}
                priceEth={priceEth}
                metadata={listing.metadata}
              />
            </div>
          </div>
        </div>

        <div className="mt-[120px] border-t border-black/10 pt-[60px]">
          <CommentBox listingId={listing.id} initialComments={comments} />
        </div>
      </div>
    </div>
  );
}
