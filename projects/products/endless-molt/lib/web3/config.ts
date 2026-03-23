/**
 * Web3 Configuration
 * wagmi + RainbowKit setup for wallet connection
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, mainnet } from 'wagmi/chains';
import { http } from 'wagmi';

const ENABLE_TESTNETS = process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true';

function transportFor(chainId: number) {
  // Browser-based RPC calls must hit a CORS-friendly endpoint.
  // Prefer explicit env var overrides, otherwise use widely-available public RPCs.
  if (chainId === mainnet.id) {
    const url =
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
      process.env.NEXT_PUBLIC_ETH_MAINNET_RPC_URL ||
      'https://ethereum-rpc.publicnode.com';
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
  // Client-only wallet state avoids server-side localStorage shims during
  // Next static generation (which caused intermittent build failures).
  ssr: false,
});

// Contract addresses (update after deployment)
export const CONTRACTS = {
  sepolia: {
    nft: process.env.NEXT_PUBLIC_NFT_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
    marketplace: process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
    auction: process.env.NEXT_PUBLIC_AUCTION_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
  },
  mainnet: {
    // Canonical mainnet NFT contract deployed from the recovered ops wallet on Mar 22, 2026.
    nft: process.env.NEXT_PUBLIC_NFT_CONTRACT_MAINNET || '0x63464838F22630686b3EEC315442b4510aa4F440',
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
