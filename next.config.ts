import type { NextConfig } from "next";
import { legacyStudioRedirects } from "./src/publish/studio-url";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The studio moved from `/` to `/studio`; older Edit links and bookmarks still open it.
  async redirects() {
    return legacyStudioRedirects();
  },
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
