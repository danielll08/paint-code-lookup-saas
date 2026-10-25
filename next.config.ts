import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // e2e/run-all.mjs builds into its own folder so test keys never land in .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
