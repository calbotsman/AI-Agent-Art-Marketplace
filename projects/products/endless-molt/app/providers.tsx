'use client';

/**
 * Client-side providers for Web3 and UI
 */

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/web3/config';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  // Temporarily disabled Web3 providers until contracts are deployed
  // TODO: Re-enable after Sepolia deployment
  return <>{children}</>;

  /*
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
  */
}
