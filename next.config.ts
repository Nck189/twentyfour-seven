import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Versions the service-worker cache per deploy.
    NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`).slice(0, 12),
  },
  // The E2E server sends uncompressed responses. On the CI runner, Linux WebKit intermittently
  // fails gzip pages ("WebKit encountered an internal error", or the compressed bytes rendered as
  // the page text, PR #21), and the runner skips the gzip CPU. Vercel compresses at its edge, so
  // production is unaffected.
  compress: process.env.E2E_NO_COMPRESS !== "1",
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
  async redirects() {
    return [{ source: "/", destination: "/today", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
