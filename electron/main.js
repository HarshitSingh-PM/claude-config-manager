/* eslint-disable */
// Electron main process — wraps the existing Next.js standalone server in a
// native window. The server runs in a child Node process (via the
// ELECTRON_RUN_AS_NODE trick so we don't bundle a separate node binary).

const { app, BrowserWindow, shell, Menu } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");

let serverProcess = null;
let serverPort = null;
let mainWindow = null;

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
  const serverJs = resolveServerJs();
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Server not found at ${serverJs}. ` +
        `In dev, run \`npm run build:standalone\` first.`,
    );
  }
  serverPort = await pickFreePort();

  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: path.dirname(serverJs),
    env: {
      ...process.env,
      // The magic trick: make Electron's binary behave as a normal Node runtime
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(serverPort),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: process.env.CCM_DEBUG === "1" ? "inherit" : "ignore",
  });

  serverProcess.on("exit", (code) => {
    serverProcess = null;
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
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0c",
    title: "Claude Config",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
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

app.on("before-quit", () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      /* ignore */
    }
  }
});

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
