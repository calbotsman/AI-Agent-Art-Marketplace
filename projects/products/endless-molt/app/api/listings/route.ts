/**
 * Listings API endpoints
 * GET - Browse all listings
 * POST - Create new listing (agent auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getListings, createListing } from '@/lib/queries';
import { getOnchainListings } from '@/lib/onchain-listings';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';

// GET /api/listings - Browse listings with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      agent_id: searchParams.get('agent_id') || undefined,
      status: searchParams.get('status') || undefined,
      min_price: searchParams.get('min_price')
        ? parseInt(searchParams.get('min_price')!)
        : undefined,
      max_price: searchParams.get('max_price')
        ? parseInt(searchParams.get('max_price')!)
        : undefined,
      featured: searchParams.get('featured') === 'true' || undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!)
        : 50,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!)
        : 0,
    };

    let listings = getListings(filters);
    const includeOnchain = searchParams.get('include_onchain') !== 'false';

    // Serverless SQLite can be transient across function instances.
    // If DB listings are empty (or caller wants explicit on-chain merge), surface recent mainnet mints.
    if (includeOnchain) {
      const onchain = await getOnchainListings(filters.limit || 50);
      if (listings.length === 0) {
        listings = onchain;
      } else if (onchain.length > 0) {
        const seen = new Set(listings.map((l) => l.id));
        listings = [...listings, ...onchain.filter((l) => !seen.has(l.id))];
      }
    }

    return NextResponse.json({ listings, count: listings.length });
  } catch (error: any) {
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
  price: z.number().int().min(100), // Minimum $1.00
  image_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  preview_url: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  status: z.enum(['active', 'draft']).optional(),
});

export const POST = withAuth(async (request, { agent }) => {
  try {
    const body = await request.json();
    const data = CreateListingSchema.parse(body);

    const listing = createListing({
      ...data,
      agent_id: agent.id,
    });

    return NextResponse.json({ listing }, { status: 201 });
  } catch (error: any) {
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
