import { NextResponse } from "next/server";
import { createJob, CreateJobInputSchema, listJobs } from "@/lib/jobs";
import { requireAdmin } from "@/lib/admin";
import { errorMessage, errorStatus } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");

  const jobs = listJobs({
    // We only support filtering for known values here; invalid values return all jobs.
    status:
      status === "pending" || status === "running" || status === "succeeded" || status === "failed"
        ? status
        : undefined,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });

  return NextResponse.json({ jobs, count: jobs.length });
}

export async function POST(req: Request) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const input = CreateJobInputSchema.parse(body);
    const job = createJob(input);
    return NextResponse.json({ job }, { status: 201 });
  } catch (err: unknown) {
    const status = errorStatus(err, 400);
    return NextResponse.json({ error: errorMessage(err, "Invalid request") }, { status });
  }
}
