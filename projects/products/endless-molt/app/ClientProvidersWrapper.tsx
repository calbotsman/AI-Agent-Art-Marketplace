'use client';

/**
 * Client-side wrapper to prevent Web3 providers from running during SSR
 */

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const Providers = dynamic(
  () => import('./providers').then(mod => ({ default: mod.Providers })),
  { ssr: false }
);

export function ClientProvidersWrapper({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
