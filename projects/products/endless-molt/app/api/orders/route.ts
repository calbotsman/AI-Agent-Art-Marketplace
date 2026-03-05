/**
 * Orders API endpoints
 * GET - Get user's orders
 * POST - Create new order (mock checkout for Phase 1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getOrdersByUser, getListingById } from '@/lib/queries';
import { getCurrentUser } from '@/lib/auth';
import { applyRateLimitHeaders, checkRateLimit } from '@/lib/rate-limit';
import { beginIdempotency } from '@/lib/idempotency';
import { z } from 'zod';

function ordersEnabled() {
  // This route is a Phase 1 mock checkout and uses a weak cookie token.
  // Disable by default in production to avoid an easy auth spoofing surface.
  return process.env.ENABLE_ORDERS_API === 'true';
}

// GET /api/orders - Get user's orders
export async function GET(request: NextRequest) {
  const rateLimit = await checkRateLimit(request, {
    bucket: 'orders-read',
    limit: 120,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  try {
    if (!ordersEnabled()) {
      return applyRateLimitHeaders(NextResponse.json({ error: 'Orders are disabled' }, { status: 501 }), rateLimit.headers);
    }
    const user = await getCurrentUser(request);
    if (!user) {
      return applyRateLimitHeaders(NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ), rateLimit.headers);
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 50;
    const offset = searchParams.get('offset')
      ? parseInt(searchParams.get('offset')!)
      : 0;

    const orders = await getOrdersByUser(user.id);
    const pagedOrders = orders.slice(offset, offset + limit);

    return applyRateLimitHeaders(NextResponse.json({ orders: pagedOrders, count: orders.length }), rateLimit.headers);
  } catch (error: unknown) {
    console.error('Orders fetch error:', error);
    return applyRateLimitHeaders(NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    ), rateLimit.headers);
  }
}

// POST /api/orders - Create order (mock checkout)
const CreateOrderSchema = z.object({
  listing_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit(request, {
    bucket: 'orders-create',
    limit: 30,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const idempotency = await beginIdempotency(request, {
    bucket: 'orders-create',
    ttlMs: 12 * 60 * 60_000,
  });
  if (idempotency.keyErrorResponse) {
    return applyRateLimitHeaders(idempotency.keyErrorResponse, rateLimit.headers);
  }
  if (idempotency.replay) {
    return applyRateLimitHeaders(idempotency.replay, rateLimit.headers);
  }

  try {
    if (!ordersEnabled()) {
      return applyRateLimitHeaders(NextResponse.json({ error: 'Orders are disabled' }, { status: 501 }), rateLimit.headers);
    }
    const user = await getCurrentUser(request);
    if (!user) {
      return applyRateLimitHeaders(NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ), rateLimit.headers);
    }

    const body = await request.json();
    const data = CreateOrderSchema.parse(body);

    // Verify listing exists and is available
    const listing = await getListingById(data.listing_id);
    if (!listing) {
      return applyRateLimitHeaders(NextResponse.json({ error: 'Listing not found' }, { status: 404 }), rateLimit.headers);
    }

    if (listing.status !== 'active') {
      return applyRateLimitHeaders(NextResponse.json(
        { error: 'Listing is not available for purchase' },
        { status: 400 }
      ), rateLimit.headers);
    }

    // Create order (Phase 1: mock checkout, no real payment)
    const order = await createOrder({
      user_id: user.id,
      listing_id: data.listing_id,
      amount: listing.price,
    });

    const response = applyRateLimitHeaders(NextResponse.json(
      {
        order,
        message: 'Order created successfully (mock checkout)',
      },
      { status: 201 }
    ), rateLimit.headers);
    await idempotency.commit(response);
    return response;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const response = applyRateLimitHeaders(NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      ), rateLimit.headers);
      await idempotency.commit(response);
      return response;
    }

    console.error('Order creation error:', error);
    return applyRateLimitHeaders(NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    ), rateLimit.headers);
  }
}
