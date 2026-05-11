import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build for `npx claude-config-manager`. Produces
  // .next/standalone/server.js with a minimal node_modules subset.
  output: "standalone",
};

export default nextConfig;
