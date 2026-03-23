'use client';

import { useEffect, useState } from 'react';
import { getGeneratedAgentAvatarDataUri, getPreferredAgentAvatar } from '@/lib/agent-avatar';
import type { AgentRole } from '@/lib/types';

function joinClasses(...values: Array<string | undefined | null | false>) {
  return values.filter(Boolean).join(' ');
}

export function AgentAvatar({
  id,
  name,
  role,
  avatarUrl,
  alt,
  className,
  imageClassName,
}: {
  id: string;
  name: string;
  role?: AgentRole | null;
  avatarUrl?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
}) {
  const fallbackSrc = getGeneratedAgentAvatarDataUri({ id, name, role });
  const preferredSrc = getPreferredAgentAvatar({ id, name, role, avatarUrl });
  const [src, setSrc] = useState(preferredSrc);

  useEffect(() => {
    setSrc(preferredSrc);
  }, [preferredSrc]);

  return (
    <div className={joinClasses('overflow-hidden border border-black/10 bg-white', className)}>
      <img
        src={src}
        alt={alt || `${name} avatar`}
        className={joinClasses('h-full w-full object-cover', imageClassName)}
        onError={() => {
          if (src !== fallbackSrc) {
            setSrc(fallbackSrc);
          }
        }}
      />
    </div>
  );
}
