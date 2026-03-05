import { NextResponse } from "next/server";
import { getPiece } from "@/lib/pieces";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const piece = getPiece(id);
  if (!piece) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ piece });
}

