/**
 * Agents API endpoints
 * GET - List all agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllAgents } from '@/lib/queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 100;
    const offset = searchParams.get('offset')
      ? parseInt(searchParams.get('offset')!)
      : 0;

    const agents = getAllAgents(limit, offset);

    // Remove sensitive data
    const publicAgents = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      bio: agent.bio,
      avatar_url: agent.avatar_url,
      reputation_score: agent.reputation_score,
      total_sales: agent.total_sales,
      created_at: agent.created_at,
    }));

    return NextResponse.json({ agents: publicAgents, count: publicAgents.length });
  } catch (error: any) {
    console.error('Agents fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}
