import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";

// ─── What makes a directory a "project" ──────────────────────────
// Any of these present at the top level → we treat the dir as a project.
const PROJECT_MARKERS = [
  ".git",
  ".claude",
  "CLAUDE.md",
  "CLAUDE.local.md",
  "AGENTS.md",
  ".mcp.json",
  "summary.md",
];

// ─── The per-project files we surface ────────────────────────────
// Order = display order. "kind" drives the editor mode + icon on the client.
type RelevantFileDef = { kind: string; label: string; rel: string; format: "markdown" | "json" };
const RELEVANT_FILES: RelevantFileDef[] = [
  { kind: "claudemd", label: "CLAUDE.md", rel: "CLAUDE.md", format: "markdown" },
  { kind: "claudelocal", label: "CLAUDE.local.md", rel: "CLAUDE.local.md", format: "markdown" },
  { kind: "summary", label: "summary.md", rel: "summary.md", format: "markdown" },
  { kind: "agents", label: "AGENTS.md", rel: "AGENTS.md", format: "markdown" },
  { kind: "settings", label: ".claude/settings.json", rel: ".claude/settings.json", format: "json" },
  {
    kind: "settingsLocal",
    label: ".claude/settings.local.json",
    rel: ".claude/settings.local.json",
    format: "json",
  },
  { kind: "mcp", label: ".mcp.json", rel: ".mcp.json", format: "json" },
];

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function statSafe(p: string) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

// Is `dir` a project (has at least one marker)?
async function detectProject(dir: string): Promise<boolean> {
  for (const m of PROJECT_MARKERS) {
    // eslint-disable-next-line no-await-in-loop
    if (await exists(path.join(dir, m))) return true;
  }
  return false;
}

// Count entries in a .claude subdir (agents/commands/skills) — best-effort.
async function countDir(p: string): Promise<number> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.filter((e) => !e.name.startsWith(".")).length;
  } catch {
    return 0;
  }
}

// Pull the real cwd of recent Claude sessions out of ~/.claude/projects/*.
// The directory names are path-encoded (slashes → dashes) which is lossy, so we
// read the `cwd` field from the first line of any session .jsonl instead.
async function claudeSessionCwds(): Promise<Map<string, number>> {
  const out = new Map<string, number>(); // cwd → most-recent mtime
  const root = path.join(os.homedir(), ".claude", "projects");
  let dirs: string[] = [];
  try {
    dirs = (await fs.readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return out;
  }
  await Promise.all(
    dirs.map(async (d) => {
      const dirPath = path.join(root, d);
      let files: string[] = [];
      try {
        files = (await fs.readdir(dirPath)).filter((f) => f.endsWith(".jsonl"));
      } catch {
        return;
      }
      let newest = 0;
      let cwd: string | null = null;
      for (const f of files) {
        const full = path.join(dirPath, f);
        // eslint-disable-next-line no-await-in-loop
        const st = await statSafe(full);
        if (!st) continue;
        if (st.mtimeMs > newest) newest = st.mtimeMs;
        if (!cwd) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const head = await fs.readFile(full, "utf8");
            // The `cwd` field isn't always on line 0 — early lines can be
            // metadata. Scan the first chunk of lines until we find it.
            for (const line of head.split("\n", 40)) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                if (typeof parsed?.cwd === "string") {
                  cwd = parsed.cwd;
                  break;
                }
              } catch {
                /* skip non-JSON line */
              }
            }
          } catch {
            /* skip unreadable file */
          }
        }
      }
      if (cwd) {
        const prev = out.get(cwd) ?? 0;
        if (newest > prev) out.set(cwd, newest);
      }
    }),
  );
  return out;
}

export async function GET() {
  const home = os.homedir();

  // 1. Candidate directories: one level under a set of common roots.
  const searchRoots = [
    home,
    path.join(home, "projects"),
    path.join(home, "Projects"),
    path.join(home, "Developer"),
    path.join(home, "dev"),
    path.join(home, "Code"),
    path.join(home, "code"),
    path.join(home, "src"),
    path.join(home, "work"),
    path.join(home, "repos"),
    path.join(home, "Documents"),
    path.join(home, "Desktop"),
  ];

  const candidates = new Set<string>();
  await Promise.all(
    searchRoots.map(async (root) => {
      let entries: { name: string; isDirectory: () => boolean }[] = [];
      try {
        entries = await fs.readdir(root, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith(".")) continue; // skip hidden dirs (incl. ~/.claude)
        candidates.add(path.join(root, e.name));
      }
    }),
  );

  // 2. Add real cwds from recent Claude sessions (authoritative + gives recency).
  const sessionCwds = await claudeSessionCwds();
  for (const cwd of sessionCwds.keys()) candidates.add(cwd);

  // Canonicalize + dedup. On case-insensitive filesystems (default on macOS)
  // ~/projects and ~/Projects are the same directory but distinct strings;
  // realpath collapses them (and resolves symlinks) to one canonical path.
  const canonical = new Map<string, string>(); // realpath → realpath
  await Promise.all(
    [...candidates].map(async (dir) => {
      try {
        const real = await fs.realpath(dir);
        canonical.set(real, real);
      } catch {
        /* dir vanished — skip */
      }
    }),
  );

  // 3. Keep only the ones that look like projects, gather their files.
  const projects = await Promise.all(
    [...canonical.values()].map(async (dir) => {
      // The home dir itself isn't a "project" — its .claude/ is the global
      // config, already editable under the Config → Global Claude tab.
      if (dir === home) return null;
      const isProject = await detectProject(dir);
      if (!isProject) return null;

      const files = await Promise.all(
        RELEVANT_FILES.map(async (def) => {
          const abs = path.join(dir, def.rel);
          const st = await statSafe(abs);
          return {
            kind: def.kind,
            label: def.label,
            format: def.format,
            absolutePath: abs,
            exists: Boolean(st && st.isFile()),
            size: st?.isFile() ? st.size : 0,
            mtime: st?.mtimeMs ?? null,
          };
        }),
      );

      const claudeDir = path.join(dir, ".claude");
      const [hasGit, agents, commands, skills] = await Promise.all([
        exists(path.join(dir, ".git")),
        countDir(path.join(claudeDir, "agents")),
        countDir(path.join(claudeDir, "commands")),
        countDir(path.join(claudeDir, "skills")),
      ]);

      const presentCount = files.filter((f) => f.exists).length;
      // Recency: prefer Claude session mtime, else newest relevant file.
      const fileMtimes = files.map((f) => f.mtime ?? 0);
      const lastActive = Math.max(sessionCwds.get(dir) ?? 0, ...fileMtimes, 0) || null;

      return {
        name: path.basename(dir),
        path: dir,
        hasGit,
        lastActive,
        seenByClaude: sessionCwds.has(dir),
        counts: { agents, commands, skills },
        presentCount,
        files,
      };
    }),
  );

  const filtered = projects
    .filter((p): p is NonNullable<typeof p> => p !== null)
    // Sort: most recently active first, then by name.
    .sort((a, b) => {
      if ((b.lastActive ?? 0) !== (a.lastActive ?? 0)) {
        return (b.lastActive ?? 0) - (a.lastActive ?? 0);
      }
      return a.name.localeCompare(b.name);
    });

  return NextResponse.json({ home, count: filtered.length, projects: filtered });
}
