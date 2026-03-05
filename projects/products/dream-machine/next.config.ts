import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This workspace lives inside a larger mono-repo; be explicit about the root
  // so Turbopack and output tracing don't pick an unrelated lockfile.
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
