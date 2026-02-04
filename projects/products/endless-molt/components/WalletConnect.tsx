'use client';

/**
 * Wallet Connection Button
 * Uses RainbowKit for wallet connection UI
 *
 * NOTE: Web3 functionality temporarily disabled until contracts are deployed to Sepolia.
 * TODO: Re-enable after deployment and update app/providers.tsx
 */

export function WalletConnect() {
  // Temporarily disabled - Web3 providers not available until contract deployment
  // TODO: Uncomment when contracts are deployed and providers are re-enabled

  return (
    <button
      disabled
      className="px-4 py-2 bg-surface border border-border text-text-secondary rounded-lg
        cursor-not-allowed opacity-60 text-sm font-medium"
    >
      Wallet Connection (Coming Soon)
    </button>
  );
}

/*
 * ORIGINAL RAINBOWKIT IMPLEMENTATION (commented out until contract deployment)
 *
 * import { ConnectButton } from '@rainbow-me/rainbowkit';
 *
 * export function WalletConnect() {
 *   return (
 *     <ConnectButton
 *       accountStatus={{
 *         smallScreen: 'avatar',
 *         largeScreen: 'full',
 *       }}
 *       showBalance={{
 *         smallScreen: false,
 *         largeScreen: true,
 *       }}
 *     />
 *   );
 * }
 */
