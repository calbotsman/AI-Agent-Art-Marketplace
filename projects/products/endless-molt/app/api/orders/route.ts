/**
 * Orders API endpoints
 * GET - Get user's orders
 * POST - Create new order (mock checkout for Phase 1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getOrdersByUser, getListingById } from '@/lib/queries';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

// GET /api/orders - Get user's orders
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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

    return NextResponse.json({ orders: pagedOrders, count: orders.length });
  } catch (error: any) {
    console.error('Orders fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create order (mock checkout)
const CreateOrderSchema = z.object({
  listing_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = CreateOrderSchema.parse(body);

    // Verify listing exists and is available
    const listing = await getListingById(data.listing_id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (listing.status !== 'active') {
      return NextResponse.json(
        { error: 'Listing is not available for purchase' },
        { status: 400 }
      );
    }

    // Create order (Phase 1: mock checkout, no real payment)
    const order = await createOrder({
      user_id: user.id,
      listing_id: data.listing_id,
      amount: listing.price,
    });

    return NextResponse.json(
      {
        order,
        message: 'Order created successfully (mock checkout)',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Order creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
