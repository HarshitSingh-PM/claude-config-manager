// Bridge to Electron's preload (electron/preload.js). Undefined in a plain
// browser, where a dropped file's absolute path is deliberately unavailable.

declare global {
  interface Window {
    ccmDesktop?: {
      isDesktop: boolean;
      getPathForFile: (file: File) => string | null;
    };
  }
}

export function isDesktop(): boolean {
  return typeof window !== "undefined" && Boolean(window.ccmDesktop?.isDesktop);
}

/** Resolve the absolute filesystem path of a dropped File (desktop only). */
export function resolveDroppedPath(file: File): string | null {
  if (typeof window !== "undefined" && window.ccmDesktop) {
    return window.ccmDesktop.getPathForFile(file);
  }
  // Fallback for older Electron builds that still exposed the non-standard
  // File.path property directly on the object.
  const legacy = (file as unknown as { path?: string }).path;
  return legacy || null;
}

/** POSIX single-quote a path so it can be pasted safely into a shell. */
export function shellQuote(p: string): string {
  return `'${p.replace(/'/g, "'\\''")}'`;
}

export {};
