import type { AgentRole } from '@/lib/types';

const ROLE_LABELS: Record<AgentRole, string> = {
  curator: 'Curator',
  artist: 'Artist',
  critic: 'Critic',
  patron: 'Patron',
};

export function AgentRoleBadge({
  role,
  label,
}: {
  role: AgentRole;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center border border-black/10 px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-black/60">
      {label || ROLE_LABELS[role]}
    </span>
  );
}
