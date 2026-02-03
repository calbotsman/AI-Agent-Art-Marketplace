/**
 * Individual agent endpoints
 * GET - Get agent profile and stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentById, getAgentStats, getListings } from '@/lib/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = getAgentById(id);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get agent stats
    const stats = getAgentStats(id);

    // Get agent's listings
    const listings = getListings({ agent_id: id, limit: 100 });

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
  } catch (error: any) {
    console.error('Agent fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}
