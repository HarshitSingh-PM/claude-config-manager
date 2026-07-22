import type { NextConfig } from "next";

const HEAVY_EXCLUDES = [
  "dist-electron/**/*",
  "build/**/*",
  "electron/**/*",
  ".git/**/*",
  "src/**/*",
  "**/*.dmg",
  "**/*.exe",
  "**/*.bak-*",
];

const nextConfig: NextConfig = {
  // Self-contained build for `npx claude-config-manager`. Produces
  // .next/standalone/server.js with a minimal node_modules subset.
  output: "standalone",

  // node-pty is a native module (used by the terminal API routes). Next already
  // auto-externalizes it, but we list it explicitly so the intent is obvious and
  // it's never accidentally pulled into the server bundle.
  serverExternalPackages: ["node-pty"],

  // The /api/projects route scans the real filesystem at runtime (os.homedir(),
  // readdir over project dirs). Next's file tracer can't reason about those
  // dynamic reads and conservatively traces the *entire* project into the
  // standalone bundle — including dist-electron/ (the multi-hundred-MB .dmg/.exe
  // installers), src/, .git/, etc., ballooning the bundle to ~1 GB. None of that
  // is needed at runtime (the route only uses node:fs/path/os builtins, and the
  // route's own compiled code is always included regardless of these excludes),
  // so we exclude the heavy/irrelevant trees explicitly.
  outputFileTracingExcludes: {
    // Same reasoning applies to every route that touches the real filesystem
    // at runtime (projects scan, session scan, vault config, logic instruction).
    "/api/projects": HEAVY_EXCLUDES,
    "/api/sessions": HEAVY_EXCLUDES,
    "/api/dashboard": HEAVY_EXCLUDES,
    "/api/mcp": HEAVY_EXCLUDES,
    "/api/app-config": HEAVY_EXCLUDES,
    "/api/logic-instruction": HEAVY_EXCLUDES,
    "/api/orchestrator": HEAVY_EXCLUDES,
    "/api/orchestrator/stream": HEAVY_EXCLUDES,
    "/api/transfer/export": HEAVY_EXCLUDES,
    "/api/transfer/import": HEAVY_EXCLUDES,
    "/api/orchestrator/live-sessions": HEAVY_EXCLUDES,
    // Terminal + workspace file tree read the real filesystem at runtime.
    "/api/terminal": HEAVY_EXCLUDES,
    "/api/terminal/[id]": HEAVY_EXCLUDES,
    "/api/terminal/history": HEAVY_EXCLUDES,
    "/api/fs-tree": HEAVY_EXCLUDES,
    "/api/file-raw": HEAVY_EXCLUDES,
    "/api/usage": HEAVY_EXCLUDES,
    // Pre-existing fs-touching routes that were missing from the list.
    "/api/file": HEAVY_EXCLUDES,
    "/api/paths": HEAVY_EXCLUDES,
    "/api/inventory": HEAVY_EXCLUDES,
  },
};

export default nextConfig;
