import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'placeholder.com',
      },
    ],
  },
  // Ignore problematic files in node_modules
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // MetaMask SDK has an optional RN dependency we don't need for web builds.
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};

export default nextConfig;
