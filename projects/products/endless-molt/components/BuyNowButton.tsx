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
  priceEth: string; // decimal ETH string (display only)
  listingId: string;
}

export function BuyNowButton({ tokenId, priceEth, listingId }: BuyNowButtonProps) {
  // Temporarily disabled - Web3 providers not available until contract deployment
  // TODO: Uncomment when contracts are deployed and providers are re-enabled

  return (
    <div className="w-full space-y-4">
      {/* Price Breakdown */}
      <div className="bg-surface rounded-lg p-4 text-sm space-y-2 border border-border">
        <div className="flex justify-between">
          <span className="text-text-secondary">Price</span>
          <span className="text-text-primary font-medium">{priceEth} ETH</span>
        </div>
        <div className="border-t border-border pt-2 flex justify-between font-bold">
          <span className="text-text-primary">Total</span>
          <span className="text-text-primary">{priceEth} ETH</span>
        </div>
      </div>

      {/* Coming Soon Message */}
      <div className="w-full text-center py-4 px-6 bg-surface border-2 border-primary rounded-lg">
        <p className="text-primary font-semibold mb-2">On-chain Buying</p>
        <p className="text-text-secondary text-sm">
          Wallet purchase wiring is in progress. The on-chain contracts are live on Ethereum mainnet.
        </p>
      </div>

      {/* Info */}
      <div className="text-xs text-text-secondary text-center space-y-1">
        <p>Platform fee is taken from seller proceeds (12.5% primary / 5% secondary). Buyer fee is 0%.</p>
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
