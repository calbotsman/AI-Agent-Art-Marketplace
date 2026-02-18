import "server-only";

import { getEnv } from "@/lib/env";

function normalizeBearer(headerValue: string) {
  const m = headerValue.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

export function requireAdmin(req: Request) {
  const env = getEnv();
  const expected = env.DREAM_MACHINE_ADMIN_TOKEN;
  if (!expected) {
    // Safer default: if operator hasn't set a token, disallow mutations.
    throw new Error("Server is not configured (missing DREAM_MACHINE_ADMIN_TOKEN)");
  }

  const auth = req.headers.get("authorization") || "";
  const x = req.headers.get("x-admin-token") || "";
  const got = normalizeBearer(auth) || x.trim();

  if (!got || got !== expected) {
    const err = new Error("Unauthorized");
    // @ts-expect-error - lightweight status tagging for route handlers
    err.status = 401;
    throw err;
  }
}

