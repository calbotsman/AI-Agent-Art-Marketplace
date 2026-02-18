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
import { parseEthToMicro, usdCentsToMicroEth } from '@/lib/pricing';
import type { Listing } from '@/lib/types';

const ListingIdSchema = z.string().min(1);

// GET /api/listings/[id] - Get listing detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = ListingIdSchema.parse(rawId);
    const listing = await getListingById(id);

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Increment view count
    await incrementListingViews(id);

    return NextResponse.json({ listing });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid listing id', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Listing fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listing' },
      { status: 500 }
    );
  }
}

// PATCH /api/listings/[id] - Update listing (agent only)
const UpdateListingSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    // ETH-only pricing.
    // Legacy clients may still send `price` as USD cents; we convert to an approximate ETH amount.
    price_eth: z.string().min(1).max(64).optional(),
    price: z.number().int().min(0).optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['active', 'sold', 'removed', 'draft']).optional(),
    featured: z.number().int().min(0).max(1).optional(),
  })
  .refine((v) => !(v.price_eth && v.price !== undefined), {
    message: 'Provide only one of price_eth or price',
  });

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(async (request, { params, agent }) => {
  try {
    const { id: rawId } = await params;
    const id = ListingIdSchema.parse(rawId);
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
    const updates: Partial<Listing> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;

    if (data.price_eth !== undefined) {
      updates.price = parseEthToMicro(data.price_eth);
      updates.currency = 'ETH';
    } else if (data.price !== undefined) {
      // Legacy USD cents -> approximate ETH micros.
      updates.price = usdCentsToMicroEth(data.price, 3000);
      updates.currency = 'ETH';
    }

    if (data.status !== undefined) updates.status = data.status;
    if (data.featured !== undefined) updates.featured = data.featured;
    if (data.tags !== undefined) updates.tags = JSON.stringify(data.tags);

    await updateListing(id, updates);

    const updatedListing = await getListingById(id);
    return NextResponse.json({ listing: updatedListing });
  } catch (error: unknown) {
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
export const DELETE = withAuth<{ params: Promise<{ id: string }> }>(async (request, { params, agent }) => {
  try {
    const { id: rawId } = await params;
    const id = ListingIdSchema.parse(rawId);
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
  } catch (error: unknown) {
    console.error('Listing deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to remove listing' },
      { status: 500 }
    );
  }
});
