import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import readline from "node:readline";
import path from "node:path";
import os from "node:os";

// Shared session-transcript scanner. Used by BOTH /api/sessions (to list
// sessions) and /api/projects (to promote directories that sessions worked on
// into the project list). A single module-level cache means the 260MB tree is
// read at most once per file-version regardless of which route asks.

export function claudeDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}
export function sessionsRoot(): string {
  return path.join(claudeDir(), "projects");
}

// Home subfolders that are never a project — used when tallying which paths a
// session worked on.
const SKIP_SEGMENTS = new Set([
  ".claude", ".Trash", ".cache", ".npm", ".config", ".vscode", ".cursor",
  "Library", "Downloads", "Applications", "Movies", "Music", "Pictures",
  "Public", "node_modules", "go", "Desktop", "Documents",
]);

export type SessionScan = {
  messages: number;
  firstPrompt: string | null;
  firstTimestamp: number | null;
  cwd: string | null;
  gitBranch: string | null;
  mentions: Record<string, number>;
};

export type ScannedSession = SessionScan & {
  id: string;
  dir: string;
  filePath: string;
  modified: number | null;
  created: number | null;
  sizeBytes: number;
};

const scanCache = new Map<string, { key: string; data: SessionScan }>();

function looksLikeNoise(text: string): boolean {
  const t = text.trimStart();
  if (!t) return true;
  return (
    t.startsWith("<command-name>") ||
    t.startsWith("<command-message>") ||
    t.startsWith("<local-command") ||
    t.startsWith("<bash-") ||
    t.startsWith("Caveat:") ||
    t.startsWith("<system-reminder>") ||
    t.includes("local-command-stdout") ||
    t.includes("local-agent-mode-sessions") ||
    t.startsWith("[Request interrupted")
  );
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      const b = block as { type?: string; text?: string } | null;
      if (b && b.type === "text" && typeof b.text === "string") parts.push(b.text);
    }
    return parts.join("\n");
  }
  return "";
}

async function scanSession(filePath: string, home: string): Promise<SessionScan> {
  const data: SessionScan = {
    messages: 0, firstPrompt: null, firstTimestamp: null,
    cwd: null, gitBranch: null, mentions: {},
  };
  const escapedHome = home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Capture up to TWO path segments after $HOME so projects nested under a
  // container dir (~/projects/foo) are distinguishable from top-level ones.
  const mentionRe = new RegExp(
    `${escapedHome}/([A-Za-z0-9._-]+)(?:/([A-Za-z0-9._-]+))?`,
    "g",
  );

  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  try {
    for await (const line of rl) {
      if (!line) continue;
      const slice = line.length > 4000 ? line.slice(0, 4000) : line;
      mentionRe.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = mentionRe.exec(slice)) !== null) {
        const seg1 = m[1];
        if (seg1.startsWith(".") || SKIP_SEGMENTS.has(seg1)) continue;
        const oneSeg = `${home}/${seg1}`;
        data.mentions[oneSeg] = (data.mentions[oneSeg] ?? 0) + 1;
        if (m[2]) {
          const twoSeg = `${oneSeg}/${m[2]}`;
          data.mentions[twoSeg] = (data.mentions[twoSeg] ?? 0) + 1;
        }
      }

      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      const t = obj.type;
      if (t === "user" || t === "assistant") data.messages++;
      if (!data.cwd && typeof obj.cwd === "string") data.cwd = obj.cwd;
      if (!data.gitBranch && typeof obj.gitBranch === "string") data.gitBranch = obj.gitBranch;
      if (data.firstTimestamp === null && typeof obj.timestamp === "string") {
        const ts = Date.parse(obj.timestamp);
        if (!Number.isNaN(ts)) data.firstTimestamp = ts;
      }
      if (!data.firstPrompt && t === "user" && !obj.isSidechain && !obj.isMeta) {
        const msg = obj.message as { content?: unknown } | undefined;
        const txt = extractText(msg?.content).trim();
        if (txt && !looksLikeNoise(txt)) data.firstPrompt = txt.replace(/\s+/g, " ").slice(0, 200);
      }
    }
  } finally {
    rl.close();
  }
  return data;
}

export async function scanAllSessions(): Promise<ScannedSession[]> {
  const home = os.homedir();
  const root = sessionsRoot();
  let dirs: string[] = [];
  try {
    dirs = (await fs.readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }

  const nested = await Promise.all(
    dirs.map(async (dir) => {
      const dirPath = path.join(root, dir);
      let files: string[] = [];
      try {
        files = (await fs.readdir(dirPath)).filter((f) => f.endsWith(".jsonl"));
      } catch {
        return [];
      }
      return Promise.all(
        files.map(async (file): Promise<ScannedSession | null> => {
          const filePath = path.join(dirPath, file);
          const st = await fs.stat(filePath).catch(() => null);
          if (!st || !st.isFile()) return null;
          const cacheKey = `${st.mtimeMs}:${st.size}`;
          let cached = scanCache.get(filePath);
          if (!cached || cached.key !== cacheKey) {
            cached = { key: cacheKey, data: await scanSession(filePath, home) };
            scanCache.set(filePath, cached);
          }
          const d = cached.data;
          return {
            ...d,
            id: file.replace(/\.jsonl$/, ""),
            dir,
            filePath,
            modified: st.mtimeMs,
            created: d.firstTimestamp ?? (st.birthtimeMs || null),
            sizeBytes: st.size,
          };
        }),
      );
    }),
  );

  return nested.flat().filter((s): s is ScannedSession => s !== null);
}

export function dropFromCache(filePath: string) {
  scanCache.delete(filePath);
}
