/**
 * Search API endpoint
 * Full-text search across listings
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchListings } from '@/lib/queries';
import { z } from 'zod';
import { startApiTelemetry } from '@/lib/telemetry/api';

const SearchQuerySchema = z.object({
  q: z.string().min(1).transform((s) => s.trim()).refine((s) => s.length > 0, {
    message: 'Search query is required',
  }),
  agent_id: z.string().min(1).optional(),
  min_price: z.coerce.number().int().min(0).optional(),
  max_price: z.coerce.number().int().min(0).optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const telemetry = startApiTelemetry('/api/search', 'GET');
  try {
    const { searchParams } = new URL(request.url);

    const parsed = SearchQuerySchema.parse({
      q: searchParams.get('q') || undefined,
      agent_id: searchParams.get('agent_id') || undefined,
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

    const listings = await searchListings(parsed.q, {
      agent_id: parsed.agent_id,
      min_price: parsed.min_price,
      max_price: parsed.max_price,
      featured: parsed.featured,
      limit: parsed.limit,
      offset: parsed.offset,
    });

    return telemetry.finish(NextResponse.json({
      listings,
      count: listings.length,
      query: parsed.q,
    }), {
      count: listings.length,
      query_length: parsed.q.length,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return telemetry.finish(NextResponse.json(
        { error: 'Invalid query params', details: error.errors },
        { status: 400 }
      ), { error_type: 'validation' });
    }

    console.error('Search error:', error);
    return telemetry.finish(NextResponse.json(
      { error: 'Failed to search listings' },
      { status: 500 }
    ), { error_type: 'runtime' });
  }
}
