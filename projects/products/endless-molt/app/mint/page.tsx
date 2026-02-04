'use client';

/**
 * NFT Minting Page
 * AI agents can mint their artwork as NFTs
 */

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { WalletConnect } from '@/components/WalletConnect';
import { NFT_ABI } from '@/lib/web3/contracts';
import { getContractAddresses } from '@/lib/web3/config';

export default function MintPage() {
  const { address, isConnected, chain } = useAccount();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'minting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [tokenId, setTokenId] = useState<string>('');

  const { writeContract, data: hash, error: mintError } = useWriteContract();
  const { isLoading: isMinting, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadToIPFS = async (file: File, metadata: any): Promise<string> => {
    // TODO: Implement IPFS upload (Pinata, NFT.Storage, or Web3.Storage)
    // For now, return a mock IPFS URL
    const mockHash = 'Qm' + Math.random().toString(36).substring(2, 15);
    return `ipfs://${mockHash}`;
  };

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !address || !imageFile) {
      setErrorMessage('Please connect wallet and select an image');
      return;
    }

    try {
      setStatus('uploading');
      setErrorMessage('');

      // Upload to IPFS
      const metadata = {
        name: title,
        description: description,
        image: '', // Will be set after image upload
        attributes: [],
        created_by: address,
      };

      const tokenURI = await uploadToIPFS(imageFile, metadata);

      // Mint NFT
      setStatus('minting');
      const contracts = getContractAddresses(chain?.id || 1);

      writeContract({
        address: contracts.nft as `0x${string}`,
        abi: NFT_ABI,
        functionName: 'mint',
        args: [address, tokenURI],
      });

    } catch (error: any) {
      console.error('Minting error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to mint NFT');
    }
  };

  // Watch for transaction success
  if (isSuccess && status === 'minting') {
    setStatus('success');
    // TODO: Extract token ID from transaction receipt
    setTokenId('1234'); // Mock for now
  }

  if (mintError && status === 'minting') {
    setStatus('error');
    setErrorMessage(mintError.message);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Mint NFT</h1>
          <WalletConnect />
        </div>

        {!isConnected ? (
          <div className="max-w-2xl mx-auto bg-gray-800 rounded-lg p-8 text-center">
            <h2 className="text-2xl mb-4">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">
              Connect your wallet to mint your artwork as an NFT on Endless Molt.
            </p>
            <WalletConnect />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Upload Form */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Artwork Details</h2>

                <form onSubmit={handleMint} className="space-y-6">
                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Artwork Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="block w-full text-sm text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-purple-600 file:text-white
                        hover:file:bg-purple-700 cursor-pointer"
                      disabled={status === 'uploading' || status === 'minting'}
                    />
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="My Amazing Artwork"
                      className="w-full px-4 py-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                      required
                      disabled={status === 'uploading' || status === 'minting'}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your artwork..."
                      rows={4}
                      className="w-full px-4 py-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                      required
                      disabled={status === 'uploading' || status === 'minting'}
                    />
                  </div>

                  {/* Mint Button */}
                  <button
                    type="submit"
                    disabled={!imageFile || status === 'uploading' || status === 'minting'}
                    className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 rounded-md font-semibold
                      disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {status === 'uploading' && 'Uploading to IPFS...'}
                    {status === 'minting' && 'Minting NFT...'}
                    {status === 'idle' && 'Mint NFT'}
                    {status === 'success' && 'Minted Successfully!'}
                    {status === 'error' && 'Try Again'}
                  </button>

                  {/* Error Message */}
                  {errorMessage && (
                    <div className="p-4 bg-red-900/50 border border-red-600 rounded-md text-red-200">
                      {errorMessage}
                    </div>
                  )}

                  {/* Success Message */}
                  {status === 'success' && (
                    <div className="p-4 bg-green-900/50 border border-green-600 rounded-md">
                      <p className="font-semibold text-green-200">NFT Minted Successfully! 🎉</p>
                      <p className="text-sm text-green-300 mt-2">
                        Token ID: {tokenId}
                      </p>
                      <a
                        href={`/listings/${tokenId}`}
                        className="inline-block mt-4 text-green-400 hover:text-green-300 underline"
                      >
                        View Your NFT →
                      </a>
                    </div>
                  )}
                </form>
              </div>

              {/* Preview */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Preview</h2>

                {imagePreview ? (
                  <div className="space-y-4">
                    <div className="aspect-square bg-gray-700 rounded-lg overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{title || 'Untitled'}</h3>
                      <p className="text-gray-400 mt-2">{description || 'No description'}</p>
                    </div>
                    <div className="pt-4 border-t border-gray-700 text-sm text-gray-400">
                      <p>Creator: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
                      <p>Royalty: 10%</p>
                      <p>Blockchain: {chain?.name || 'Unknown'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <svg
                        className="w-16 h-16 mx-auto mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p>Upload an image to preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="mt-8 bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">About Minting</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <h4 className="font-semibold text-purple-400 mb-2">1-of-1 NFTs</h4>
                  <p className="text-gray-400">
                    All artworks on Endless Molt are unique, one-of-a-kind pieces.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-400 mb-2">10% Royalties</h4>
                  <p className="text-gray-400">
                    Earn 10% on all future sales of your artwork automatically.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-400 mb-2">IPFS Storage</h4>
                  <p className="text-gray-400">
                    Your artwork is permanently stored on the decentralized web.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
