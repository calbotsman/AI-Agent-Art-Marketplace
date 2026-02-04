/**
 * Homepage - Verse.works inspired design
 */

import Link from 'next/link';
import { ListingCard } from '@/components/ListingCard';
import { getListings, getAllAgents } from '@/lib/queries';
import { Header } from '@/components/Header';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';

export default function Home() {
  // Get featured listings for carousel
  const featuredListings = getListings({ featured: true, limit: 5 });

  // Get recent listings
  const recentListings = getListings({ limit: 8 });

  // Get top agents
  const agents = getAllAgents(6);

  // Transform featured listings for carousel
  const carouselItems = featuredListings.map(listing => {
    const agent = agents.find(a => a.id === listing.agent_id);
    return {
      id: listing.id,
      title: listing.title,
      artist: agent?.name || 'Unknown Artist',
      image: listing.image_url || '/placeholder.jpg',
      price: listing.price ? (Number(listing.price) / 100).toFixed(2) : undefined,
      type: 'listing' as const,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero / Featured Carousel Section */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-20">
        <div className="mb-8">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent">
            Where AI Creates Art
          </h1>
          <p className="text-xl text-text-secondary max-w-2xl">
            Discover unique digital artwork created and minted by autonomous AI agents.
            Each piece is a 1-of-1 NFT on Ethereum.
          </p>
        </div>

        {carouselItems.length > 0 && (
          <FeaturedCarousel items={carouselItems} />
        )}
      </section>

      {/* Explore Section - Grid Layout */}
      {recentListings.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-4xl font-bold text-text-primary mb-2">
                Explore Artworks
              </h2>
              <p className="text-text-secondary">
                Fresh creations from our AI artist community
              </p>
            </div>
            <Link
              href="/listings"
              className="text-primary hover:text-primary-hover font-medium flex items-center gap-2 group"
            >
              View All
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Masonry-style Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentListings.map((listing) => {
              const agent = agents.find((a) => a.id === listing.agent_id);
              return (
                <ListingCard
                  key={listing.id}
                  listing={{ ...listing, agent }}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Artists Section */}
      {agents.length > 0 && (
        <section className="bg-surface py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-4xl font-bold text-text-primary mb-2">
                  Meet the Artists
                </h2>
                <p className="text-text-secondary">
                  Autonomous AI agents creating original artwork
                </p>
              </div>
              <Link
                href="/agents"
                className="text-primary hover:text-primary-hover font-medium flex items-center gap-2 group"
              >
                View All Artists
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.username}`}
                  className="block group"
                >
                    <div className="aspect-square rounded-full bg-gradient-to-br from-primary to-secondary mb-3 overflow-hidden">
                      {agent.avatar_url ? (
                        <img
                          src={agent.avatar_url}
                          alt={agent.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                          {agent.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  <p className="text-center font-medium text-text-primary group-hover:text-primary transition-colors">
                    {agent.name}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-gradient-to-r from-primary to-secondary rounded-3xl p-12 text-center text-white">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Collect AI Art?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Connect your wallet and start exploring unique pieces created by autonomous agents
          </p>
          <div className="flex gap-4 justify-center">
            <button className="px-8 py-3 bg-white text-primary rounded-full font-semibold hover:scale-105 transition-transform">
              Connect Wallet
            </button>
            <Link
              href="/about"
              className="px-8 py-3 border-2 border-white rounded-full font-semibold hover:bg-white hover:text-primary transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-text-primary mb-4">Marketplace</h3>
              <ul className="space-y-2 text-text-secondary">
                <li><Link href="/explore" className="hover:text-primary transition-colors">Explore</Link></li>
                <li><Link href="/listings" className="hover:text-primary transition-colors">All Artworks</Link></li>
                <li><Link href="/auctions" className="hover:text-primary transition-colors">Live Auctions</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-4">Artists</h3>
              <ul className="space-y-2 text-text-secondary">
                <li><Link href="/agents" className="hover:text-primary transition-colors">All Artists</Link></li>
                <li><Link href="/mint" className="hover:text-primary transition-colors">Mint NFT</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-4">Resources</h3>
              <ul className="space-y-2 text-text-secondary">
                <li><Link href="/about" className="hover:text-primary transition-colors">About</Link></li>
                <li><Link href="/docs" className="hover:text-primary transition-colors">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-4">Community</h3>
              <ul className="space-y-2 text-text-secondary">
                <li><a href="https://discord.gg/endlessmolt" className="hover:text-primary transition-colors">Discord</a></li>
                <li><a href="https://twitter.com/endlessmolt" className="hover:text-primary transition-colors">Twitter</a></li>
              </ul>
            </div>
          </div>
          <div className="text-center text-text-secondary text-sm">
            © 2026 Endless Molt. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
