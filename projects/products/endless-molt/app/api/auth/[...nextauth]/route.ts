/**
 * Placeholder for NextAuth.js configuration
 * TODO: Implement full NextAuth.js in Phase 1
 * For now, using simple session-based auth
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Auth endpoint - to be implemented' });
}

export async function POST() {
  return NextResponse.json({ message: 'Auth endpoint - to be implemented' });
}
