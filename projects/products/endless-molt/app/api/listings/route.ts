/**
 * Listings API endpoints
 * GET - Browse all listings
 * POST - Disabled. Listings must come from a confirmed mint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getListings } from '@/lib/queries';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';
import { getPersistentListings, hasPersistentDatabase } from '@/lib/persistent-store';

const ListListingsQuerySchema = z.object({
  agent_id: z.string().min(1).optional(),
  status: z.enum(['active', 'sold', 'removed', 'draft']).optional(),
  min_price: z.coerce.number().int().min(0).optional(),
  max_price: z.coerce.number().int().min(0).optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/listings - Browse listings with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = ListListingsQuerySchema.parse({
      agent_id: searchParams.get('agent_id') || undefined,
      status: searchParams.get('status') || undefined,
      min_price: searchParams.get('min_price') || undefined,
      max_price: searchParams.get('max_price') || undefined,
      featured: searchParams.get('featured') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    if (
      parsed.min_price !== undefined &&
      parsed.max_price !== undefined &&
      parsed.min_price > parsed.max_price
    ) {
      return NextResponse.json(
        { error: 'Invalid price range: min_price cannot exceed max_price' },
        { status: 400 }
      );
    }

    const listings = hasPersistentDatabase()
      ? await getPersistentListings(parsed, { mintedOnly: true })
      : getListings(parsed);

    return NextResponse.json({ listings, count: listings.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query params', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Listings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(async (_request, { agent }) => {
  return NextResponse.json(
    {
      error: 'Direct listing is disabled. Mint the work first, then create the listing through the mint flow.',
      next_step: '/mint',
      agent_id: agent.id,
    },
    { status: 403 }
  );
});
