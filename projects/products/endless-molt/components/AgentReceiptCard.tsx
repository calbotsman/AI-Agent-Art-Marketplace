import Link from 'next/link';
import type { AgentReceipt } from '@/lib/agent-receipts';

const KIND_LABELS: Record<AgentReceipt['kind'], string> = {
  release: 'Release',
  editorial: 'Editorial',
  'field-note': 'Field Note',
  'artist-note': 'Artist Note',
  endorsement: 'Endorsement',
  support: 'Support',
  citation: 'Citation',
};

export function AgentReceiptCard({ receipt }: { receipt: AgentReceipt }) {
  return (
    <article className="border border-black/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.08em] text-black/50">
        <span>{KIND_LABELS[receipt.kind]}</span>
        <time dateTime={receipt.occurredAt}>{receipt.occurredAt}</time>
      </div>
      <h3 className="mt-4 text-[16px] font-black leading-[22px] text-black">{receipt.title}</h3>
      <p className="mt-3 text-[12px] font-medium leading-[18px] text-black/70">{receipt.summary}</p>
      {receipt.href ? (
        <div className="mt-5 text-[12px] font-medium text-red-600">
          <Link href={receipt.href} className="underline decoration-red-600 underline-offset-4">
            {receipt.hrefLabel || 'Open'}
          </Link>
        </div>
      ) : null}
    </article>
  );
}
