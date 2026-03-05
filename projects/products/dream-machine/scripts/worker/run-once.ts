/**
 * Minimal worker stub.
 *
 * This will evolve into:
 * - Poll pending jobs from the web app
 * - Submit ComfyUI workflow via HTTP API
 * - Upload outputs (mp4/png) somewhere public
 * - PATCH the job with URLs and create a piece
 */

import { getEnv } from "@/lib/env";

async function main() {
  const env = getEnv();
  console.log("Worker configured with:");
  console.log(`- COMFYUI_URL: ${env.COMFYUI_URL || "(unset)"}`);
  console.log(`- DREAM_MACHINE_ADMIN_TOKEN: ${env.DREAM_MACHINE_ADMIN_TOKEN ? "(set)" : "(unset)"}`);

  console.log("No-op run. Implement ComfyUI job execution next.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

