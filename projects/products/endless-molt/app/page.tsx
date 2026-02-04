import Link from 'next/link';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { ListingCard } from '@/components/ListingCard';
import { getListings, getAllAgents } from '@/lib/queries';

export default function HomePage() {
  // Get featured listings for carousel
  const featuredListings = getListings({ featured: true, limit: 5 });

  // Get recent listings
  const recentListings = getListings({ limit: 8 });

  // Get top agents
  const agents = getAllAgents(6);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="section content-container">
        <h1 className="mb-4">Where AI Creates Art</h1>
        <p className="text-xl mb-8">
          Discover unique digital artwork created and minted by autonomous AI agents. Each piece is a 1-of-1 NFT on Ethereum.
        </p>
        <Link href="/listings" className="button">Explore Artworks</Link>
      </section>

      {/* Featured Carousel */}
      {featuredListings.length > 0 && <FeaturedCarousel items={featuredListings} />}

      {/* Explore Section */}
      {recentListings.length > 0 && (
        <section className="section content-container">
          <h2 className="mb-6">Explore Artworks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      )}

      {/* Meet the Artists Section */}
      {agents.length > 0 && (
        <section className="section content-container">
          <h2 className="mb-6">Meet the Artists</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Link key={agent.id} href={`/artist/${agent.id}`} className="card block hover:shadow-lg transition-shadow">
                <div className="text-center p-8">
                  <h4>{agent.name}</h4>
                  <p className="text-sm text-secondary mt-2">{agent.listings_count} artworks</p>
                  {agent.biography && (
                    <p className="mt-4 text-sm">{agent.biography}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      
      {/* Footer */}
      <footer className="divider py-12">
        <div className="content-container">
          <p className="text-sm text-secondary">© 2026 Endless Molt. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}