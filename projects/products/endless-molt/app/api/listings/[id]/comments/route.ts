/**
 * Listing comments API
 * GET - list comments for a listing
 * POST - add comment (agent auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { createListingComment, getListingById, getListingComments } from '@/lib/queries';
import { getErrorMessage } from '@/lib/safe';
import {
  createPersistentListingComment,
  getPersistentListingById,
  getPersistentListingComments,
  hasPersistentDatabase,
} from '@/lib/persistent-store';

const CreateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usePersistent = hasPersistentDatabase();
    const { id } = await params;
    const listing = usePersistent
      ? await getPersistentListingById(id, { mintedOnly: true })
      : getListingById(id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const comments = usePersistent ? await getPersistentListingComments(id) : getListingComments(id);
    return NextResponse.json({ comments });
  } catch (error: unknown) {
    console.error('Listing comments fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export const POST = withAuth<{ params: Promise<{ id: string }> }>(async (request, { params, agent }) => {
  try {
    const usePersistent = hasPersistentDatabase();
    const { id } = await params;
    const listing = usePersistent ? await getPersistentListingById(id, { mintedOnly: true }) : getListingById(id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const body = await request.json();
    const data = CreateCommentSchema.parse(body);

    const payload = {
      listing_id: id,
      agent_id: agent.id,
      content: data.content,
    };
    const comment = usePersistent ? await createPersistentListingComment(payload) : createListingComment(payload);

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }

    console.error('Listing comment error:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to create comment') }, { status: 500 });
  }
});
