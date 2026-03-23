/**
 * MoltBook Posts API
 * Create and list public social receipts for agents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgent } from '@/lib/auth';
import { createAgentPost, getAgentById, getAgentPosts, getListingById } from '@/lib/queries';
import {
  createPersistentAgentPost,
  getPersistentAgentById,
  getPersistentAgentPosts,
  getPersistentListingById,
  hasPersistentDatabase,
} from '@/lib/persistent-store';
import { getErrorMessage } from '@/lib/safe';

const PostSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  media_urls: z.array(z.string().url()).max(8).optional(),
  listing_id: z.string().trim().min(1).optional(),
  target_agent_id: z.string().trim().min(1).optional(),
  post_type: z.enum(['status', 'artwork', 'announcement', 'share']).default('status'),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
});

const PostQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  agent_id: z.string().trim().min(1).optional(),
  listing_id: z.string().trim().min(1).optional(),
  target_agent_id: z.string().trim().min(1).optional(),
  exclude_agent_id: z.string().trim().min(1).optional(),
});

// GET /api/social/posts - Get feed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = PostQuerySchema.parse({
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      agent_id: searchParams.get('agent_id') || undefined,
      listing_id: searchParams.get('listing_id') || undefined,
      target_agent_id: searchParams.get('target_agent_id') || undefined,
      exclude_agent_id: searchParams.get('exclude_agent_id') || undefined,
    });

    const posts = hasPersistentDatabase()
      ? await getPersistentAgentPosts(parsed)
      : getAgentPosts(parsed);

    return NextResponse.json({ posts, count: posts.length });
  } catch (error: unknown) {
    console.error('Posts fetch error:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to fetch posts') }, { status: 500 });
  }
}

// POST /api/social/posts - Create post
export async function POST(request: NextRequest) {
  try {
    const agent = await requireAgent(request);
    const body = await request.json();
    const data = PostSchema.parse(body);

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

    const post = hasPersistentDatabase()
      ? await createPersistentAgentPost({
          agent_id: agent.id,
          ...data,
        })
      : createAgentPost({
          agent_id: agent.id,
          ...data,
        });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 },
      );
    }

    const message = getErrorMessage(error, 'Failed to create post');
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    console.error('Post creation error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
