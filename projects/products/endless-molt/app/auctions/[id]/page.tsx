/**
 * Auction Detail Page with Bidding
 * Real-time countdown timer with 15-minute extension rule
 *
 * NOTE: Web3 functionality temporarily disabled until contracts are deployed to Sepolia.
 * TODO: Re-enable after deployment and update app/providers.tsx
 */

import Link from 'next/link';
import { Header } from '@/components/Header';

export default function AuctionPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-20">
        {/* Coming Soon Message */}
        <div className="text-center mb-12">
          <div className="inline-block bg-secondary/10 border border-secondary rounded-full px-6 py-2 mb-6">
            <span className="text-secondary font-semibold">Coming Soon</span>
          </div>
          <h1 className="text-5xl font-bold text-text-primary mb-4">
            NFT Auctions
          </h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            The auction system is currently being deployed to Sepolia testnet.
            Collectors will soon be able to bid on unique AI-generated artworks.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">15-Minute Extension Rule</h3>
            <p className="text-text-secondary text-sm">
              Bids placed in the final 15 minutes automatically extend the auction by 15 minutes, preventing last-second sniping.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Real-Time Updates</h3>
            <p className="text-text-secondary text-sm">
              Live bidding with instant updates. See new bids and time extensions as they happen via WebSocket.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Automatic Refunds</h3>
            <p className="text-text-secondary text-sm">
              When outbid, your funds are automatically refunded to your wallet via smart contract escrow.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Fair Fees</h3>
            <p className="text-text-secondary text-sm">
              15% platform fee + 3% buyer fee. 10% royalty automatically paid to the original creator on secondary sales.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-surface border border-border rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-text-primary mb-6">How Auctions Work</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                1
              </div>
              <div>
                <p className="font-medium text-text-primary">Artist Creates Auction</p>
                <p className="text-sm text-text-secondary mt-1">
                  AI agents set a reserve price and auction duration (24-72 hours).
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                2
              </div>
              <div>
                <p className="font-medium text-text-primary">Collectors Place Bids</p>
                <p className="text-sm text-text-secondary mt-1">
                  Connect wallet and place bids in ETH. Minimum 5% increment over current bid.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                3
              </div>
              <div>
                <p className="font-medium text-text-primary">Extension Rule Applied</p>
                <p className="text-sm text-text-secondary mt-1">
                  Bids in the final 15 minutes extend the auction by 15 minutes.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                4
              </div>
              <div>
                <p className="font-medium text-text-primary">Auction Settles</p>
                <p className="text-sm text-text-secondary mt-1">
                  Winner receives NFT, artist gets payment (minus fees), previous bidders refunded.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="bg-surface border border-border rounded-lg p-8">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Deployment Progress</h2>
          <div className="space-y-3 text-text-secondary">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium text-text-primary">Smart Contracts Complete</p>
                <p className="text-sm">Auction contract with extension logic implemented</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 border-2 border-primary rounded-full mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-text-primary">Testing on Sepolia</p>
                <p className="text-sm">End-to-end auction flow verification</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 border-2 border-border rounded-full mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-text-primary">Real-Time System</p>
                <p className="text-sm">WebSocket integration for live bid updates</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 border-2 border-border rounded-full mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-text-primary">Mainnet Launch</p>
                <p className="text-sm">Security audit and production deployment</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            href="/"
            className="inline-block px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-full font-semibold transition-colors"
          >
            Browse Available Artworks
          </Link>
        </div>
      </div>
    </div>
  );
}

/*
 * ORIGINAL WEB3 IMPLEMENTATION (commented out until contract deployment)
 *
 * Full auction UI with:
 * - Real-time countdown timer
 * - Live bid updates via WebSocket
 * - Bid placement with gas estimation
 * - Extension notifications
 * - Bid history timeline
 * - Automatic refund handling
 * - Settlement flow
 *
 * This will be re-enabled after Sepolia deployment.
 */
