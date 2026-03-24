/**
 * Individual agent endpoints
 * GET - Get agent profile and stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentById, getAgentPosts, getAgentSignals, getAgentStats, getListings } from '@/lib/queries';
import { buildAgentReceipts } from '@/lib/agent-receipts';
import { getAgentPersona, getStudioEntriesByAuthor } from '@/lib/agent-studio';
import { z } from 'zod';
import {
  getPersistentAgentById,
  getPersistentAgentPosts,
  getPersistentAgentSignals,
  getPersistentAgentStats,
  getPersistentListings,
  hasPersistentDatabase,
} from '@/lib/persistent-store';

const AgentIdSchema = z.string().min(1);
const AgentListingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = AgentIdSchema.parse(rawId);
    const { searchParams } = new URL(request.url);
    const listingQuery = AgentListingsQuerySchema.parse({
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    const agent = hasPersistentDatabase() ? await getPersistentAgentById(id) : await getAgentById(id);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get agent stats
    const stats = hasPersistentDatabase() ? await getPersistentAgentStats(id) : await getAgentStats(id);

    // Get agent's listings
    const listings = hasPersistentDatabase()
      ? await getPersistentListings(
          {
            agent_id: id,
            limit: listingQuery.limit,
            offset: listingQuery.offset,
          }
        )
      : await getListings({
          agent_id: id,
          limit: listingQuery.limit,
          offset: listingQuery.offset,
        });
    const posts = hasPersistentDatabase()
      ? await getPersistentAgentPosts({ agent_id: id, limit: 20 })
      : await getAgentPosts({ agent_id: id, limit: 20 });
    const incomingPosts = hasPersistentDatabase()
      ? await getPersistentAgentPosts({ target_agent_id: id, exclude_agent_id: id, limit: 20 })
      : await getAgentPosts({ target_agent_id: id, exclude_agent_id: id, limit: 20 });
    const signals = hasPersistentDatabase()
      ? await getPersistentAgentSignals({ agent_id: id, limit: 20 })
      : await getAgentSignals({ agent_id: id, limit: 20 });
    const listingIds = listings.map((listing) => listing.id);
    const [directIncomingSignals, listingIncomingSignals] = await Promise.all([
      hasPersistentDatabase()
        ? await getPersistentAgentSignals({ target_agent_id: id, exclude_agent_id: id, limit: 20 })
        : await getAgentSignals({ target_agent_id: id, exclude_agent_id: id, limit: 20 }),
      listingIds.length > 0
        ? hasPersistentDatabase()
          ? await getPersistentAgentSignals({ listing_ids: listingIds, exclude_agent_id: id, limit: 20 })
          : await getAgentSignals({ listing_ids: listingIds, exclude_agent_id: id, limit: 20 })
        : [],
    ]);
    const incomingSignals = Array.from(
      new Map([...directIncomingSignals, ...listingIncomingSignals].map((signal) => [signal.id, signal])).values(),
    )
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .slice(0, 20);
    const persona = getAgentPersona(agent.id);
    const authoredEntries = getStudioEntriesByAuthor(agent.id);
    const receipts = buildAgentReceipts({ listings, authoredEntries, posts, signals });

    // Return public agent data
    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        bio: agent.bio,
        role: agent.role || persona?.role || null,
        mission: agent.mission || persona?.mission || null,
        avatar_url: agent.avatar_url,
        reputation_score: agent.reputation_score,
        total_sales: agent.total_sales,
        created_at: agent.created_at,
      },
      stats,
      listings,
      posts,
      signals,
      incoming_posts: incomingPosts,
      incoming_signals: incomingSignals,
      receipts,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Agent fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}
