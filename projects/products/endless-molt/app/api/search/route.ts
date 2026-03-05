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
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const telemetry = startApiTelemetry('/api/search', 'GET');
  try {
    const { searchParams } = new URL(request.url);

    const parsed = SearchQuerySchema.parse({
      q: searchParams.get('q') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    const listings = await searchListings(parsed.q, {
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
