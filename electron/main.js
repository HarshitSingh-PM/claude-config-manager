/* eslint-disable */
// Electron main process — wraps the existing Next.js standalone server in a
// native window. The server runs in a child Node process (via the
// ELECTRON_RUN_AS_NODE trick so we don't bundle a separate node binary).

const { app, BrowserWindow, shell, Menu, utilityProcess } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const net = require("node:net");

let serverProcess = null;
let serverPort = null;
let mainWindow = null;

// PID file: holds the spawned server's PID. If the parent is force-killed,
// the child becomes an orphan. On next launch we read this file and try to
// reap whatever's still alive before starting fresh.
const PID_FILE = path.join(os.tmpdir(), "claude-config-ui.server.pid");

function reapStaleChild() {
  try {
    if (!fs.existsSync(PID_FILE)) return;
    const raw = fs.readFileSync(PID_FILE, "utf8").trim();
    const pid = Number(raw);
    if (!Number.isFinite(pid) || pid <= 1) return;
    try {
      // Probe — sending signal 0 throws if process doesn't exist
      process.kill(pid, 0);
      // It's alive — kill it
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* ignore */
      }
      // Give it a moment, then SIGKILL if still around
      setTimeout(() => {
        try {
          process.kill(pid, 0);
          process.kill(pid, "SIGKILL");
        } catch {
          /* gone */
        }
      }, 500);
    } catch {
      // Already dead
    }
  } catch {
    /* ignore */
  } finally {
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
      /* ignore */
    }
  }
}

function writePidFile(pid) {
  try {
    fs.writeFileSync(PID_FILE, String(pid));
  } catch {
    /* not fatal */
  }
}

function clearPidFile() {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    /* ignore */
  }
}

function killServer() {
  if (!serverProcess) return;
  try {
    // utilityProcess exposes .kill(); it returns true/false rather than taking a signal.
    serverProcess.kill();
  } catch {
    /* ignore */
  }
  serverProcess = null;
  clearPidFile();
}

// In a packaged app, app.isPackaged is true and standalone lives in
// Resources/standalone (set by electron-builder extraResources). In dev,
// it's at the repo root .next/standalone.
function resolveServerJs() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone", "server.js");
  }
  return path.join(__dirname, "..", ".next", "standalone", "server.js");
}

// ─── Free-port picker ─────────────────────────────────────────
function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.once("error", () => resolve(false));
    srv.listen({ port, host: "127.0.0.1", exclusive: true }, () => {
      srv.close(() => resolve(true));
    });
  });
}
async function pickFreePort(start = 3737) {
  for (let p = start; p < start + 50; p++) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(p)) return p;
  }
  return start;
}

// Wait until the server is actually accepting connections on the chosen port.
async function waitForServer(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortFree(port);
    if (!free) return; // port in use = server is listening
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`Next.js server didn't start within ${timeoutMs}ms`);
}

// ─── Start the bundled Next.js server ─────────────────────────
async function startServer() {
  // First: clean up anything left behind by a previous force-killed instance.
  reapStaleChild();

  const serverJs = resolveServerJs();
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Server not found at ${serverJs}. ` +
        `In dev, run \`npm run build:standalone\` first.`,
    );
  }
  serverPort = await pickFreePort();

  // Run the Next.js server with Electron's built-in utilityProcess instead of
  // child_process.spawn + ELECTRON_RUN_AS_NODE. Two big wins:
  //   1. No second Dock icon — utilityProcess never initializes Cocoa, so the
  //      server child stays invisible (the old "exec" icon is gone).
  //   2. The child's lifetime is bound to this process — it's torn down
  //      automatically when the app exits, even on a hard quit.
  serverProcess = utilityProcess.fork(serverJs, [], {
    cwd: path.dirname(serverJs),
    env: {
      ...process.env,
      PORT: String(serverPort),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: process.env.CCM_DEBUG === "1" ? "inherit" : "ignore",
    serviceName: "claude-config-server",
  });

  serverProcess.on("spawn", () => {
    if (serverProcess && serverProcess.pid) writePidFile(serverProcess.pid);
  });

  serverProcess.on("exit", (code) => {
    serverProcess = null;
    clearPidFile();
    if (code !== 0 && code !== null) {
      console.error(`Next.js server exited unexpectedly (code ${code})`);
    }
  });

  await waitForServer(serverPort);
}

// ─── Window ──────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    // Use the standard native title bar so the window drags/moves like any
    // other app. (The previous "hiddenInset" hid the bar but the web content
    // defined no -webkit-app-region drag strip, so the window couldn't be moved.)
    titleBarStyle: "default",
    backgroundColor: "#0a0a0c",
    title: "Claude Config",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Bridges webUtils.getPathForFile() so the renderer can resolve the
      // absolute path of files dragged in from Finder/Explorer.
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links in the default browser, not inside the Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── Minimal native menu ─────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [{ type: "separator" }, { role: "front" }, { type: "separator" }, { role: "window" }]
          : [{ role: "close" }]),
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Project on GitHub",
          click: () =>
            shell.openExternal("https://github.com/HarshitSingh-PM/claude-config-manager"),
        },
        {
          label: "Report an issue",
          click: () =>
            shell.openExternal(
              "https://github.com/HarshitSingh-PM/claude-config-manager/issues/new",
            ),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── App lifecycle ────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    await startServer();
    buildMenu();
    createWindow();
  } catch (err) {
    console.error(err);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Standard macOS pattern: keep app alive when all windows close;
  // user reopens via dock click. On other platforms, quit.
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", killServer);
app.on("will-quit", killServer);

// Catch every catchable signal — best-effort cleanup before death.
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    killServer();
    app.quit();
  });
}
// Node process exit (e.g. uncaught exception path)
process.on("exit", killServer);

// Single-instance lock — don't launch twice
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
