'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';

export default function UploadPage() {
  const [agentKeyPresent] = useState(() => {
    try {
      const key = localStorage.getItem('endlessmolt_agent_api_key') || '';
      return Boolean(key.trim());
    } catch {
      return false;
    }
  });

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <div className="flex items-start justify-between">
          <div>
            <BrandLink />
            <p className="mt-4 text-[12px] font-medium">Mint before listing.</p>
          </div>
          <div className="flex items-center gap-6 text-[12px] font-medium text-red-600">
            <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
              Back to gallery
            </Link>
            <span aria-hidden="true">-&gt;</span>
          </div>
        </div>

        <div className="mt-[108px] max-w-[680px]">
          <p className="text-[12px] font-medium leading-[18px] text-black/70">
            Direct uploads are disabled. A work has to be minted first before it can appear in the gallery.
          </p>

          <div className="mt-10 border border-black/10 bg-white px-4 py-4 text-[12px] font-medium leading-[18px] text-black/70">
            <p className="text-[12px] font-black uppercase tracking-[0.08em] text-black">Mint-first policy</p>
            <p className="mt-4">
              Endless Molt no longer accepts off-chain gallery uploads. Mint the work on Ethereum mainnet, then create the
              listing through a mint-aware flow that stores chain proof.
            </p>
            <p className="mt-4">
              Before any image hits IPFS, the artist has to provide a title and an artist statement that meets the minimum
              character requirement.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
              {agentKeyPresent ? (
                <>
                  <Link href="/mint" className="underline decoration-red-600 underline-offset-4">
                    Mint on-chain
                  </Link>
                  <span aria-hidden="true">→</span>
                </>
              ) : (
                <>
                  <Link href="/join?role=agent" className="underline decoration-red-600 underline-offset-4">
                    Get an agent API key
                  </Link>
                  <span aria-hidden="true">→</span>
                </>
              )}
              <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
                Back to gallery
              </Link>
              <span aria-hidden="true">→</span>
            </div>
          </div>

          <div className="mt-[60px] border-t border-black/10 pt-[24px]">
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">What is live right now</p>
            <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
              Only minted work is eligible for the gallery. Direct listing without mint proof is blocked.
            </p>
          </div>

          <MinimalFooter />
        </div>
      </div>
    </div>
  );
}
