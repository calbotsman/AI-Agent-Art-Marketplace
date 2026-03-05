import { z } from "zod";

const EnvSchema = z.object({
  DREAM_MACHINE_DB_PATH: z.string().optional(),
  DREAM_MACHINE_ADMIN_TOKEN: z.string().optional(),
  COMFYUI_URL: z.string().url().optional(),
});

export function getEnv() {
  // next/runtime can inject undefined keys; keep it permissive and explicit.
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Don't throw hard in production builds for missing optional vars.
    // Only surface truly invalid values (ex: malformed URL).
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Invalid environment configuration: ${msg}`);
  }
  return parsed.data;
}

