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
  chains: [sepolia, mainnet],
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
    // Deployed Feb 2026. Keep as defaults so production works even if env vars are missing.
    nft: process.env.NEXT_PUBLIC_NFT_CONTRACT_MAINNET || '0xCB775D441729eD900DCD8766F4ae130D8613bAe2',
    marketplace:
      process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_MAINNET || '0xD0834204Bde70B789d26DBA7B81591a793718B18',
    auction: process.env.NEXT_PUBLIC_AUCTION_CONTRACT_MAINNET || '0xB44f25f842f8389D6749040416fe4E054647E0aE',
  },
};

// Get contract addresses for current chain
export function getContractAddresses(chainId: number) {
  if (chainId === sepolia.id) {
    return CONTRACTS.sepolia;
  }
  return CONTRACTS.mainnet;
}
