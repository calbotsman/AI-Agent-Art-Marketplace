/**
 * Moltx API Client for Endless Molt
 * Handles agent registration, posting, and token launches
 */

import { getErrorMessage } from './safe';

const MOLTX_API_BASE = 'https://moltx.io/v1';

export interface MoltxAgent {
  id: string;
  name: string;
  display_name: string;
  description: string;
  avatar_emoji: string;
  owner_handle: string | null;
  claim_status: 'pending' | 'claimed';
}

export interface MoltxPost {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  like_count: number;
  reply_count: number;
  impression_count: number;
}

export interface TokenLaunchPost {
  name: string;
  symbol: string;
  wallet: string;
  description: string;
  image: string;
  twitter?: string;
  website?: string;
}

export interface MoltxApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type MoltxRegisterPayload = {
  data?: {
    agent: MoltxAgent;
    api_key: string;
    claim: unknown;
  };
  error?: string;
};

type MoltxPostPayload = {
  data?: {
    id: string;
  };
  error?: string;
};

type MoltxPostDetailPayload = {
  data?: {
    post: MoltxPost;
  };
  error?: string;
};

type ClawnchLaunch = {
  address: string;
  symbol: string;
  name: string;
  clankerUrl: string;
  launchedAt: string;
};

type ClawnchLaunchResponse = {
  pagination: {
    total: number;
  };
  launches: ClawnchLaunch[];
};

/**
 * Register a new agent on Moltx
 */
export async function registerMoltxAgent(params: {
  name: string;
  display_name: string;
  description: string;
  avatar_emoji?: string;
}): Promise<MoltxApiResponse<{ agent: MoltxAgent; api_key: string; claim: unknown }>> {
  try {
    const response = await fetch(`${MOLTX_API_BASE}/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.name,
        display_name: params.display_name,
        description: params.description,
        avatar_emoji: params.avatar_emoji || '🎨',
      }),
    });

    const data = (await response.json()) as MoltxRegisterPayload;

    if (!response.ok || !data.data) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      data: {
        agent: data.data.agent,
        api_key: data.data.api_key,
        claim: data.data.claim,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to register agent'),
    };
  }
}

/**
 * Create a post on Moltx
 */
export async function createMoltxPost(
  apiKey: string,
  content: string
): Promise<MoltxApiResponse<{ id: string }>> {
  try {
    const response = await fetch(`${MOLTX_API_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    const data = (await response.json()) as MoltxPostPayload;

    if (!response.ok || !data.data) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      data: { id: data.data.id },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to create post'),
    };
  }
}

/**
 * Format a token launch post for Clawnch
 */
export function formatTokenLaunchPost(params: TokenLaunchPost): string {
  let post = `!clawnch\n`;
  post += `name: ${params.name}\n`;
  post += `symbol: ${params.symbol}\n`;
  post += `wallet: ${params.wallet}\n`;
  post += `description: ${params.description}\n`;
  post += `image: ${params.image}`;

  if (params.twitter) {
    post += `\ntwitter: ${params.twitter}`;
  }

  if (params.website) {
    post += `\nwebsite: ${params.website}`;
  }

  return post;
}

/**
 * Launch a token for an artist via Moltx
 * Returns the post ID which can be used to monitor deployment
 */
export async function launchArtistToken(
  apiKey: string,
  params: TokenLaunchPost
): Promise<MoltxApiResponse<{ post_id: string; post_url: string }>> {
  const content = formatTokenLaunchPost(params);

  const result = await createMoltxPost(apiKey, content);

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to create post',
    };
  }

  return {
    success: true,
    data: {
      post_id: result.data.id,
      post_url: `https://moltx.io/posts/${result.data.id}`,
    },
  };
}

/**
 * Get post details from Moltx
 */
export async function getMoltxPost(
  apiKey: string,
  postId: string
): Promise<MoltxApiResponse<MoltxPost>> {
  try {
    const response = await fetch(`${MOLTX_API_BASE}/posts/${postId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const data = (await response.json()) as MoltxPostDetailPayload;

    if (!response.ok || !data.data) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      data: data.data.post,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to get post'),
    };
  }
}

/**
 * Check Clawnch API for token deployment status
 */
export async function checkTokenDeployment(
  agentName: string
): Promise<MoltxApiResponse<{
  deployed: boolean;
  token?: {
    address: string;
    symbol: string;
    name: string;
    clanker_url: string;
    launched_at: string;
  };
}>> {
  try {
    const response = await fetch(
      `https://clawn.ch/api/launches?agent=${encodeURIComponent(agentName)}`
    );

    const data = (await response.json()) as ClawnchLaunchResponse;

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    if (data.pagination.total === 0) {
      return {
        success: true,
        data: { deployed: false },
      };
    }

    const launch = data.launches[0];

    return {
      success: true,
      data: {
        deployed: true,
        token: {
          address: launch.address,
          symbol: launch.symbol,
          name: launch.name,
          clanker_url: launch.clankerUrl,
          launched_at: launch.launchedAt,
        },
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to check deployment'),
    };
  }
}

/**
 * Get token stats from Clawnch API
 */
export async function getTokenStats(contractAddress: string): Promise<ClawnchLaunch | null> {
  try {
    const response = await fetch(
      `https://clawn.ch/api/launches?address=${contractAddress}`
    );

    const data = (await response.json()) as ClawnchLaunchResponse;

    if (!response.ok || data.launches.length === 0) {
      return null;
    }

    return data.launches[0];
  } catch {
    return null;
  }
}

const moltxClient = {
  registerMoltxAgent,
  createMoltxPost,
  launchArtistToken,
  checkTokenDeployment,
  getTokenStats,
  formatTokenLaunchPost,
};

export default moltxClient;
