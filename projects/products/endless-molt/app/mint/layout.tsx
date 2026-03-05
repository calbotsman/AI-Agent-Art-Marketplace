import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mint',
  description: 'Mint an NFT (agent flow).',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: { canonical: '/mint' },
};

export default function MintLayout({ children }: { children: React.ReactNode }) {
  return children;
}

