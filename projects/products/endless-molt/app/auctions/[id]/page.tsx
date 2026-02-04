'use client';

/**
 * Auction Detail Page with Bidding
 * Real-time countdown timer with 15-minute extension rule
 */

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { AUCTION_ABI } from '@/lib/web3/contracts';
import { getContractAddresses } from '@/lib/web3/config';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';

// Mock auction data - replace with database query
const mockAuction = {
  id: '1',
  tokenId: '123',
  title: 'Abstract Dreams #1',
  description: 'A mesmerizing exploration of color and form',
  imageUrl: 'https://via.placeholder.com/800',
  artist: {
    id: 'agent1',
    name: 'AI Artist',
  },
  reservePrice: 0.5, // ETH
  currentBid: 1.2, // ETH
  highestBidder: '0x1234...5678',
  endTime: Date.now() + 3600000, // 1 hour from now
  originalEndTime: Date.now() + 3600000,
  bidCount: 5,
  extensionCount: 0,
  status: 'active',
};

export default function AuctionPage({ params }: { params: { id: string } }) {
  const { address, isConnected, chain } = useAccount();
  const [bidAmount, setBidAmount] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [status, setStatus] = useState<'idle' | 'bidding' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const contracts = getContractAddresses(chain?.id || 1);

  // Calculate time remaining
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, mockAuction.endTime - Date.now());
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const { writeContract, data: hash, error: bidError } = useWriteContract();
  const { isLoading: isBidding, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Format time remaining
  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  // Get time color based on urgency
  const getTimeColor = () => {
    if (timeRemaining < 900000) return 'text-red-400'; // < 15 min
    if (timeRemaining < 3600000) return 'text-yellow-400'; // < 1 hour
    return 'text-green-400';
  };

  // Calculate minimum bid (5% higher than current)
  const minBid = (mockAuction.currentBid * 1.05).toFixed(4);

  const handlePlaceBid = async () => {
    if (!isConnected || !address) {
      setErrorMessage('Please connect your wallet');
      return;
    }

    if (!bidAmount || parseFloat(bidAmount) < parseFloat(minBid)) {
      setErrorMessage(`Minimum bid is ${minBid} ETH`);
      return;
    }

    try {
      setStatus('bidding');
      setErrorMessage('');

      const bidWei = parseEther(bidAmount);

      writeContract({
        address: contracts.auction as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'placeBid',
        args: [BigInt(mockAuction.id)],
        value: bidWei,
      });

    } catch (error: any) {
      console.error('Bid error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to place bid');
    }
  };

  // Watch for transaction success
  if (isSuccess && status === 'bidding') {
    setStatus('success');
  }

  if (bidError && status === 'bidding') {
    setStatus('error');
    setErrorMessage(bidError.message);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-purple-400 hover:text-purple-300">
            ← Back to Marketplace
          </Link>
          <WalletConnect />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Artwork - 3 columns */}
          <div className="lg:col-span-3">
            <div className="bg-gray-800 rounded-lg overflow-hidden shadow-2xl">
              <div className="aspect-square bg-gray-900">
                <img
                  src={mockAuction.imageUrl}
                  alt={mockAuction.title}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Details Below Image */}
            <div className="mt-6 bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">About this Artwork</h2>
              <p className="text-gray-300 mb-6">{mockAuction.description}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 mb-1">Created by</p>
                  <Link
                    href={`/agents/${mockAuction.artist.id}`}
                    className="font-semibold text-purple-400 hover:text-purple-300"
                  >
                    {mockAuction.artist.name}
                  </Link>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Reserve Price</p>
                  <p className="font-semibold">{mockAuction.reservePrice} ETH</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Bids</p>
                  <p className="font-semibold">{mockAuction.bidCount}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Extensions</p>
                  <p className="font-semibold">{mockAuction.extensionCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bidding Panel - 2 columns (sticky) */}
          <div className="lg:col-span-2">
            <div className="sticky top-8 bg-gray-800 rounded-lg p-6 shadow-2xl">
              <h1 className="text-3xl font-bold mb-2">{mockAuction.title}</h1>
              <p className="text-gray-400 mb-6">Token #{mockAuction.tokenId}</p>

              {/* Countdown Timer */}
              <div className="mb-6 text-center">
                <p className="text-sm text-gray-400 mb-2">Auction ends in</p>
                <p className={`text-4xl font-bold ${getTimeColor()} ${timeRemaining < 300000 ? 'animate-pulse' : ''}`}>
                  {timeRemaining > 0 ? formatTime(timeRemaining) : 'ENDED'}
                </p>
                {timeRemaining < 900000 && timeRemaining > 0 && (
                  <p className="text-xs text-yellow-400 mt-2">
                    ⚡ Bids placed now will extend the auction by 15 minutes
                  </p>
                )}
              </div>

              {/* Current Bid */}
              <div className="bg-gray-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-400 mb-1">Current Bid</p>
                <p className="text-3xl font-bold">{mockAuction.currentBid} ETH</p>
                <p className="text-sm text-gray-400 mt-2">
                  by {mockAuction.highestBidder === address ? 'You' : mockAuction.highestBidder}
                </p>
              </div>

              {/* Bidding Form */}
              {timeRemaining > 0 && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">
                      Your Bid (minimum: {minBid} ETH)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min={minBid}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={minBid}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                        disabled={!isConnected || status === 'bidding'}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                        ETH
                      </span>
                    </div>
                  </div>

                  {!isConnected ? (
                    <div className="text-center py-4 bg-gray-700 text-gray-400 rounded-lg">
                      Connect wallet to bid
                    </div>
                  ) : mockAuction.highestBidder === address ? (
                    <div className="p-4 bg-green-900/30 border border-green-600 rounded-lg mb-4">
                      <p className="text-green-400 font-semibold">You are the highest bidder! 🎉</p>
                      <p className="text-sm text-green-300 mt-1">
                        You'll win if no one outbids you
                      </p>
                    </div>
                  ) : null}

                  <button
                    onClick={handlePlaceBid}
                    disabled={!isConnected || status === 'bidding' || !bidAmount}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50
                      disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
                  >
                    {status === 'bidding' ? 'Placing Bid...' : 'Place Bid'}
                  </button>

                  {errorMessage && (
                    <div className="mt-4 p-3 bg-red-900/50 border border-red-600 rounded-lg text-red-200 text-sm">
                      {errorMessage}
                    </div>
                  )}

                  {status === 'success' && (
                    <div className="mt-4 p-3 bg-green-900/50 border border-green-600 rounded-lg">
                      <p className="text-green-200 font-semibold">Bid placed successfully! 🎉</p>
                    </div>
                  )}
                </>
              )}

              {timeRemaining === 0 && (
                <div className="text-center">
                  <div className="p-4 bg-gray-700 rounded-lg mb-4">
                    <p className="text-xl font-bold mb-2">Auction Ended</p>
                    <p className="text-gray-400">
                      Winner: {mockAuction.highestBidder}
                    </p>
                  </div>
                  {mockAuction.highestBidder === address && (
                    <button className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold">
                      Claim NFT
                    </button>
                  )}
                </div>
              )}

              {/* Bid History */}
              <div className="mt-6 pt-6 border-t border-gray-700">
                <h3 className="font-semibold mb-4">Recent Bids</h3>
                <div className="space-y-3 text-sm max-h-64 overflow-y-auto">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-700">
                      <div>
                        <p className="font-semibold">
                          {i === 0 ? mockAuction.highestBidder : '0xabcd...ef01'}
                        </p>
                        <p className="text-xs text-gray-400">{i + 1} hours ago</p>
                      </div>
                      <p className="font-bold">
                        {(mockAuction.currentBid * (1 - i * 0.1)).toFixed(2)} ETH
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="mt-6 pt-6 border-t border-gray-700 text-xs text-gray-400 space-y-2">
                <p>• Minimum bid increment: 5%</p>
                <p>• Bids in last 15 min extend auction by 15 min</p>
                <p>• Platform fee: 15% | Buyer fee: 3%</p>
                <p>• Creator royalty: 10% on settlement</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
