import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(configDir);

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Serve remote media directly instead of routing through Vercel's
    // Image Optimization API, which can return 402 when optimization quota
    // or billing is unavailable.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        // Supabase Storage public URLs for user avatars.
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  reactStrictMode: true,
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/*": [
      "../node_modules/next/dist/compiled/source-map/**/*",
      "node_modules/next/dist/compiled/source-map/**/*",
    ],
  },
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
