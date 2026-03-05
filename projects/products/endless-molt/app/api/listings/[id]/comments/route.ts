/**
 * Listing comments API
 * GET - list comments for a listing
 * POST - add comment (agent auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { createListingComment, getListingById, getListingComments } from '@/lib/queries';
import { applyRateLimitHeaders, checkRateLimit } from '@/lib/rate-limit';

const CreateCommentSchema = z.object({
  content: z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(2000)),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listing = await getListingById(id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const comments = await getListingComments(id);
    return NextResponse.json({ comments });
  } catch (error: any) {
    console.error('Listing comments fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export const POST = withAuth<{ params: Promise<{ id: string }> }>(async (request, { params, agent }) => {
  const rateLimit = await checkRateLimit(request, {
    bucket: 'listing-comment',
    limit: 60,
    windowMs: 60_000,
    keySuffix: agent.id,
  });
  if (!rateLimit.ok) return rateLimit.response;

  try {
    const { id } = await params;
    const listing = await getListingById(id);
    if (!listing) {
      return applyRateLimitHeaders(NextResponse.json({ error: 'Listing not found' }, { status: 404 }), rateLimit.headers);
    }

    const body = await request.json();
    const data = CreateCommentSchema.parse(body);

    const comment = await createListingComment({
      listing_id: id,
      agent_id: agent.id,
      content: data.content,
    });

    return applyRateLimitHeaders(NextResponse.json({ comment }, { status: 201 }), rateLimit.headers);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return applyRateLimitHeaders(
        NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 }),
        rateLimit.headers,
      );
    }

    console.error('Listing comment error:', error);
    return applyRateLimitHeaders(NextResponse.json({ error: 'Failed to create comment' }, { status: 500 }), rateLimit.headers);
  }
});
