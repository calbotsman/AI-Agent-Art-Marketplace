'use client';

/**
 * Buy Now Button with Web3 Integration
 * Handles NFT purchase transactions
 *
 * NOTE: Web3 functionality temporarily disabled until contracts are deployed to Sepolia.
 * TODO: Re-enable after deployment and update app/providers.tsx
 */

interface BuyNowButtonProps {
  tokenId: string;
  price: number; // in USD cents
  listingId: string;
}

export function BuyNowButton({ tokenId, price, listingId }: BuyNowButtonProps) {
  // Temporarily disabled - Web3 providers not available until contract deployment
  // TODO: Uncomment when contracts are deployed and providers are re-enabled

  // Convert USD to ETH for display (mock conversion - should use oracle in production)
  const priceInETH = (price / 100 / 3000).toFixed(4); // Assuming $3000/ETH
  const buyerFeeETH = (parseFloat(priceInETH) * 0.03).toFixed(4);
  const totalETH = (parseFloat(priceInETH) * 1.03).toFixed(4);

  return (
    <div className="w-full space-y-4">
      {/* Price Breakdown */}
      <div className="bg-surface rounded-lg p-4 text-sm space-y-2 border border-border">
        <div className="flex justify-between">
          <span className="text-text-secondary">Price</span>
          <span className="text-text-primary font-medium">{priceInETH} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Buyer Fee (3%)</span>
          <span className="text-text-primary font-medium">{buyerFeeETH} ETH</span>
        </div>
        <div className="border-t border-border pt-2 flex justify-between font-bold">
          <span className="text-text-primary">Total</span>
          <span className="text-text-primary">{totalETH} ETH</span>
        </div>
      </div>

      {/* Coming Soon Message */}
      <div className="w-full text-center py-4 px-6 bg-surface border-2 border-primary rounded-lg">
        <p className="text-primary font-semibold mb-2">NFT Marketplace Coming Soon</p>
        <p className="text-text-secondary text-sm">
          Blockchain integration in progress. Connect your wallet to purchase once contracts are deployed to Sepolia.
        </p>
      </div>

      {/* Info */}
      <div className="text-xs text-text-secondary text-center space-y-1">
        <p>15% platform fee + 3% buyer fee</p>
        <p>10% royalty to original creator on secondary sales</p>
      </div>
    </div>
  );
}

/*
 * ORIGINAL WEB3 IMPLEMENTATION (commented out until contract deployment)
 *
 * import { useState } from 'react';
 * import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
 * import { parseEther, formatEther } from 'viem';
 * import { MARKETPLACE_ABI, calculateTotalPrice } from '@/lib/web3/contracts';
 * import { getContractAddresses } from '@/lib/web3/config';
 *
 * ... full implementation ...
 */
