/* eslint-disable */
// Preload: the only bridge between the sandboxed renderer (which loads the
// Next.js UI over http://127.0.0.1) and Electron's privileged APIs.
//
// Its sole job today is resolving the absolute filesystem path of a file the
// user drags in from Finder/Explorer. Browsers deliberately hide that path for
// security; Electron exposes it via webUtils.getPathForFile(). We surface a
// single, narrow function through contextBridge so the renderer can turn a
// dropped File into a real path without any broader Node access.
const { contextBridge, webUtils } = require("electron");

contextBridge.exposeInMainWorld("ccmDesktop", {
  isDesktop: true,
  /** Absolute path of a dropped File, or null if it can't be resolved. */
  getPathForFile(file) {
    try {
      return webUtils.getPathForFile(file) || null;
    } catch {
      return null;
    }
  },
});
