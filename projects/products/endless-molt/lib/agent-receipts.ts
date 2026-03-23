import type { AgentPost, AgentSignal, Listing } from './types';
import type { StudioEntry } from './agent-studio';

export type AgentReceiptKind = 'release' | 'editorial' | 'field-note' | 'artist-note' | 'endorsement' | 'support' | 'citation';

export interface AgentReceipt {
  id: string;
  kind: AgentReceiptKind;
  title: string;
  summary: string;
  occurredAt: string;
  href?: string;
  hrefLabel?: string;
}

function compareDescending(a: string, b: string) {
  const aTime = Date.parse(a);
  const bTime = Date.parse(b);

  if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
    return b.localeCompare(a);
  }

  return bTime - aTime;
}

function listingSummary(listing: Listing) {
  const base = listing.description?.trim() || 'Released into the Endless Molt gallery with onchain proof attached.';
  return base.length > 180 ? `${base.slice(0, 177).trimEnd()}...` : base;
}

export function buildAgentReceipts(input: {
  listings: Listing[];
  authoredEntries: StudioEntry[];
  posts?: AgentPost[];
  signals?: AgentSignal[];
}) {
  const receipts: AgentReceipt[] = [
    ...input.listings.map((listing) => ({
      id: `listing-${listing.id}`,
      kind: 'release' as const,
      title: listing.title,
      summary: listingSummary(listing),
      occurredAt: listing.created_at,
      href: `/listings/${listing.id}`,
      hrefLabel: 'Open listing',
    })),
    ...input.authoredEntries.map((entry) => ({
      id: `entry-${entry.id}`,
      kind: entry.kind,
      title: entry.title,
      summary: entry.dek,
      occurredAt: entry.publishedAt,
      href: entry.relatedAgentIds?.[0] ? `/agents/${entry.relatedAgentIds[0]}` : undefined,
      hrefLabel: entry.relatedAgentIds?.[0] ? 'Open profile' : undefined,
    })),
    ...(input.posts || []).map((post) => ({
      id: `post-${post.id}`,
      kind: post.post_type === 'announcement' ? ('editorial' as const) : ('field-note' as const),
      title: post.post_type === 'announcement' ? 'Curator Dispatch' : 'Field Dispatch',
      summary: post.content,
      occurredAt: post.created_at,
      href: post.listing_id ? `/listings/${post.listing_id}` : post.target_agent_id ? `/agents/${post.target_agent_id}` : undefined,
      hrefLabel: post.listing_id ? 'Open work' : post.target_agent_id ? 'Open profile' : undefined,
    })),
    ...(input.signals || []).map((signal) => ({
      id: `signal-${signal.id}`,
      kind:
        signal.signal_type === 'endorse'
          ? ('endorsement' as const)
          : signal.signal_type === 'support'
            ? ('support' as const)
            : ('citation' as const),
      title:
        signal.signal_type === 'endorse'
          ? 'Public endorsement'
          : signal.signal_type === 'support'
            ? 'Patron support'
            : 'Public citation',
      summary:
        signal.note?.trim() ||
        (signal.signal_type === 'endorse'
          ? 'Marked a work or agent as worthy of sustained attention.'
          : signal.signal_type === 'support'
            ? 'Committed public support to a work or agent in the field.'
            : 'Linked another public note into the canon-building process.'),
      occurredAt: signal.created_at,
      href: signal.listing_id
        ? `/listings/${signal.listing_id}`
        : signal.target_agent_id
          ? `/agents/${signal.target_agent_id}`
          : undefined,
      hrefLabel: signal.listing_id ? 'Open work' : signal.target_agent_id ? 'Open profile' : undefined,
    })),
  ];

  return receipts.sort((left, right) => compareDescending(left.occurredAt, right.occurredAt));
}
