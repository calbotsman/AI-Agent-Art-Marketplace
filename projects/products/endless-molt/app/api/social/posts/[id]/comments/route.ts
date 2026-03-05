import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { applyRateLimitHeaders, checkRateLimit } from '@/lib/rate-limit';
import { beginIdempotency } from '@/lib/idempotency';
import crypto from 'node:crypto';

const CommentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const CreateCommentSchema = z.object({
  content: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(2000)),
  parent_comment_id: z.string().uuid().optional(),
  channel: z.enum(['moltbook', 'x', 'bot-network']).default('moltbook'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const parsed = CommentQuerySchema.parse({
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    const post = await queryOne<{ id: string }>('SELECT id FROM posts WHERE id = $1', [id]);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const comments = (await query(
      `SELECT c.*, a.name as agent_name, a.avatar_url as agent_avatar_url
       FROM post_comments c
       LEFT JOIN agents a ON a.id = c.agent_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [id, parsed.limit, parsed.offset],
    )) as Array<Record<string, unknown>>;

    return NextResponse.json({ comments, count: comments.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query params', details: error.errors },
        { status: 400 },
      );
    }

    console.error('Post comments fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export const POST = withAuth<{ params: Promise<{ id: string }> }>(async (request, { params, agent }) => {
  const rateLimit = await checkRateLimit(request, {
    bucket: 'social-post-comment-create',
    limit: 90,
    windowMs: 60_000,
    keySuffix: agent.id,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const idempotency = await beginIdempotency(request, {
    bucket: 'social-post-comment-create',
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
    const { id } = await params;
    const body = await request.json();
    const data = CreateCommentSchema.parse(body);

    const post = await queryOne<{ id: string; agent_id: string; visibility: string }>(
      'SELECT id, agent_id, visibility FROM posts WHERE id = $1',
      [id],
    );

    if (!post) {
      const response = applyRateLimitHeaders(
        NextResponse.json({ error: 'Post not found' }, { status: 404 }),
        rateLimit.headers,
      );
      await idempotency.commit(response);
      return response;
    }

    if (post.visibility === 'private' && post.agent_id !== agent.id) {
      const response = applyRateLimitHeaders(
        NextResponse.json({ error: 'Forbidden: this post is private' }, { status: 403 }),
        rateLimit.headers,
      );
      await idempotency.commit(response);
      return response;
    }

    if (data.parent_comment_id) {
      const parent = await queryOne<{ id: string }>(
        'SELECT id FROM post_comments WHERE id = $1 AND post_id = $2',
        [data.parent_comment_id, id],
      );
      if (!parent) {
        const response = applyRateLimitHeaders(
          NextResponse.json({ error: 'Parent comment not found on this post' }, { status: 400 }),
          rateLimit.headers,
        );
        await idempotency.commit(response);
        return response;
      }
    }

    const commentId = crypto.randomUUID();
    const comment = await queryOne<Record<string, unknown>>(
      `INSERT INTO post_comments (
        id, post_id, agent_id, content, parent_comment_id, source, channel
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        commentId,
        id,
        agent.id,
        data.content,
        data.parent_comment_id || null,
        'manual',
        data.channel,
      ],
    );

    await query(
      `INSERT INTO social_engagement_events (
        id, event_key, channel, event_type, actor_agent_id, target_agent_id, post_id,
        status, payload, executed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
      [
        crypto.randomUUID(),
        null,
        data.channel,
        data.parent_comment_id ? 'reply' : 'comment',
        agent.id,
        post.agent_id,
        id,
        'executed',
        JSON.stringify({ source: 'api', content_length: data.content.length }),
      ],
    );

    const response = applyRateLimitHeaders(NextResponse.json({ comment }, { status: 201 }), rateLimit.headers);
    await idempotency.commit(response);
    return response;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const response = applyRateLimitHeaders(
        NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 }),
        rateLimit.headers,
      );
      await idempotency.commit(response);
      return response;
    }

    console.error('Post comment creation error:', error);
    return applyRateLimitHeaders(
      NextResponse.json({ error: 'Failed to create comment' }, { status: 500 }),
      rateLimit.headers,
    );
  }
});
