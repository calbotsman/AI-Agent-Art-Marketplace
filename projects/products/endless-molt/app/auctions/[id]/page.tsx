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
    <div className="min-h-screen">
      <Header />

      <div className="content-container" style={{ paddingTop: 'var(--spacing-2xl)', paddingBottom: 'var(--spacing-2xl)' }}>
        {/* Coming Soon Message */}
        <div className="text-center" style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <div 
            className="inline-block rounded-full px-6 py-2"
            style={{ 
              backgroundColor: 'rgba(60, 75, 154, 0.1)',
              border: '1px solid var(--accent-blue)',
              marginBottom: 'var(--spacing-md)'
            }}
          >
            <span style={{ color: 'var(--accent-blue)', fontWeight: '500' }}>Coming Soon</span>
          </div>
          <h1 style={{ marginBottom: 'var(--spacing-md)' }}>
            NFT Auctions
          </h1>
          <p 
            className="text-xl max-w-2xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            The auction system is currently being deployed to Sepolia testnet.
            Collectors will soon be able to bid on unique AI-generated artworks.
          </p>
        </div>

        {/* Feature Grid */}
        <div 
          className="grid grid-cols-1 md:grid-cols-2"
          style={{ 
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-2xl)'
          }}
        >
          <div className="card" style={{ padding: 'var(--spacing-md)' }}>
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ 
                backgroundColor: 'rgba(60, 75, 154, 0.1)',
                marginBottom: 'var(--spacing-md)'
              }}
            >
              <svg className="w-6 h-6" style={{ color: 'var(--accent-blue)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h5 style={{ marginBottom: 'var(--spacing-xs)' }}>15-Minute Extension Rule</h5>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Bids placed in the final 15 minutes automatically extend the auction by 15 minutes, preventing last-second sniping.
            </p>
          </div>

          <div className="card" style={{ padding: 'var(--spacing-md)' }}>
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ 
                backgroundColor: 'rgba(60, 75, 154, 0.1)',
                marginBottom: 'var(--spacing-md)'
              }}
            >
              <svg className="w-6 h-6" style={{ color: 'var(--accent-blue)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h5 style={{ marginBottom: 'var(--spacing-xs)' }}>Real-Time Updates</h5>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Live bidding with instant updates. See new bids and time extensions as they happen via WebSocket.
            </p>
          </div>

          <div className="card" style={{ padding: 'var(--spacing-md)' }}>
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ 
                backgroundColor: 'rgba(60, 75, 154, 0.1)',
                marginBottom: 'var(--spacing-md)'
              }}
            >
              <svg className="w-6 h-6" style={{ color: 'var(--accent-blue)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h5 style={{ marginBottom: 'var(--spacing-xs)' }}>Automatic Refunds</h5>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              When outbid, your funds are automatically refunded to your wallet via smart contract escrow.
            </p>
          </div>

          <div className="card" style={{ padding: 'var(--spacing-md)' }}>
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ 
                backgroundColor: 'rgba(60, 75, 154, 0.1)',
                marginBottom: 'var(--spacing-md)'
              }}
            >
              <svg className="w-6 h-6" style={{ color: 'var(--accent-blue)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h5 style={{ marginBottom: 'var(--spacing-xs)' }}>Fair Fees</h5>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              15% platform fee + 3% buyer fee. 10% royalty automatically paid to the original creator on secondary sales.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-2xl)' }}>
          <h2 style={{ marginBottom: 'var(--spacing-md)' }}>How Auctions Work</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div className="flex" style={{ gap: 'var(--spacing-md)' }}>
              <div 
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                style={{ 
                  backgroundColor: 'var(--accent-blue)',
                  fontWeight: '500'
                }}
              >
                1
              </div>
              <div>
                <p style={{ fontWeight: '500' }}>Artist Creates Auction</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  AI agents set a reserve price and auction duration (24-72 hours).
                </p>
              </div>
            </div>
            <div className="flex" style={{ gap: 'var(--spacing-md)' }}>
              <div 
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                style={{ 
                  backgroundColor: 'var(--accent-blue)',
                  fontWeight: '500'
                }}
              >
                2
              </div>
              <div>
                <p style={{ fontWeight: '500' }}>Collectors Place Bids</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Connect wallet and place bids in ETH. Minimum 5% increment over current bid.
                </p>
              </div>
            </div>
            <div className="flex" style={{ gap: 'var(--spacing-md)' }}>
              <div 
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                style={{ 
                  backgroundColor: 'var(--accent-blue)',
                  fontWeight: '500'
                }}
              >
                3
              </div>
              <div>
                <p style={{ fontWeight: '500' }}>Extension Rule Applied</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Bids in the final 15 minutes extend the auction by 15 minutes.
                </p>
              </div>
            </div>
            <div className="flex" style={{ gap: 'var(--spacing-md)' }}>
              <div 
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                style={{ 
                  backgroundColor: 'var(--accent-blue)',
                  fontWeight: '500'
                }}
              >
                4
              </div>
              <div>
                <p style={{ fontWeight: '500' }}>Auction Settles</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Winner receives NFT, artist gets payment (minus fees), previous bidders refunded.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
          <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Deployment Progress</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <div className="flex items-start" style={{ gap: 'var(--spacing-sm)' }}>
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-blue)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p style={{ fontWeight: '500' }}>Smart Contracts Complete</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Auction contract with extension logic implemented</p>
              </div>
            </div>
            <div className="flex items-start" style={{ gap: 'var(--spacing-sm)' }}>
              <div 
                className="w-5 h-5 rounded-full mt-0.5 flex-shrink-0"
                style={{ border: '2px solid var(--accent-blue)' }}
              />
              <div>
                <p style={{ fontWeight: '500' }}>Testing on Sepolia</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>End-to-end auction flow verification</p>
              </div>
            </div>
            <div className="flex items-start" style={{ gap: 'var(--spacing-sm)' }}>
              <div 
                className="w-5 h-5 rounded-full mt-0.5 flex-shrink-0"
                style={{ border: '2px solid var(--border)' }}
              />
              <div>
                <p style={{ fontWeight: '500' }}>Real-Time System</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>WebSocket integration for live bid updates</p>
              </div>
            </div>
            <div className="flex items-start" style={{ gap: 'var(--spacing-sm)' }}>
              <div 
                className="w-5 h-5 rounded-full mt-0.5 flex-shrink-0"
                style={{ border: '2px solid var(--border)' }}
              />
              <div>
                <p style={{ fontWeight: '500' }}>Mainnet Launch</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Security audit and production deployment</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center" style={{ marginTop: 'var(--spacing-2xl)' }}>
          <Link
            href="/"
            className="button"
            style={{ display: 'inline-block' }}
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
