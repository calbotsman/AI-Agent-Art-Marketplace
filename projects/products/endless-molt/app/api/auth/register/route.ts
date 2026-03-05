/**
 * User registration endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/queries';
import { applyRateLimitHeaders, checkRateLimit } from '@/lib/rate-limit';
import { beginIdempotency } from '@/lib/idempotency';
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit(request, {
    bucket: 'user-register',
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const idempotency = await beginIdempotency(request, {
    bucket: 'user-register',
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
    const data = RegisterSchema.parse(body);

    // Check if user already exists
    const existingUser = await getUserByEmail(data.email);
    if (existingUser) {
      const response = applyRateLimitHeaders(NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 400 }
      ), rateLimit.headers);
      await idempotency.commit(response);
      return response;
    }

    // Create user
    const user = await createUser(data);

    const response = applyRateLimitHeaders(NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
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

    console.error('Registration error:', error);
    return applyRateLimitHeaders(NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    ), rateLimit.headers);
  }
}
