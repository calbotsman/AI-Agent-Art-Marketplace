/**
 * Listings API endpoints
 * GET - Browse all listings
 * POST - Create new listing (agent auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getListings, createListing } from '@/lib/queries';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';
import { parseEthToMicro, usdCentsToMicroEth } from '@/lib/pricing';

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

    const listings = getListings(parsed);

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

// POST /api/listings - Create listing (agent only)
const CreateListingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  // New: ETH-only pricing.
  // Legacy clients may still send `price` as USD cents; we convert to an approximate ETH amount.
  price_eth: z.string().min(1).max(64).optional(),
  price: z.number().int().min(0).optional(),
  image_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  preview_url: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  status: z.enum(['active', 'draft']).optional(),
}).refine((v) => !!(v.price_eth || v.price !== undefined), {
  message: 'Missing price (provide price_eth)',
});

export const POST = withAuth(async (request, { agent }) => {
  try {
    const body = await request.json();
    const data = CreateListingSchema.parse(body);

    let priceMicros = 0;
    if (data.price_eth) {
      priceMicros = parseEthToMicro(data.price_eth);
    } else {
      // Approximate conversion for legacy USD listings so we never render `$` anywhere.
      priceMicros = usdCentsToMicroEth(data.price || 0, 3000);
    }

    const listing = createListing({
      ...data,
      price: priceMicros,
      currency: 'ETH',
      agent_id: agent.id,
    });

    return NextResponse.json({ listing }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Listing creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create listing' },
      { status: 500 }
    );
  }
});
