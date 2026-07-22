/**
 * Server-side PTY session registry.
 *
 * A single long-lived process (the Next.js standalone server, which under
 * Electron runs inside `utilityProcess`) owns every live terminal. Browsers
 * talk to these sessions over HTTP:
 *   - SSE   GET  /api/terminal/[id]        → live output (+ scrollback replay)
 *   - POST       /api/terminal/[id]        → { op: "input" | "resize" }
 *   - DELETE     /api/terminal/[id]        → kill
 *
 * Because sessions live in process memory, they survive React remounts, view
 * switches, and full page reloads — the scrollback ring buffer is replayed to
 * any (re)connecting client so the terminal looks continuous.
 *
 * node-pty ships N-API prebuilds (ABI-stable across Node and Electron), so the
 * same binary loads in `next dev` (system Node) and in the packaged Electron
 * app (utilityProcess) with no rebuild. See scripts/pack-standalone.js for the
 * one packaging wrinkle (the darwin spawn-helper needs its exec bit restored).
 */

import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";

// ─── On-disk transcripts ──────────────────────────────────────────────
// Every session's raw output is streamed to <TRANSCRIPT_DIR>/<id>.log and its
// metadata to <id>.json, so transcripts survive an app/server restart (the live
// PTY process cannot, but its record can be viewed and its folder reopened).
const TRANSCRIPT_DIR = path.join(os.homedir(), ".claude-config-ui", "terminals");
const MAX_TRANSCRIPT_BYTES = 25 * 1024 * 1024; // per session
const KEEP_TRANSCRIPTS = 100; // retention: most-recent N

export type TranscriptMeta = {
  id: string;
  title: string;
  shell: string;
  cwd: string;
  launch: "shell" | "claude";
  createdAt: number;
  endedAt: number | null;
  exitCode: number | null;
  bytes: number;
  truncated: boolean;
};

function ensureDir() {
  try {
    fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });
  } catch {
    /* best effort */
  }
}

function metaPath(id: string) {
  return path.join(TRANSCRIPT_DIR, `${id}.json`);
}
function logPath(id: string) {
  return path.join(TRANSCRIPT_DIR, `${id}.log`);
}

function writeMeta(m: TranscriptMeta) {
  fsp.writeFile(metaPath(m.id), JSON.stringify(m), "utf8").catch(() => {});
}

// node-pty is a native module. Load it lazily and defensively so a missing /
// broken binary degrades to "terminal unavailable" instead of crashing every
// API route in the server.
type IPty = {
  pid: number;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
};
type PtyModule = {
  spawn: (
    file: string,
    args: string[] | string,
    opts: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: Record<string, string | undefined>;
    },
  ) => IPty;
};

let ptyModule: PtyModule | null = null;
let ptyLoadError: string | null = null;
function loadPty(): PtyModule | null {
  if (ptyModule || ptyLoadError) return ptyModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ptyModule = require("node-pty") as PtyModule;
  } catch (err) {
    ptyLoadError = err instanceof Error ? err.message : String(err);
  }
  return ptyModule;
}

export function ptyAvailable(): { ok: boolean; error: string | null } {
  const mod = loadPty();
  return { ok: Boolean(mod), error: ptyLoadError };
}

const SCROLLBACK_LIMIT = 200_000; // ~200 KB of replayable output per session

export type SessionMeta = {
  id: string;
  title: string;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
  createdAt: number;
  exited: boolean;
  exitCode: number | null;
};

type Session = SessionMeta & {
  pty: IPty | null;
  launch: "shell" | "claude";
  buffer: string[]; // scrollback ring (concatenated for replay)
  bufferBytes: number;
  listeners: Set<(chunk: string) => void>;
  exitListeners: Set<(code: number) => void>;
  // On-disk transcript persistence
  stream: fs.WriteStream | null;
  diskBytes: number;
  truncated: boolean;
  // Tail buffer for parsing OSC 7 (cwd) sequences that may span chunks.
  oscTail: string;
};

// Shells (zsh/bash with the right hook) emit the working directory on each
// prompt via OSC 7: ESC ] 7 ; file://<host><path> BEL. Parsing it lets the UI
// follow the terminal into whatever project folder the user cd's into.
const OSC7_RE = /\x1b\]7;file:\/\/[^/]*(\/[^\x07\x1b]*)(?:\x07|\x1b\\)/g;
function parseOsc7Cwd(chunk: string, session: Session): string | null {
  const hay = session.oscTail + chunk;
  session.oscTail = hay.slice(-256); // keep a tail so split sequences still match
  let m: RegExpExecArray | null;
  let last: string | null = null;
  OSC7_RE.lastIndex = 0;
  while ((m = OSC7_RE.exec(hay)) !== null) last = m[1];
  if (!last) return null;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function sessionMetaRecord(s: Session): TranscriptMeta {
  return {
    id: s.id,
    title: s.title,
    shell: s.shell,
    cwd: s.cwd,
    launch: s.launch,
    createdAt: s.createdAt,
    endedAt: s.exited ? Date.now() : null,
    exitCode: s.exitCode,
    bytes: s.diskBytes,
    truncated: s.truncated,
  };
}

// Survive Next.js dev HMR (module re-evaluation) by hanging the map off
// globalThis rather than a module local.
const g = globalThis as unknown as { __ccmTerminals?: Map<string, Session> };
const sessions: Map<string, Session> = g.__ccmTerminals ?? new Map();
g.__ccmTerminals = sessions;

// Small, collision-resistant id without pulling in a uuid dep. crypto is fine
// on the server runtime.
function newId(): string {
  return "t_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function defaultShell(): string {
  if (process.platform === "win32") {
    return process.env.COMSPEC || "powershell.exe";
  }
  return process.env.SHELL || "/bin/zsh";
}

function safeCwd(requested?: string): string {
  const home = os.homedir();
  if (!requested) return home;
  if (!path.isAbsolute(requested)) return home;
  // Keep terminals inside the user's home tree — same spirit as the file API's
  // allow-list, but a terminal is inherently powerful so we only guard the
  // *starting* directory; the user can cd anywhere once inside.
  if (requested === home || requested.startsWith(home + path.sep)) return requested;
  return home;
}

export type CreateOpts = {
  cwd?: string;
  shell?: string;
  cols?: number;
  rows?: number;
  title?: string;
  /** "claude" auto-launches the Claude Code CLI; "shell" is a bare login shell. */
  launch?: "shell" | "claude";
};

export function createSession(opts: CreateOpts): SessionMeta {
  const mod = loadPty();
  if (!mod) throw new Error(ptyLoadError || "node-pty unavailable");

  const cwd = safeCwd(opts.cwd);
  const shell = opts.shell || defaultShell();
  const cols = clampDim(opts.cols, 80);
  const rows = clampDim(opts.rows, 24);
  const id = newId();

  const isWin = process.platform === "win32";
  // For a "claude" session, hand the shell a command that execs the Claude CLI
  // but drops back to an interactive shell if it isn't installed / exits — so a
  // failed launch never leaves a dead pane.
  let args: string[];
  if (opts.launch === "claude" && !isWin) {
    args = ["-lic", "command -v claude >/dev/null 2>&1 && exec claude || exec $SHELL -i"];
  } else if (!isWin) {
    args = ["-il"]; // interactive login shell
  } else {
    args = [];
  }

  const pty = mod.spawn(shell, args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env: { ...process.env, TERM: "xterm-256color", CCM_TERMINAL: "1" },
  });

  const launch = opts.launch === "claude" ? "claude" : "shell";
  const session: Session = {
    id,
    title: opts.title || (launch === "claude" ? "Claude" : "shell"),
    shell,
    cwd,
    cols,
    rows,
    launch,
    createdAt: Date.now(),
    exited: false,
    exitCode: null,
    pty,
    buffer: [],
    bufferBytes: 0,
    listeners: new Set(),
    exitListeners: new Set(),
    stream: null,
    diskBytes: 0,
    truncated: false,
    oscTail: "",
  };

  // Open the on-disk transcript (append) and write initial metadata.
  ensureDir();
  try {
    session.stream = fs.createWriteStream(logPath(id), { flags: "a" });
    session.stream.on("error", () => {
      session.stream = null; // disk trouble shouldn't break the live terminal
    });
  } catch {
    session.stream = null;
  }
  writeMeta(sessionMetaRecord(session));
  pruneTranscripts();

  pty.onData((data) => {
    // Track the live working directory from OSC 7 sequences.
    const cwdUpdate = parseOsc7Cwd(data, session);
    if (cwdUpdate && cwdUpdate !== session.cwd) session.cwd = cwdUpdate;
    // Append to ring buffer, trimming from the front once over the limit.
    session.buffer.push(data);
    session.bufferBytes += data.length;
    while (session.bufferBytes > SCROLLBACK_LIMIT && session.buffer.length > 1) {
      const dropped = session.buffer.shift()!;
      session.bufferBytes -= dropped.length;
    }
    // Persist to the transcript file (bounded).
    if (session.stream && !session.truncated) {
      session.diskBytes += Buffer.byteLength(data);
      if (session.diskBytes > MAX_TRANSCRIPT_BYTES) {
        session.truncated = true;
        session.stream.write("\r\n[transcript truncated — size limit reached]\r\n");
        session.stream.end();
        session.stream = null;
        writeMeta(sessionMetaRecord(session));
      } else {
        session.stream.write(data);
      }
    }
    for (const cb of session.listeners) {
      try {
        cb(data);
      } catch {
        /* a dead subscriber shouldn't break the others */
      }
    }
  });

  pty.onExit(({ exitCode }) => {
    session.exited = true;
    session.exitCode = exitCode;
    session.pty = null;
    if (session.stream) {
      session.stream.end();
      session.stream = null;
    }
    writeMeta(sessionMetaRecord(session));
    for (const cb of session.exitListeners) {
      try {
        cb(exitCode);
      } catch {
        /* ignore */
      }
    }
  });

  sessions.set(id, session);
  return toMeta(session);
}

function clampDim(v: number | undefined, fallback: number): number {
  if (!Number.isFinite(v as number)) return fallback;
  return Math.min(500, Math.max(1, Math.floor(v as number)));
}

function toMeta(s: Session): SessionMeta {
  return {
    id: s.id,
    title: s.title,
    shell: s.shell,
    cwd: s.cwd,
    cols: s.cols,
    rows: s.rows,
    createdAt: s.createdAt,
    exited: s.exited,
    exitCode: s.exitCode,
  };
}

export function listSessions(): SessionMeta[] {
  return [...sessions.values()].sort((a, b) => a.createdAt - b.createdAt).map(toMeta);
}

export function getSessionMeta(id: string): SessionMeta | null {
  const s = sessions.get(id);
  return s ? toMeta(s) : null;
}

export function writeInput(id: string, data: string): boolean {
  const s = sessions.get(id);
  if (!s || !s.pty) return false;
  s.pty.write(data);
  return true;
}

export function resizeSession(id: string, cols: number, rows: number): boolean {
  const s = sessions.get(id);
  if (!s || !s.pty) return false;
  s.cols = clampDim(cols, s.cols);
  s.rows = clampDim(rows, s.rows);
  try {
    s.pty.resize(s.cols, s.rows);
  } catch {
    return false;
  }
  return true;
}

export function renameSession(id: string, title: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  s.title = title.slice(0, 80);
  writeMeta(sessionMetaRecord(s));
  return true;
}

export function killSession(id: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  try {
    s.pty?.kill();
  } catch {
    /* ignore */
  }
  s.exited = true;
  if (s.stream) {
    s.stream.end();
    s.stream = null;
  }
  writeMeta(sessionMetaRecord(s)); // keep the transcript; just mark it ended
  sessions.delete(id);
  return true;
}

// ─── Transcript history (survives restarts) ───────────────────────────

/** All saved transcripts (live + past), newest first. `live` = still running. */
export async function listTranscripts(): Promise<(TranscriptMeta & { live: boolean })[]> {
  ensureDir();
  let names: string[];
  try {
    names = await fsp.readdir(TRANSCRIPT_DIR);
  } catch {
    return [];
  }
  const metas: TranscriptMeta[] = [];
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    try {
      const raw = await fsp.readFile(path.join(TRANSCRIPT_DIR, n), "utf8");
      metas.push(JSON.parse(raw) as TranscriptMeta);
    } catch {
      /* skip corrupt */
    }
  }
  // Live sessions have the freshest byte counts in memory — reflect that.
  return metas
    .map((m) => {
      const live = sessions.has(m.id) && !sessions.get(m.id)!.exited;
      const mem = sessions.get(m.id);
      return { ...m, bytes: mem ? mem.diskBytes : m.bytes, endedAt: live ? null : m.endedAt, live };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Raw transcript text for one session (from disk). Caps the tail returned. */
export async function readTranscript(
  id: string,
  maxBytes = 5 * 1024 * 1024,
): Promise<{ content: string; truncatedHead: boolean } | null> {
  if (!/^t_[a-z0-9]+$/.test(id)) return null; // id shape guard (no path traversal)
  try {
    const p = logPath(id);
    const stat = await fsp.stat(p);
    if (stat.size <= maxBytes) {
      return { content: await fsp.readFile(p, "utf8"), truncatedHead: false };
    }
    // Read only the tail for very large transcripts.
    const fd = await fsp.open(p, "r");
    try {
      const buf = Buffer.alloc(maxBytes);
      await fd.read(buf, 0, maxBytes, stat.size - maxBytes);
      return { content: buf.toString("utf8"), truncatedHead: true };
    } finally {
      await fd.close();
    }
  } catch {
    return null;
  }
}

/** Delete one saved transcript (log + meta). */
export async function deleteTranscript(id: string): Promise<boolean> {
  if (!/^t_[a-z0-9]+$/.test(id)) return false;
  if (sessions.has(id)) killSession(id);
  await fsp.rm(logPath(id), { force: true }).catch(() => {});
  await fsp.rm(metaPath(id), { force: true }).catch(() => {});
  return true;
}

/** Retention: keep only the most-recent KEEP_TRANSCRIPTS, delete older ones. */
function pruneTranscripts() {
  fsp
    .readdir(TRANSCRIPT_DIR)
    .then(async (names) => {
      const metas: TranscriptMeta[] = [];
      for (const n of names) {
        if (!n.endsWith(".json")) continue;
        try {
          metas.push(JSON.parse(await fsp.readFile(path.join(TRANSCRIPT_DIR, n), "utf8")));
        } catch {
          /* skip */
        }
      }
      metas.sort((a, b) => b.createdAt - a.createdAt);
      for (const m of metas.slice(KEEP_TRANSCRIPTS)) {
        if (sessions.has(m.id)) continue; // never prune a live session
        await fsp.rm(logPath(m.id), { force: true }).catch(() => {});
        await fsp.rm(metaPath(m.id), { force: true }).catch(() => {});
      }
    })
    .catch(() => {});
}

/** Replay current scrollback, then stream live output. Returns an unsubscribe. */
export function subscribe(
  id: string,
  onData: (chunk: string) => void,
  onExit: (code: number) => void,
): (() => void) | null {
  const s = sessions.get(id);
  if (!s) return null;
  // Replay buffered scrollback first so a (re)connecting client sees history.
  if (s.buffer.length) onData(s.buffer.join(""));
  if (s.exited) {
    onExit(s.exitCode ?? 0);
    return () => {};
  }
  s.listeners.add(onData);
  s.exitListeners.add(onExit);
  return () => {
    s.listeners.delete(onData);
    s.exitListeners.delete(onExit);
  };
}
