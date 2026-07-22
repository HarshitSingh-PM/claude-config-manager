#!/usr/bin/env node
/**
 * Next.js standalone output produces .next/standalone/server.js but doesn't
 * copy public/ or .next/static/ in. This step does. After running, the
 * package is fully self-contained and ready to `node .next/standalone/server.js`.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const publicSrc = path.join(root, "public");

if (!fs.existsSync(standalone)) {
  console.error(
    "✘ .next/standalone not found. Did `next build` actually run? Check next.config.ts has `output: \"standalone\"`.",
  );
  process.exit(1);
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const staticDst = path.join(standalone, ".next", "static");
const publicDst = path.join(standalone, "public");

if (fs.existsSync(staticDst)) fs.rmSync(staticDst, { recursive: true, force: true });
copyDir(staticSrc, staticDst);

if (fs.existsSync(publicDst)) fs.rmSync(publicDst, { recursive: true, force: true });
copyDir(publicSrc, publicDst);

// ─── node-pty: the terminal backend ──────────────────────────────────────
// node-pty is a native module, externalized in next.config.ts. Next's tracer
// usually copies it into the standalone node_modules, but (a) we can't rely on
// that for a native package, and (b) on macOS its `spawn-helper` prebuild loses
// its executable bit during npm's tarball extraction, which makes pty.spawn()
// fail with "posix_spawnp failed". Copy it in explicitly and restore exec bits.
function ensureNodePty() {
  const src = path.join(root, "node_modules", "node-pty");
  const dst = path.join(standalone, "node_modules", "node-pty");
  if (!fs.existsSync(src)) {
    console.warn("⚠ node-pty not found in node_modules — terminal will be disabled.");
    return;
  }
  // Always copy the full tree (merge). Next's tracer typically copies only
  // node-pty/lib + package.json, leaving out prebuilds/ (the native .node
  // binaries and spawn-helper) — so a guard on `dst` existence would skip the
  // one part that actually matters. copyDir merges over the partial copy.
  copyDir(src, dst);
  // Restore exec bit on every prebuilt spawn-helper (darwin) and .node binary.
  const prebuilds = path.join(dst, "prebuilds");
  if (fs.existsSync(prebuilds)) {
    for (const platDir of fs.readdirSync(prebuilds)) {
      const helper = path.join(prebuilds, platDir, "spawn-helper");
      if (fs.existsSync(helper)) {
        try {
          fs.chmodSync(helper, 0o755);
        } catch {
          /* best effort */
        }
      }
    }
  }
}
ensureNodePty();

// Scrub dev-only files that Next.js's output-file tracing dragged in.
// These belong to the source repo (CLAUDE.md is dev memory), not the npm package.
for (const stray of ["CLAUDE.md", "AGENTS.md", ".claude", ".env", ".env.local"]) {
  const p = path.join(standalone, stray);
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

// Remove any .bak-<timestamp> files that ended up in the bundle
function rmBaks(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) rmBaks(p);
    else if (/\.bak-[\d\-T:.Z]+$/.test(e.name)) fs.unlinkSync(p);
  }
}
rmBaks(standalone);

console.log("✓ standalone packed (.next/standalone/ ready to ship)");
