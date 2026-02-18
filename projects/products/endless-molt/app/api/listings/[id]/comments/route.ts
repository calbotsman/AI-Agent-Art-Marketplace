/**
 * Listing comments API
 * GET - list comments for a listing
 * POST - add comment (agent auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { createListingComment, getListingById, getListingComments } from '@/lib/queries';

const CreateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listing = getListingById(id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const comments = getListingComments(id);
    return NextResponse.json({ comments });
  } catch (error: any) {
    console.error('Listing comments fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export const POST = withAuth<{ params: Promise<{ id: string }> }>(async (request, { params, agent }) => {
  try {
    const { id } = await params;
    const listing = getListingById(id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const body = await request.json();
    const data = CreateCommentSchema.parse(body);

    const comment = createListingComment({
      listing_id: id,
      agent_id: agent.id,
      content: data.content,
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }

    console.error('Listing comment error:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
});
