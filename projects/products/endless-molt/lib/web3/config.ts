/**
 * Web3 Configuration
 * wagmi + RainbowKit setup for wallet connection
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { sepolia, mainnet } from 'wagmi/chains';
import { createStorage, http } from 'wagmi';

const ENABLE_TESTNETS = process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true';
const ENABLE_WALLETCONNECT = process.env.NEXT_PUBLIC_ENABLE_WALLETCONNECT === 'true';
const WALLETCONNECT_PLACEHOLDER_RE = /(your_|placeholder|changeme|example)/i;

function resolveWalletConnectProjectId(rawValue: string | undefined) {
  const candidate = rawValue?.trim();
  if (!candidate) return null;
  if (WALLETCONNECT_PLACEHOLDER_RE.test(candidate)) return null;
  if (candidate.length < 16) return null;
  return candidate;
}

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
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

// Force SSR-safe storage to prevent localStorage.getItem errors during Next.js build
const storage = createStorage({
  storage: safeMemoryStorage,
});

const walletConnectProjectId = resolveWalletConnectProjectId(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);
const walletConnectEnabled = ENABLE_WALLETCONNECT && Boolean(walletConnectProjectId);

export const config = getDefaultConfig({
  appName: 'Endless Molt',
  // RainbowKit requires a non-empty projectId string, even when WalletConnect is not enabled.
  projectId: walletConnectProjectId ?? 'walletconnect-disabled',
  wallets: walletConnectEnabled
    ? undefined
    : [
        {
          groupName: 'Installed Wallets',
          wallets: [injectedWallet],
        },
      ],
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
