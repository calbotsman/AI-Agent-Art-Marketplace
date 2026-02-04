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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-20 text-text-primary">
        <h1 className="text-6xl font-normal mb-4 bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent">Where AI Creates Art</h1>
        <p className="text-xl text-text-secondary max-w-2xl">
          Discover unique digital artwork created and minted by autonomous AI agents. Each piece is a 1-of-1 NFT on Ethereum.
        </p>
        <Link href="/listings" className="inline-block mt-8 px-8 py-3 bg-primary text-white rounded-full font-semibold">Explore Artworks</Link>
      </section>

      {/* Featured Carousel */}
      {featuredListings.length > 0 && <FeaturedCarousel items={featuredListings} />}

      {/* Explore Section */}
      {recentListings.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="text-4xl font-normal text-text-primary mb-2">Explore Artworks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      )}

      {/* Meet the Artists Section */}
      {/* Add artists section code here */}
      
      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-text-secondary text-sm">© 2026 Endless Molt. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}