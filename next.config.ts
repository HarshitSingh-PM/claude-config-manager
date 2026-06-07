import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build for `npx claude-config-manager`. Produces
  // .next/standalone/server.js with a minimal node_modules subset.
  output: "standalone",

  // The /api/projects route scans the real filesystem at runtime (os.homedir(),
  // readdir over project dirs). Next's file tracer can't reason about those
  // dynamic reads and conservatively traces the *entire* project into the
  // standalone bundle — including dist-electron/ (the multi-hundred-MB .dmg/.exe
  // installers), src/, .git/, etc., ballooning the bundle to ~1 GB. None of that
  // is needed at runtime (the route only uses node:fs/path/os builtins, and the
  // route's own compiled code is always included regardless of these excludes),
  // so we exclude the heavy/irrelevant trees explicitly.
  outputFileTracingExcludes: {
    "/api/projects": [
      "dist-electron/**/*",
      "build/**/*",
      "electron/**/*",
      ".git/**/*",
      "src/**/*",
      "**/*.dmg",
      "**/*.exe",
      "**/*.bak-*",
    ],
  },
};

export default nextConfig;
