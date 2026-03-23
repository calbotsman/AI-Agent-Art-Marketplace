import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgent } from '@/lib/auth';
import {
  createAgentSignal,
  getAgentById,
  getAgentPostById,
  getAgentSignals,
  getListingById,
} from '@/lib/queries';
import {
  createPersistentAgentSignal,
  getPersistentAgentById,
  getPersistentAgentPostById,
  getPersistentAgentSignals,
  getPersistentListingById,
  hasPersistentDatabase,
} from '@/lib/persistent-store';
import { getErrorMessage } from '@/lib/safe';

const SignalSchema = z.object({
  listing_id: z.string().trim().min(1).optional(),
  target_agent_id: z.string().trim().min(1).optional(),
  target_post_id: z.string().trim().min(1).optional(),
  signal_type: z.enum(['endorse', 'support', 'cite']),
  note: z.string().trim().min(1).max(500).optional(),
}).refine((value) => Boolean(value.listing_id || value.target_agent_id || value.target_post_id), {
  message: 'A signal must point at a listing, agent, or post.',
  path: ['listing_id'],
});

const SignalQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  agent_id: z.string().trim().min(1).optional(),
  listing_id: z.string().trim().min(1).optional(),
  target_agent_id: z.string().trim().min(1).optional(),
  target_post_id: z.string().trim().min(1).optional(),
  signal_type: z.enum(['endorse', 'support', 'cite']).optional(),
  exclude_agent_id: z.string().trim().min(1).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = SignalQuerySchema.parse({
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      agent_id: searchParams.get('agent_id') || undefined,
      listing_id: searchParams.get('listing_id') || undefined,
      target_agent_id: searchParams.get('target_agent_id') || undefined,
      target_post_id: searchParams.get('target_post_id') || undefined,
      signal_type: searchParams.get('signal_type') || undefined,
      exclude_agent_id: searchParams.get('exclude_agent_id') || undefined,
    });

    const signals = hasPersistentDatabase()
      ? await getPersistentAgentSignals(parsed)
      : getAgentSignals(parsed);

    return NextResponse.json({ signals, count: signals.length });
  } catch (error: unknown) {
    console.error('Signals fetch error:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to fetch signals') }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const agent = await requireAgent(request);
    const body = await request.json();
    const data = SignalSchema.parse(body);

    if (data.listing_id) {
      const listing = hasPersistentDatabase()
        ? await getPersistentListingById(data.listing_id)
        : getListingById(data.listing_id);
      if (!listing) {
        return NextResponse.json({ error: 'Referenced listing not found' }, { status: 404 });
      }
    }

    if (data.target_agent_id) {
      const targetAgent = hasPersistentDatabase()
        ? await getPersistentAgentById(data.target_agent_id)
        : getAgentById(data.target_agent_id);
      if (!targetAgent) {
        return NextResponse.json({ error: 'Referenced agent not found' }, { status: 404 });
      }
    }

    if (data.target_post_id) {
      const targetPost = hasPersistentDatabase()
        ? await getPersistentAgentPostById(data.target_post_id)
        : getAgentPostById(data.target_post_id);
      if (!targetPost) {
        return NextResponse.json({ error: 'Referenced post not found' }, { status: 404 });
      }
    }

    const signal = hasPersistentDatabase()
      ? await createPersistentAgentSignal({
          agent_id: agent.id,
          ...data,
        })
      : createAgentSignal({
          agent_id: agent.id,
          ...data,
        });

    return NextResponse.json({ signal }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }

    const message = getErrorMessage(error, 'Failed to create signal');
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    console.error('Signal creation error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
