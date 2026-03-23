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
import { getArtworkSubmissionError, normalizeArtworkSubmission } from '@/lib/artwork-submission';
import {
  getPersistentListingById,
  hasPersistentDatabase,
  incrementPersistentListingViews,
  updatePersistentListing,
} from '@/lib/persistent-store';

const ListingIdSchema = z.string().min(1);

// GET /api/listings/[id] - Get listing detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usePersistent = hasPersistentDatabase();
    const { id: rawId } = await params;
    const id = ListingIdSchema.parse(rawId);
    const listing = usePersistent
      ? await getPersistentListingById(id, { mintedOnly: true })
      : getListingById(id);

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Increment view count
    if (usePersistent) {
      await incrementPersistentListingViews(id);
    } else {
      incrementListingViews(id);
    }

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
    title: z.string().optional(),
    description: z.string().optional(),
    artist_statement: z.string().optional(),
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
    const usePersistent = hasPersistentDatabase();
    const { id: rawId } = await params;
    const id = ListingIdSchema.parse(rawId);
    const listing = usePersistent ? await getPersistentListingById(id) : getListingById(id);

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
    const normalizedTitle = data.title !== undefined ? data.title : listing.title;
    const normalizedArtistStatement =
      data.description !== undefined || data.artist_statement !== undefined
        ? normalizeArtworkSubmission({
            title: normalizedTitle,
            description: data.description ?? listing.description ?? '',
            artistStatement: data.artist_statement,
          }).artistStatement
        : listing.description ?? '';

    if (data.title !== undefined || data.description !== undefined || data.artist_statement !== undefined) {
      const submissionError = getArtworkSubmissionError({
        title: normalizedTitle,
        artistStatement: normalizedArtistStatement,
      });

      if (submissionError) {
        return NextResponse.json({ error: submissionError }, { status: 400 });
      }
    }

    // Prepare updates
    const updates: Partial<Listing> = {};
    if (data.title !== undefined) {
      updates.title = normalizeArtworkSubmission({
        title: data.title,
        description: normalizedArtistStatement,
      }).title;
    }
    if (data.description !== undefined || data.artist_statement !== undefined) {
      updates.description = normalizedArtistStatement;
    }

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

    if (usePersistent) {
      await updatePersistentListing(id, updates);
    } else {
      updateListing(id, updates);
    }

    const updatedListing = usePersistent ? await getPersistentListingById(id) : getListingById(id);
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
    const usePersistent = hasPersistentDatabase();
    const { id: rawId } = await params;
    const id = ListingIdSchema.parse(rawId);
    const listing = usePersistent ? await getPersistentListingById(id) : getListingById(id);

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
    if (usePersistent) {
      await updatePersistentListing(id, { status: 'removed' });
    } else {
      updateListing(id, { status: 'removed' });
    }

    return NextResponse.json({ message: 'Listing removed successfully' });
  } catch (error: unknown) {
    console.error('Listing deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to remove listing' },
      { status: 500 }
    );
  }
});
