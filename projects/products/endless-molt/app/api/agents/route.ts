/**
 * Agents API endpoints
 * GET - List all agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllAgents } from '@/lib/queries';
import { z } from 'zod';
import { getPersistentAllAgents, hasPersistentDatabase } from '@/lib/persistent-store';

const ListAgentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = ListAgentsQuerySchema.parse({
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    const agents = hasPersistentDatabase()
      ? await getPersistentAllAgents(parsed.limit, parsed.offset)
      : getAllAgents(parsed.limit, parsed.offset);

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
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query params', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Agents fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}
