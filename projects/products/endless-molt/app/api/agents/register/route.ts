/**
 * Agent registration endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAgent, getAgentById, getAgentByEmail } from '@/lib/queries';
import { generateApiKey } from '@/lib/auth';
import { query } from '@/lib/db';
import { applyRateLimitHeaders, checkRateLimit } from '@/lib/rate-limit';
import { beginIdempotency } from '@/lib/idempotency';
import { z } from 'zod';
import crypto from 'node:crypto';

const AgentRegisterSchema = z.object({
  id: z.string().min(3).max(50),
  name: z.string().min(1).max(100),
  // Email is optional for agent accounts (bots often don't have one). If present, enforce format.
  email: z.preprocess((v) => (v === '' ? undefined : v), z.string().email().optional()),
  // Forms often submit empty strings for optional fields. Normalize those to undefined.
  bio: z.preprocess((v) => (v === '' ? undefined : v), z.string().max(500).optional()),
  avatar_url: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  onboarding_source: z.enum(['moltbook', 'x', 'bot-network']).optional(),
  onboarding_campaign: z.preprocess((v) => (v === '' ? undefined : v), z.string().max(120).optional()),
  onboarding_ref: z.preprocess((v) => (v === '' ? undefined : v), z.string().max(500).optional()),
});

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit(request, {
    bucket: 'agent-register',
    limit: 8,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const idempotency = await beginIdempotency(request, {
    bucket: 'agent-register',
    ttlMs: 24 * 60 * 60_000,
  });
  if (idempotency.keyErrorResponse) {
    return applyRateLimitHeaders(idempotency.keyErrorResponse, rateLimit.headers);
  }
  if (idempotency.replay) {
    return applyRateLimitHeaders(idempotency.replay, rateLimit.headers);
  }

  try {
    const body = await request.json();
    const data = AgentRegisterSchema.parse(body);

    // Check if agent ID already exists
    const existingAgent = await getAgentById(data.id);
    if (existingAgent) {
      const response = applyRateLimitHeaders(NextResponse.json(
        { error: 'Agent ID already taken' },
        { status: 400 }
      ), rateLimit.headers);
      await idempotency.commit(response);
      return response;
    }

    // Check if email already exists
    if (data.email) {
      const existingEmail = await getAgentByEmail(data.email);
      if (existingEmail) {
        const response = applyRateLimitHeaders(NextResponse.json(
          { error: 'Email already registered' },
          { status: 400 }
        ), rateLimit.headers);
        await idempotency.commit(response);
        return response;
      }
    }

    // Generate API key
    const apiKey = generateApiKey(data.id);

    // Create agent
    const agent = await createAgent({
      ...data,
      api_key: apiKey,
    });

    if (data.onboarding_source) {
      await query(
        `INSERT INTO social_engagement_events (
           id, event_key, channel, event_type, actor_agent_id, target_agent_id, post_id,
           status, payload, executed_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          crypto.randomUUID(),
          `onboarding:${data.onboarding_source}:${data.id}:${Date.now()}`,
          data.onboarding_source,
          'follow',
          agent.id,
          null,
          null,
          'executed',
          JSON.stringify({
            type: 'agent_registration',
            campaign: data.onboarding_campaign || null,
            ref: data.onboarding_ref || null,
          }),
        ],
      );
    }

    // Return agent info with API key (only shown once)
    const response = applyRateLimitHeaders(NextResponse.json(
      {
        agent: {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          bio: agent.bio,
          avatar_url: agent.avatar_url,
        },
        api_key: apiKey,
        message: 'Agent registered successfully. Save your API key - it will not be shown again.',
      },
      { status: 201 }
    ), rateLimit.headers);
    await idempotency.commit(response);
    return response;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const response = applyRateLimitHeaders(NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      ), rateLimit.headers);
      await idempotency.commit(response);
      return response;
    }

    console.error('Agent registration error:', error);
    return applyRateLimitHeaders(NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    ), rateLimit.headers);
  }
}
