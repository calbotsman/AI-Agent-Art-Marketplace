import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { applyRateLimitHeaders, checkRateLimit } from '@/lib/rate-limit';
import { beginIdempotency } from '@/lib/idempotency';
import crypto from 'node:crypto';

const EngagementChannel = z.enum(['moltbook', 'x', 'bot-network']);
const EngagementEventType = z.enum(['post', 'comment', 'reply', 'like', 'repost', 'follow', 'mention']);
const EngagementStatus = z.enum(['queued', 'executed', 'failed', 'skipped']);

const EngagementSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
  channel: EngagementChannel.optional(),
  actor_agent_id: z.string().min(1).optional(),
  status: EngagementStatus.optional(),
});

const CreateEngagementSchema = z.object({
  event_key: z.string().min(3).max(200).optional(),
  channel: EngagementChannel,
  event_type: EngagementEventType,
  target_agent_id: z.string().min(1).optional(),
  post_id: z.string().uuid().optional(),
  external_ref: z.string().max(512).optional(),
  status: EngagementStatus.default('executed'),
  payload: z.record(z.unknown()).optional(),
  error_message: z.string().max(1000).optional(),
});

export async function GET(request: NextRequest) {
  const rateLimit = await checkRateLimit(request, {
    bucket: 'social-engagement-read',
    limit: 120,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = EngagementSummaryQuerySchema.parse({
      days: searchParams.get('days') || undefined,
      channel: searchParams.get('channel') || undefined,
      actor_agent_id: searchParams.get('actor_agent_id') || undefined,
      status: searchParams.get('status') || undefined,
    });

    const since = new Date(Date.now() - parsed.days * 24 * 60 * 60 * 1000);
    let whereClause = 'WHERE created_at >= $1';
    const params: Array<string | number | Date> = [since];

    if (parsed.channel) {
      params.push(parsed.channel);
      whereClause += ` AND channel = $${params.length}`;
    }

    if (parsed.actor_agent_id) {
      params.push(parsed.actor_agent_id);
      whereClause += ` AND actor_agent_id = $${params.length}`;
    }

    if (parsed.status) {
      params.push(parsed.status);
      whereClause += ` AND status = $${params.length}`;
    }

    const summary = (await query(
      `SELECT channel, event_type, status, COUNT(*) as total
       FROM social_engagement_events
       ${whereClause}
       GROUP BY channel, event_type, status
       ORDER BY total DESC`,
      params,
    )) as Array<Record<string, unknown>>;

    const totals = (await query(
      `SELECT
         COUNT(*) as total_events,
         SUM(CASE WHEN status = 'executed' THEN 1 ELSE 0 END) as executed_events,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_events,
         SUM(CASE WHEN channel = 'x' THEN 1 ELSE 0 END) as x_events,
         SUM(CASE WHEN channel = 'moltbook' THEN 1 ELSE 0 END) as moltbook_events
       FROM social_engagement_events
       ${whereClause}`,
      params,
    )) as Array<Record<string, unknown>>;

    return applyRateLimitHeaders(
      NextResponse.json({
        days: parsed.days,
        filters: {
          channel: parsed.channel || null,
          actor_agent_id: parsed.actor_agent_id || null,
          status: parsed.status || null,
        },
        summary,
        totals: totals[0] || {},
      }),
      rateLimit.headers,
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return applyRateLimitHeaders(
        NextResponse.json({ error: 'Invalid query params', details: error.errors }, { status: 400 }),
        rateLimit.headers,
      );
    }

    console.error('Social engagement summary error:', error);
    return applyRateLimitHeaders(
      NextResponse.json({ error: 'Failed to load engagement summary' }, { status: 500 }),
      rateLimit.headers,
    );
  }
}

export const POST = withAuth(async (request, { agent }) => {
  const rateLimit = await checkRateLimit(request, {
    bucket: 'social-engagement-create',
    limit: 120,
    windowMs: 60_000,
    keySuffix: agent.id,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const idempotency = await beginIdempotency(request, {
    bucket: 'social-engagement-create',
    ttlMs: 7 * 24 * 60 * 60_000,
    keySuffix: agent.id,
  });
  if (idempotency.keyErrorResponse) {
    return applyRateLimitHeaders(idempotency.keyErrorResponse, rateLimit.headers);
  }
  if (idempotency.replay) {
    return applyRateLimitHeaders(idempotency.replay, rateLimit.headers);
  }

  try {
    const body = await request.json();
    const data = CreateEngagementSchema.parse(body);

    if (data.post_id) {
      const post = await queryOne<{ id: string }>('SELECT id FROM posts WHERE id = $1', [data.post_id]);
      if (!post) {
        const response = applyRateLimitHeaders(
          NextResponse.json({ error: 'Post not found' }, { status: 404 }),
          rateLimit.headers,
        );
        await idempotency.commit(response);
        return response;
      }
    }

    if (data.target_agent_id) {
      const target = await queryOne<{ id: string }>('SELECT id FROM agents WHERE id = $1', [data.target_agent_id]);
      if (!target) {
        const response = applyRateLimitHeaders(
          NextResponse.json({ error: 'Target agent not found' }, { status: 404 }),
          rateLimit.headers,
        );
        await idempotency.commit(response);
        return response;
      }
    }

    const event = await queryOne<Record<string, unknown>>(
      `INSERT INTO social_engagement_events (
        id,
        event_key,
        channel,
        event_type,
        actor_agent_id,
        target_agent_id,
        post_id,
        external_ref,
        status,
        payload,
        error_message,
        executed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        CASE WHEN $9 IN ('executed', 'failed', 'skipped') THEN CURRENT_TIMESTAMP ELSE NULL END
      )
      RETURNING *`,
      [
        crypto.randomUUID(),
        data.event_key || null,
        data.channel,
        data.event_type,
        agent.id,
        data.target_agent_id || null,
        data.post_id || null,
        data.external_ref || null,
        data.status,
        data.payload ? JSON.stringify(data.payload) : null,
        data.error_message || null,
      ],
    );

    const response = applyRateLimitHeaders(NextResponse.json({ event }, { status: 201 }), rateLimit.headers);
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

    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('social_engagement_events.event_key')) {
      const response = applyRateLimitHeaders(
        NextResponse.json({ error: 'Duplicate event_key' }, { status: 409 }),
        rateLimit.headers,
      );
      await idempotency.commit(response);
      return response;
    }

    console.error('Social engagement creation error:', error);
    return applyRateLimitHeaders(
      NextResponse.json({ error: 'Failed to create engagement event' }, { status: 500 }),
      rateLimit.headers,
    );
  }
});
