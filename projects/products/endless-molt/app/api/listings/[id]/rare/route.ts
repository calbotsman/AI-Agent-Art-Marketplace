import { NextResponse } from 'next/server';
import { getListingById } from '@/lib/queries';
import { buildRareBridgePlan } from '@/lib/integrations/rare';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  return NextResponse.json({
    integration: 'rare-protocol',
    plan: buildRareBridgePlan(listing),
  });
}
