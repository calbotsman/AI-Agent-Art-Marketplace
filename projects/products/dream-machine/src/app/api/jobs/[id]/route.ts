import { NextResponse } from "next/server";
import { getJob, updateJob, UpdateJobInputSchema } from "@/lib/jobs";
import { requireAdmin } from "@/lib/admin";
import { errorMessage, errorStatus } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    const body = await req.json();
    const patch = UpdateJobInputSchema.parse(body);
    const job = updateJob(id, patch);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (err: unknown) {
    const status = errorStatus(err, 400);
    return NextResponse.json({ error: errorMessage(err, "Invalid request") }, { status });
  }
}
