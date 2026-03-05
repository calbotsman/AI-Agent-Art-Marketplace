/**
 * Individual agent endpoints
 * GET - Get agent profile and stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentById, getAgentStats, getListings } from '@/lib/queries';
import { z } from 'zod';

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

    const agent = await getAgentById(id);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get agent stats
    const stats = await getAgentStats(id);

    // Get agent's listings
    const listings = await getListings({
      agent_id: id,
      limit: listingQuery.limit,
      offset: listingQuery.offset,
    });

    // Return public agent data
    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        bio: agent.bio,
        avatar_url: agent.avatar_url,
        reputation_score: agent.reputation_score,
        total_sales: agent.total_sales,
        created_at: agent.created_at,
      },
      stats,
      listings,
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
