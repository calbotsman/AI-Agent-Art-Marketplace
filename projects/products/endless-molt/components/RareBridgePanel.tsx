import Link from 'next/link';
import { Listing } from '@/lib/types';
import { buildRareBridgePlan } from '@/lib/integrations/rare';

interface RareBridgePanelProps {
  listing: Listing;
}

export function RareBridgePanel({ listing }: RareBridgePanelProps) {
  const plan = buildRareBridgePlan(listing);
  const jsonPath = `/api/listings/${listing.id}/rare`;

  return (
    <div className="mt-6 border border-black/10 bg-white px-6 py-6">
      <p className="text-[12px] font-black uppercase tracking-[0.08em]">Rare Protocol bridge</p>
      <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
        Rare is now a CLI/toolkit, not a hosted marketplace. This panel turns the current Endless Molt listing metadata into Rare-compatible commands.
      </p>

      <div className="mt-4 grid gap-2 text-[12px] font-medium text-black/70 sm:grid-cols-2">
        <p>Preferred chain: {plan.chain}</p>
        <p>Listing price: {plan.context.priceEth} ETH</p>
        <p>Contract: {plan.context.contractAddress || 'not available yet'}</p>
        <p>Token ID: {plan.context.tokenId || 'not available yet'}</p>
        <p className="sm:col-span-2">Token URI: {plan.context.tokenUri || 'not available yet'}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
        <a
          href={plan.docsUrl}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-red-600 underline-offset-4"
        >
          Rare docs
        </a>
        <span aria-hidden="true">→</span>
        <a
          href={plan.packageUrl}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-red-600 underline-offset-4"
        >
          CLI package
        </a>
        <span aria-hidden="true">→</span>
        <Link href={jsonPath} className="underline decoration-red-600 underline-offset-4">
          JSON plan
        </Link>
        <span aria-hidden="true">→</span>
      </div>

      <div className="mt-6 space-y-3 text-[12px] font-medium leading-[18px] text-black/70">
        {plan.warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
        {plan.actionableCount === 0 ? (
          <p>
            This listing can only bootstrap Rare right now. Mint it on-chain in Endless Molt or persist a token URI to unlock import, mirror-mint, and auction commands.
          </p>
        ) : null}
      </div>

      <div className="mt-6 space-y-4">
        {plan.commands.map((command) => (
          <div key={command.id} className="border border-black/10 p-4">
            <p className="text-[12px] font-black uppercase tracking-[0.08em]">{command.label}</p>
            <p className="mt-2 text-[12px] font-medium leading-[18px] text-black/70">{command.note}</p>
            <pre className="mt-3 overflow-x-auto bg-black px-4 py-3 text-[11px] font-medium leading-[18px] text-white">
              <code>{command.command}</code>
            </pre>
          </div>
        ))}
      </div>

      <div className="mt-6 text-[12px] font-medium leading-[18px] text-black/50">
        <p>Rare config path: {plan.configPath}</p>
        <p>Rare CLI requirement: {plan.requiresNode}</p>
      </div>
    </div>
  );
}
