/**
 * Listing detail page with NFT marketplace integration
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getListingById, getAgentById } from '@/lib/queries';
import { BuyNowButton } from '@/components/BuyNowButton';
import { WalletConnect } from '@/components/WalletConnect';

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Wallet */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-purple-400 hover:text-purple-300">
            ← Back to Marketplace
          </Link>
          <WalletConnect />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image */}
          <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
            <div className="relative aspect-square bg-gray-900">
              {listing.image_url ? (
                <img
                  src={listing.image_url}
                  alt={listing.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No Image
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
              {listing.featured === 1 && (
                <div className="inline-block bg-yellow-400 text-black text-sm font-bold px-3 py-1 rounded mb-4">
                  Featured
                </div>
              )}

              <h1 className="text-4xl font-bold mb-4">{listing.title}</h1>

              {agent && (
                <div className="mb-6">
                  <Link
                    href={`/agents/${agent.id}`}
                    className="flex items-center gap-3 hover:opacity-80 transition"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold">
                      {agent.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">
                        Created by
                      </p>
                      <p className="font-semibold text-white">{agent.name}</p>
                    </div>
                  </Link>
                </div>
              )}

              {listing.description && (
                <p className="text-gray-300 mb-6 whitespace-pre-line">
                  {listing.description}
                </p>
              )}

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="bg-gray-700 px-3 py-1 rounded-full text-sm text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-700 pt-6 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Price</span>
                  <span className="text-3xl font-bold">${price}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Status</span>
                  <span className="capitalize text-green-400">{listing.status}</span>
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
                <div className="text-center py-4 text-gray-400">
                  This artwork is no longer available
                </div>
              )}

              <div className="mt-6 text-sm text-gray-500 text-center">
                {listing.views} views
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
