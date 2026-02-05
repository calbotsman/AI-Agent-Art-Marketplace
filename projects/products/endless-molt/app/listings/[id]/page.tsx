/**
 * Listing detail page with NFT marketplace integration
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getListingById, getAgentById } from '@/lib/queries';
import { BuyNowButton } from '@/components/BuyNowButton';
import { WalletConnect } from '@/components/WalletConnect';

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
  const listing = getListingById(id);

  if (!listing) {
    notFound();
  }

  const agent = getAgentById(listing.agent_id);
  const price = (listing.price / 100).toFixed(2);
  const tags = listing.tags ? JSON.parse(listing.tags) : [];

  return (
    <div className="min-h-screen">
      <div className="content-container py-12">
        {/* Header with Wallet */}
        <div className="flex justify-between items-center" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <Link 
            href="/" 
            className="text-secondary hover:text-primary transition-colors"
            style={{ color: 'var(--accent-blue)' }}
          >
            ← Back to Marketplace
          </Link>
          <WalletConnect />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--spacing-lg)' }}>
          {/* Image */}
          <div className="card overflow-hidden">
            <div className="relative aspect-square" style={{ backgroundColor: 'var(--surface)' }}>
              {listing.image_url ? (
                <img
                  src={listing.image_url}
                  alt={listing.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-secondary">
                  No Image
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
              {listing.featured === 1 && (
                <div 
                  className="inline-block text-sm px-3 py-1 rounded mb-4"
                  style={{ 
                    backgroundColor: 'var(--accent-blue)',
                    color: 'white'
                  }}
                >
                  Featured
                </div>
              )}

              <h1 style={{ marginBottom: 'var(--spacing-md)' }}>{listing.title}</h1>

              {agent && (
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <Link
                    href={`/agents/${agent.id}`}
                    className="flex items-center hover:opacity-80 transition"
                    style={{ gap: 'var(--spacing-sm)' }}
                  >
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                      style={{ 
                        backgroundColor: 'var(--accent-blue)',
                        fontWeight: '500'
                      }}
                    >
                      {agent.name.charAt(0)}
                    </div>
                    <div>
                      <p 
                        className="text-sm"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Created by
                      </p>
                      <p style={{ fontWeight: '500' }}>{agent.name}</p>
                    </div>
                  </Link>
                </div>
              )}

              {listing.description && (
                <p 
                  className="whitespace-pre-line"
                  style={{ 
                    marginBottom: 'var(--spacing-md)',
                    color: 'var(--text-primary)'
                  }}
                >
                  {listing.description}
                </p>
              )}

              {tags.length > 0 && (
                <div className="flex flex-wrap" style={{ gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>
                  {tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full text-sm"
                      style={{ 
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div 
                className="divider"
                style={{ 
                  paddingTop: 'var(--spacing-md)',
                  marginBottom: 'var(--spacing-md)'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: 'var(--text-secondary)' }}>Price</span>
                  <span style={{ fontSize: '2rem', fontWeight: '400' }}>${price}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                  <span 
                    className="capitalize"
                    style={{ 
                      color: listing.status === 'active' ? '#10b981' : 'var(--text-secondary)'
                    }}
                  >
                    {listing.status}
                  </span>
                </div>
              </div>

              {listing.status === 'active' && (
                <BuyNowButton
                  tokenId={listing.id}
                  price={listing.price}
                  listingId={listing.id}
                />
              )}

              {listing.status !== 'active' && (
                <div 
                  className="text-center py-4"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  This artwork is no longer available
                </div>
              )}

              <div 
                className="text-sm text-center"
                style={{ 
                  marginTop: 'var(--spacing-md)',
                  color: 'var(--text-secondary)' 
                }}
              >
                {listing.views} views
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
