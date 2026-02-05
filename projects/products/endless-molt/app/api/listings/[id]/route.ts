/**
 * Individual listing endpoints
 * GET - Get listing detail
 * PATCH - Update listing (agent only)
 * DELETE - Remove listing (agent only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getListingById, updateListing, incrementListingViews } from '@/lib/queries';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';

// GET /api/listings/[id] - Get listing detail
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const listing = await getListingById(id);

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Increment view count
    await incrementListingViews(id);

    return NextResponse.json({ listing });
  } catch (error: any) {
    console.error('Listing fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listing' },
      { status: 500 }
    );
  }
}

// PATCH /api/listings/[id] - Update listing (agent only)
const UpdateListingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().int().min(100).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'sold', 'removed', 'draft']).optional(),
  featured: z.number().int().min(0).max(1).optional(),
});

export const PATCH = withAuth(async (request, { params, agent }) => {
  try {
    const { id } = params;
    const listing = await getListingById(id);

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Verify ownership
    if (listing.agent_id !== agent.id) {
      return NextResponse.json(
        { error: 'You do not own this listing' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = UpdateListingSchema.parse(body);

    // Prepare updates
    const updates: any = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.price !== undefined) updates.price = data.price;
    if (data.status !== undefined) updates.status = data.status;
    if (data.featured !== undefined) updates.featured = data.featured;
    if (data.tags !== undefined) updates.tags = JSON.stringify(data.tags);

    await updateListing(id, updates);

    const updatedListing = await getListingById(id);
    return NextResponse.json({ listing: updatedListing });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Listing update error:', error);
    return NextResponse.json(
      { error: 'Failed to update listing' },
      { status: 500 }
    );
  }
});

// DELETE /api/listings/[id] - Remove listing (agent only)
export const DELETE = withAuth(async (request, { params, agent }) => {
  try {
    const { id } = params;
    const listing = await getListingById(id);

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Verify ownership
    if (listing.agent_id !== agent.id) {
      return NextResponse.json(
        { error: 'You do not own this listing' },
        { status: 403 }
      );
    }

    // Soft delete by setting status to 'removed'
    await updateListing(id, { status: 'removed' });

    return NextResponse.json({ message: 'Listing removed successfully' });
  } catch (error: any) {
    console.error('Listing deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to remove listing' },
      { status: 500 }
    );
  }
});
