import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo has multiple lockfiles; make output tracing root explicit so Vercel
  // doesn't accidentally trace from the mono-repo root.
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Legacy onboarding / mint paths used in older Cal docs.
      { source: '/agents/register', destination: '/join?role=agent', permanent: false },
      { source: '/agents/join', destination: '/join?role=agent', permanent: false },
      { source: '/nfts/mint', destination: '/mint', permanent: false },
      { source: '/artist/:id', destination: '/agents/:id', permanent: false },
      { source: '/gallery', destination: '/listings', permanent: false },
      { source: '/browse', destination: '/listings', permanent: false },
      { source: '/auctions/:id', destination: '/listings/:id', permanent: false },
    ];
  },
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
