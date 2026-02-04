'use client';

/**
 * Buy Now Button with Web3 Integration
 * Handles NFT purchase transactions
 */

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { MARKETPLACE_ABI, calculateTotalPrice } from '@/lib/web3/contracts';
import { getContractAddresses } from '@/lib/web3/config';

interface BuyNowButtonProps {
  tokenId: string;
  price: number; // in USD cents
  listingId: string;
}

export function BuyNowButton({ tokenId, price, listingId }: BuyNowButtonProps) {
  const { address, isConnected, chain } = useAccount();
  const [status, setStatus] = useState<'idle' | 'buying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const contracts = getContractAddresses(chain?.id || 1);

  // Read marketplace fees
  const { data: platformFee } = useReadContract({
    address: contracts.marketplace as `0x${string}`,
    abi: MARKETPLACE_ABI,
    functionName: 'platformFeePercent',
  });

  const { data: buyerFee } = useReadContract({
    address: contracts.marketplace as `0x${string}`,
    abi: MARKETPLACE_ABI,
    functionName: 'buyerFeePercent',
  });

  const { writeContract, data: hash, error: buyError } = useWriteContract();
  const { isLoading: isBuying, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Convert USD to ETH (mock conversion - should use oracle in production)
  const priceInETH = (price / 100 / 3000).toFixed(6); // Assuming $3000/ETH
  const priceWei = parseEther(priceInETH);

  // Calculate total with buyer fee
  const totalPrice = buyerFee
    ? calculateTotalPrice(priceWei, buyerFee as bigint)
    : priceWei;

  const handleBuy = async () => {
    if (!isConnected || !address) {
      setErrorMessage('Please connect your wallet');
      return;
    }

    try {
      setStatus('buying');
      setErrorMessage('');

      writeContract({
        address: contracts.marketplace as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'buy',
        args: [BigInt(tokenId)],
        value: totalPrice,
      });

    } catch (error: any) {
      console.error('Purchase error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to purchase NFT');
    }
  };

  // Watch for transaction success
  if (isSuccess && status === 'buying') {
    setStatus('success');
    // TODO: Update database to mark listing as sold
  }

  if (buyError && status === 'buying') {
    setStatus('error');
    setErrorMessage(buyError.message);
  }

  if (!isConnected) {
    return (
      <div className="w-full text-center py-4 bg-gray-700 text-gray-400 rounded-lg">
        Connect wallet to purchase
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="w-full">
        <div className="p-4 bg-green-900/50 border border-green-600 rounded-lg mb-4">
          <p className="font-semibold text-green-200">Purchase Successful! 🎉</p>
          <p className="text-sm text-green-300 mt-2">
            The NFT is now in your wallet
          </p>
        </div>
        <a
          href={`https://${chain?.id === 11155111 ? 'sepolia.' : ''}etherscan.io/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
        >
          View on Etherscan →
        </a>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Price Breakdown */}
      <div className="bg-gray-700 rounded-lg p-4 text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-400">Price</span>
          <span>{priceInETH} ETH</span>
        </div>
        {buyerFee && (
          <div className="flex justify-between">
            <span className="text-gray-400">Buyer Fee (3%)</span>
            <span>{formatEther((priceWei * (buyerFee as bigint)) / 10000n)} ETH</span>
          </div>
        )}
        <div className="border-t border-gray-600 pt-2 flex justify-between font-bold">
          <span>Total</span>
          <span>{formatEther(totalPrice)} ETH</span>
        </div>
      </div>

      {/* Buy Button */}
      <button
        onClick={handleBuy}
        disabled={status === 'buying'}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50
          disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold transition-colors"
      >
        {status === 'buying' ? 'Processing Transaction...' : 'Buy Now'}
      </button>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-red-900/50 border border-red-600 rounded-lg text-red-200 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-gray-400 text-center">
        <p>15% platform fee + 3% buyer fee</p>
        <p>10% royalty to original creator on secondary sales</p>
      </div>
    </div>
  );
}
