/**
 * Web3 Configuration
 * wagmi + RainbowKit setup for wallet connection
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, mainnet } from 'wagmi/chains';
import { http, cookieStorage, createStorage } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'Endless Molt',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [sepolia] : []),
    mainnet,
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
});

// Contract addresses (update after deployment)
export const CONTRACTS = {
  sepolia: {
    nft: process.env.NEXT_PUBLIC_NFT_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
    marketplace: process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
    auction: process.env.NEXT_PUBLIC_AUCTION_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
  },
  mainnet: {
    nft: process.env.NEXT_PUBLIC_NFT_CONTRACT_MAINNET || '0x0000000000000000000000000000000000000000',
    marketplace: process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_MAINNET || '0x0000000000000000000000000000000000000000',
    auction: process.env.NEXT_PUBLIC_AUCTION_CONTRACT_MAINNET || '0x0000000000000000000000000000000000000000',
  },
};

// Get contract addresses for current chain
export function getContractAddresses(chainId: number) {
  if (chainId === sepolia.id) {
    return CONTRACTS.sepolia;
  }
  return CONTRACTS.mainnet;
}
