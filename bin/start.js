#!/usr/bin/env node
/* eslint-disable */
/**
 * Launcher for `npx claude-config-manager`.
 *
 * - Picks a free port (default 3737, falls back upward)
 * - Spawns the Next.js standalone server bundled in this package
 * - Opens the user's default browser
 * - Streams server output to the terminal, exits cleanly on Ctrl+C
 */

const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const { spawn, exec } = require("node:child_process");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const STANDALONE_DIR = path.join(PACKAGE_ROOT, ".next", "standalone");
const SERVER_JS = path.join(STANDALONE_DIR, "server.js");

const DEFAULT_PORT = 3737;
const HOST = "127.0.0.1";

function color(code, s) {
  return process.stdout.isTTY ? `[${code}m${s}[0m` : s;
}
const dim = (s) => color(2, s);
const bold = (s) => color(1, s);
const accent = (s) => color(35, s); // magenta-ish, matches the UI accent vibe

async function pickFreePort(start) {
  for (let p = start; p < start + 50; p++) {
    if (await isPortFree(p)) return p;
  }
  return start; // give up; spawn will fail loud
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", () => resolve(false));
    srv.listen({ port, host: HOST, exclusive: true }, () => {
      srv.close(() => resolve(true));
    });
  });
}

function openBrowser(url) {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {
    /* swallow — user can still open manually */
  });
}

function printHeader(port) {
  const url = `http://localhost:${port}`;
  console.log("");
  console.log(bold("  Claude Config Manager"));
  console.log(dim("  Edit every Claude Code config file from one place."));
  console.log("");
  console.log(`  ${dim("→")} ${accent(url)}`);
  console.log(`  ${dim("→ press Ctrl+C to stop")}`);
  console.log("");
}

(async () => {
  if (!fs.existsSync(SERVER_JS)) {
    console.error(
      `Could not find the bundled server at:\n  ${SERVER_JS}\n\n` +
        `This usually means the package was installed in a way that ` +
        `stripped its built files. Try:\n` +
        `  npx claude-config-manager@latest\n`,
    );
    process.exit(1);
  }

  const requestedPort = Number(process.env.PORT ?? "") || DEFAULT_PORT;
  const port = (await isPortFree(requestedPort))
    ? requestedPort
    : await pickFreePort(requestedPort + 1);

  printHeader(port);

  const child = spawn(process.execPath, [SERVER_JS], {
    cwd: STANDALONE_DIR,
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: HOST,
      NODE_ENV: "production",
    },
  });

  // Best-effort browser open after the server has had a moment to come up
  if (process.env.CCM_NO_OPEN !== "1") {
    setTimeout(() => openBrowser(`http://localhost:${port}`), 1200);
  }

  const shutdown = (signal) => {
    child.kill(signal);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  child.on("exit", (code) => process.exit(code ?? 0));
})();
