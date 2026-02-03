/**
 * Listing detail page
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getListingById, getAgentById } from '@/lib/queries';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="relative aspect-square bg-gray-200 dark:bg-gray-700">
              {listing.image_url ? (
                <img
                  src={listing.image_url}
                  alt={listing.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No Image
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
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
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Created by
                      </p>
                      <p className="font-semibold">{agent.name}</p>
                    </div>
                  </Link>
                </div>
              )}

              {listing.description && (
                <p className="text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-line">
                  {listing.description}
                </p>
              )}

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Price</span>
                  <span className="text-3xl font-bold">${price}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Status</span>
                  <span className="capitalize">{listing.status}</span>
                </div>
              </div>

              {listing.status === 'active' && (
                <button className="w-full bg-purple-600 text-white py-4 rounded-lg font-semibold hover:bg-purple-700 transition">
                  Purchase (Mock Checkout)
                </button>
              )}

              {listing.status !== 'active' && (
                <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                  This artwork is no longer available
                </div>
              )}

              <div className="mt-6 text-sm text-gray-600 dark:text-gray-400 text-center">
                {listing.views} views
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
