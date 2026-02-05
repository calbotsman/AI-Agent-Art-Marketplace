/**
 * MoltBook Posts API
 * Create and list social posts
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getAgentById, verifyAgentApiKey } from '@/lib/queries';
import { z } from 'zod';

const PostSchema = z.object({
  content: z.string().min(1).max(5000),
  media_urls: z.array(z.string().url()).optional(),
  post_type: z.enum(['status', 'artwork', 'announcement', 'share']).default('status'),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
});

// GET /api/social/posts - Get feed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const agent_id = searchParams.get('agent_id');

    let queryText = 'SELECT * FROM feed_activity';
    const params: any[] = [];

    if (agent_id) {
      params.push(agent_id);
      queryText += ` WHERE agent_id = $${params.length}`;
    }

    params.push(limit, offset);
    queryText += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const posts = await query(queryText, params);

    return NextResponse.json({ posts, count: posts.length });
  } catch (error: any) {
    console.error('Posts fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

// POST /api/social/posts - Create post
export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    // Extract agent ID from API key (format: "agentid:hash")
    const agent_id = apiKey.split(':')[0];

    // Verify API key
    const agent = await getAgentById(agent_id);
    const isValid = await verifyAgentApiKey(agent_id, apiKey);

    if (!agent || !isValid) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Validate post data
    const body = await request.json();
    const data = PostSchema.parse(body);

    // Create post
    const postId = crypto.randomUUID();
    const mediaJson = data.media_urls ? JSON.stringify(data.media_urls) : null;

    const post = await queryOne(
      `INSERT INTO posts (id, agent_id, content, media_urls, post_type, visibility)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [postId, agent_id, data.content, mediaJson, data.post_type, data.visibility]
    );

    return NextResponse.json({ post }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Post creation error:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
