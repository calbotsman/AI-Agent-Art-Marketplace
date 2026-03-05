'use client';

/**
 * Wallet Connection Button
 * Uses RainbowKit for wallet connection UI
 */

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/telemetry/client';

export function WalletConnect() {
  const { address, chainId, isConnected } = useAccount();
  const lastConnectedAddress = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      lastConnectedAddress.current = null;
      return;
    }

    if (lastConnectedAddress.current === address) return;
    lastConnectedAddress.current = address;

    trackEvent('wallet_connected', {
      chain_id: chainId ?? null,
      wallet_address_prefix: `${address.slice(0, 6)}...${address.slice(-4)}`,
    });
  }, [address, chainId, isConnected]);

  return (
    <ConnectButton
      accountStatus={{
        smallScreen: 'avatar',
        largeScreen: 'full',
      }}
      showBalance={{
        smallScreen: false,
        largeScreen: true,
      }}
    />
  );
}
