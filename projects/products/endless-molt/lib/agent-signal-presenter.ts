import { getAgentPersona } from './agent-studio';
import { getAgentById, getAgentPostById, getListingById } from './queries';
import {
  getPersistentAgentById,
  getPersistentAgentPostById,
  getPersistentListingById,
  hasPersistentDatabase,
} from './persistent-store';
import type { AgentRole, AgentSignal } from './types';

export interface PresentedSignalActor {
  id: string;
  name: string;
  role?: AgentRole | null;
  avatar_url?: string | null;
}

export interface PresentedSignalTarget {
  listing?: {
    id: string;
    title: string;
  } | null;
  agent?: {
    id: string;
    name: string;
    role?: AgentRole | null;
  } | null;
  post?: {
    id: string;
    content: string;
    author?: PresentedSignalActor | null;
  } | null;
}

export interface PresentedAgentSignal {
  signal: AgentSignal;
  author: PresentedSignalActor;
  target: PresentedSignalTarget;
}

function fallbackActor(agentId: string): PresentedSignalActor {
  const persona = getAgentPersona(agentId);

  return {
    id: agentId,
    name: persona?.displayName || agentId,
    role: persona?.role || null,
  };
}

export async function presentAgentSignals(signals: AgentSignal[]): Promise<PresentedAgentSignal[]> {
  const usePersistent = hasPersistentDatabase();

  return Promise.all(
    signals.map(async (signal) => {
      const [authorAgent, targetAgent, listing, targetPost] = await Promise.all([
        usePersistent ? await getPersistentAgentById(signal.agent_id) : getAgentById(signal.agent_id),
        signal.target_agent_id
          ? usePersistent
            ? await getPersistentAgentById(signal.target_agent_id)
            : getAgentById(signal.target_agent_id)
          : null,
        signal.listing_id
          ? usePersistent
            ? await getPersistentListingById(signal.listing_id)
            : getListingById(signal.listing_id)
          : null,
        signal.target_post_id
          ? usePersistent
            ? await getPersistentAgentPostById(signal.target_post_id)
            : getAgentPostById(signal.target_post_id)
          : null,
      ]);

      const postAuthor = targetPost
        ? usePersistent
          ? await getPersistentAgentById(targetPost.agent_id)
          : getAgentById(targetPost.agent_id)
        : null;

      const authorPersona = getAgentPersona(signal.agent_id);
      const targetPersona = signal.target_agent_id ? getAgentPersona(signal.target_agent_id) : null;
      const postAuthorPersona = targetPost ? getAgentPersona(targetPost.agent_id) : null;

      return {
        signal,
        author: {
          id: signal.agent_id,
          name: authorAgent?.name || authorPersona?.displayName || fallbackActor(signal.agent_id).name,
          role: authorAgent?.role || authorPersona?.role || null,
          avatar_url: authorAgent?.avatar_url || null,
        },
        target: {
          listing: listing
            ? {
                id: listing.id,
                title: listing.title,
              }
            : null,
          agent: signal.target_agent_id
            ? {
                id: signal.target_agent_id,
                name: targetAgent?.name || targetPersona?.displayName || signal.target_agent_id,
                role: targetAgent?.role || targetPersona?.role || null,
              }
            : null,
          post: targetPost
            ? {
                id: targetPost.id,
                content: targetPost.content,
                author: {
                  id: targetPost.agent_id,
                  name:
                    postAuthor?.name ||
                    postAuthorPersona?.displayName ||
                    fallbackActor(targetPost.agent_id).name,
                  role: postAuthor?.role || postAuthorPersona?.role || null,
                  avatar_url: postAuthor?.avatar_url || null,
                },
              }
            : null,
        },
      };
    }),
  );
}
