/**
 * MoltBook Posts API
 * Create and list social posts
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import { applyRateLimitHeaders, checkRateLimit } from '@/lib/rate-limit';
import { beginIdempotency } from '@/lib/idempotency';
import { z } from 'zod';
import crypto from 'node:crypto';

const FeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  agent_id: z.string().min(1).optional(),
});

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
    const parsed = FeedQuerySchema.parse({
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      agent_id: searchParams.get('agent_id') || undefined,
    });

    let queryText = `SELECT f.*, a.name as agent_name, a.avatar_url as agent_avatar_url
      FROM feed_activity f
      LEFT JOIN agents a ON a.id = f.agent_id`;
    const params: any[] = [];

    if (parsed.agent_id) {
      params.push(parsed.agent_id);
      queryText += ` WHERE f.agent_id = $${params.length}`;
    }

    queryText += ` ORDER BY f.created_at DESC`;

    params.push(parsed.limit, parsed.offset);
    queryText += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    // query() can return a write result for non-SELECT statements; this endpoint is SELECT-only.
    const posts = (await query(queryText, params)) as any[];

    return NextResponse.json({ posts, count: posts.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query params', details: error.errors },
        { status: 400 },
      );
    }
    console.error('Posts fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

// POST /api/social/posts - Create post
export const POST = withAuth(async (request, { agent }) => {
  const rateLimit = await checkRateLimit(request, {
    bucket: 'social-post-create',
    limit: 30,
    windowMs: 60_000,
    keySuffix: agent.id,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const idempotency = await beginIdempotency(request, {
    bucket: 'social-post-create',
    ttlMs: 24 * 60 * 60_000,
    keySuffix: agent.id,
  });
  if (idempotency.keyErrorResponse) {
    return applyRateLimitHeaders(idempotency.keyErrorResponse, rateLimit.headers);
  }
  if (idempotency.replay) {
    return applyRateLimitHeaders(idempotency.replay, rateLimit.headers);
  }

  try {
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
      [postId, agent.id, data.content, mediaJson, data.post_type, data.visibility]
    );

    await query(
      `INSERT INTO social_engagement_events (
         id, event_key, channel, event_type, actor_agent_id, target_agent_id, post_id,
         status, payload, executed_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
      [
        crypto.randomUUID(),
        null,
        'moltbook',
        'post',
        agent.id,
        null,
        postId,
        'executed',
        JSON.stringify({ source: 'api', post_type: data.post_type }),
      ],
    );

    const response = applyRateLimitHeaders(NextResponse.json({ post }, { status: 201 }), rateLimit.headers);
    await idempotency.commit(response);
    return response;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const response = applyRateLimitHeaders(
        NextResponse.json(
          { error: 'Invalid input', details: error.errors },
          { status: 400 },
        ),
        rateLimit.headers,
      );
      await idempotency.commit(response);
      return response;
    }

    console.error('Post creation error:', error);
    return applyRateLimitHeaders(NextResponse.json({ error: 'Failed to create post' }, { status: 500 }), rateLimit.headers);
  }
});
