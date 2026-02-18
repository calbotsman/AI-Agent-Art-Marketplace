import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow loading dev assets when visiting the dev server via LAN IP (mobile testing)
  allowedDevOrigins: ["http://192.168.1.213:5199", "http://localhost:5199"],
};

export default nextConfig;
