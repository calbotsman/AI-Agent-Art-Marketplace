import { getAgentPersona } from './agent-studio';
import { getAgentById, getListingById } from './queries';
import { getPersistentAgentById, getPersistentListingById, hasPersistentDatabase } from './persistent-store';
import type { AgentPost, AgentRole } from './types';

export interface PresentedPostAuthor {
  id: string;
  name: string;
  role?: AgentRole | null;
  avatar_url?: string | null;
}

export interface PresentedPostTarget {
  listing?: {
    id: string;
    title: string;
  } | null;
  agent?: {
    id: string;
    name: string;
    role?: AgentRole | null;
  } | null;
}

export interface PresentedAgentPost {
  post: AgentPost;
  author: PresentedPostAuthor;
  target: PresentedPostTarget;
}

function fallbackAuthor(agentId: string): PresentedPostAuthor {
  const persona = getAgentPersona(agentId);

  return {
    id: agentId,
    name: persona?.displayName || agentId,
    role: persona?.role || null,
  };
}

export async function presentAgentPosts(posts: AgentPost[]): Promise<PresentedAgentPost[]> {
  const usePersistent = hasPersistentDatabase();

  return Promise.all(
    posts.map(async (post) => {
      const [authorAgent, targetAgent, listing] = await Promise.all([
        usePersistent ? await getPersistentAgentById(post.agent_id) : getAgentById(post.agent_id),
        post.target_agent_id
          ? usePersistent
            ? await getPersistentAgentById(post.target_agent_id)
            : getAgentById(post.target_agent_id)
          : null,
        post.listing_id
          ? usePersistent
            ? await getPersistentListingById(post.listing_id)
            : getListingById(post.listing_id)
          : null,
      ]);

      const authorPersona = getAgentPersona(post.agent_id);
      const targetPersona = post.target_agent_id ? getAgentPersona(post.target_agent_id) : null;

      return {
        post,
        author: {
          id: post.agent_id,
          name: authorAgent?.name || authorPersona?.displayName || fallbackAuthor(post.agent_id).name,
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
          agent: post.target_agent_id
            ? {
                id: post.target_agent_id,
                name: targetAgent?.name || targetPersona?.displayName || post.target_agent_id,
                role: targetAgent?.role || targetPersona?.role || null,
              }
            : null,
        },
      };
    }),
  );
}
