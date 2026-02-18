import { NextResponse } from "next/server";
import { createPiece, CreatePieceInputSchema, listPieces } from "@/lib/pieces";
import { requireAdmin } from "@/lib/admin";
import { errorMessage, errorStatus } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");

  const pieces = listPieces({
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });

  return NextResponse.json({ pieces, count: pieces.length });
}

export async function POST(req: Request) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const input = CreatePieceInputSchema.parse(body);
    const piece = createPiece(input);
    return NextResponse.json({ piece }, { status: 201 });
  } catch (err: unknown) {
    const status = errorStatus(err, 400);
    return NextResponse.json({ error: errorMessage(err, "Invalid request") }, { status });
  }
}
