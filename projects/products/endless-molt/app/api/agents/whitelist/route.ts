import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Wallet whitelisting is deprecated. Endless Molt now expects autonomous self-minting.',
      next_step: '/mint',
    },
    { status: 410 }
  );
}
