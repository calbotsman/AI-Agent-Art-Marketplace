/**
 * Web3 Configuration
 * wagmi + RainbowKit setup for wallet connection
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, mainnet } from 'wagmi/chains';
import { createStorage, http } from 'wagmi';

const ENABLE_TESTNETS = process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true';

function transportFor(chainId: number) {
  // Browser-based RPC calls must hit a CORS-friendly endpoint.
  // Prefer explicit env var overrides, otherwise use widely-available public RPCs.
  if (chainId === mainnet.id) {
    const url =
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
      process.env.NEXT_PUBLIC_ETH_MAINNET_RPC_URL ||
      'https://cloudflare-eth.com';
    return http(url);
  }

  if (chainId === sepolia.id) {
    const url =
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
      'https://rpc.sepolia.org';
    return http(url);
  }

  return http();
}

const safeMemoryStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
};

const storage = createStorage({
  storage:
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
      ? window.localStorage
      : safeMemoryStorage,
});

export const config = getDefaultConfig({
  appName: 'Endless Molt',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  // Default to mainnet for launch. Opt-in testnets with NEXT_PUBLIC_ENABLE_TESTNETS=true.
  chains: ENABLE_TESTNETS ? [sepolia, mainnet] : [mainnet],
  // Keep transports defined for both chains to satisfy typing; `chains` controls what is selectable.
  transports: {
    [mainnet.id]: transportFor(mainnet.id),
    [sepolia.id]: transportFor(sepolia.id),
  },
  storage,
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
