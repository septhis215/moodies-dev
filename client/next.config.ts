import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(configDir);
const appEnv = process.env.MOODIES_ENV || process.env.APP_ENV || "local";
const apiUrl =
  appEnv === "local"
    ? process.env.LOCAL_API_URL
    : appEnv === "staging"
      ? process.env.STAGING_API_URL
      : process.env.PRODUCTION_API_URL;

if (!apiUrl) {
  throw new Error(
    `Missing API URL for ${appEnv}. Set the matching API URL in client/.env.`,
  );
}

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_APP_ENV: appEnv,
    NEXT_PUBLIC_API_URL: apiUrl,
    NEST_API_URL: apiUrl,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
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
