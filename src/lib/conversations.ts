/**
 * Conversation archiver.
 *
 * Reads Claude Code's own session transcripts (~/.claude/projects/<enc>/*.jsonl)
 * and writes a clean, human-readable **Markdown** copy of each conversation —
 * verbatim "You / Claude" turns, no summarization — grouped per project under
 * ~/.claude-config-ui/conversations/<project>/<session>.md.
 *
 * This is purely a LOCAL ARCHIVE the app maintains. It only READS the session
 * files Claude Code already wrote and WRITES separate .md files — it never feeds
 * anything back into Claude, so it costs zero context-window tokens.
 */

import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const PROJECTS_ROOT = path.join(os.homedir(), ".claude", "projects");
export const ARCHIVE_ROOT = path.join(os.homedir(), ".claude-config-ui", "conversations");

type Turn = { role: "user" | "assistant"; text: string; ts?: string };

type ParsedSession = {
  sessionId: string;
  cwd: string | null;
  turns: Turn[];
  firstPrompt: string;
  startedAt: string | null;
  endedAt: string | null;
};

export type ProjectSummary = {
  name: string;
  cwd: string;
  sessions: number;
  archived: number;
};

// Pull plain text out of a message's content (string, or an array of blocks).
// tool_use / tool_result / thinking blocks are intentionally dropped — we want
// the conversation, not the machinery.
function extractText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter(
        (b) => b && typeof b === "object" && (b as { type?: string }).type === "text" &&
          typeof (b as { text?: string }).text === "string",
      )
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
  }
  return "";
}

// Skip system-injected "user" turns that aren't really something the user typed.
function isSyntheticUser(text: string): boolean {
  return (
    text.startsWith("<command-") ||
    text.startsWith("Caveat:") ||
    text.startsWith("[Request interrupted") ||
    text.startsWith("<local-command") ||
    /^<[a-z-]+>[\s\S]*<\/[a-z-]+>$/.test(text.slice(0, 40))
  );
}

async function parseSession(file: string): Promise<ParsedSession | null> {
  let raw: string;
  try {
    raw = await fsp.readFile(file, "utf8");
  } catch {
    return null;
  }
  const turns: Turn[] = [];
  let cwd: string | null = null;
  let sessionId = path.basename(file, ".jsonl");
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let firstPrompt = "";

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let e: Record<string, unknown>;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof e.sessionId === "string") sessionId = e.sessionId;
    if (typeof e.cwd === "string" && !cwd) cwd = e.cwd;
    if (typeof e.timestamp === "string") {
      if (!startedAt) startedAt = e.timestamp;
      endedAt = e.timestamp;
    }
    const msg = e.message as { role?: string; content?: unknown } | undefined;
    if (e.type === "user" && msg?.role === "user") {
      const text = extractText(msg.content);
      if (text && !isSyntheticUser(text)) {
        if (!firstPrompt) firstPrompt = text;
        turns.push({ role: "user", text, ts: e.timestamp as string });
      }
    } else if (e.type === "assistant" && msg?.role === "assistant") {
      const text = extractText(msg.content);
      if (text) turns.push({ role: "assistant", text, ts: e.timestamp as string });
    }
  }
  if (!turns.length) return null;
  return { sessionId, cwd, turns, firstPrompt, startedAt, endedAt };
}

function projectNameFromCwd(cwd: string | null): { name: string; cwd: string } {
  if (!cwd) return { name: "unknown", cwd: "unknown" };
  return { name: path.basename(cwd) || "root", cwd };
}

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return iso.replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function renderMarkdown(s: ParsedSession, projectName: string): string {
  const title = s.firstPrompt.split("\n")[0].slice(0, 80) || "(untitled session)";
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`> **Project:** ${projectName}  `);
  if (s.cwd) lines.push(`> **Folder:** \`${s.cwd}\`  `);
  lines.push(`> **Session:** \`${s.sessionId}\`  `);
  lines.push(`> **When:** ${fmtDate(s.startedAt)} → ${fmtDate(s.endedAt)}  `);
  lines.push(`> **Turns:** ${s.turns.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  for (const t of s.turns) {
    lines.push(t.role === "user" ? "### 🧑 You" : "### 🤖 Claude");
    lines.push("");
    lines.push(t.text);
    lines.push("");
  }
  return lines.join("\n");
}

/** Export every session to Markdown (incremental: skips ones already current). */
export async function archiveAll(
  filterCwd?: string,
): Promise<{ projects: ProjectSummary[]; totalSessions: number; totalArchived: number; archiveRoot: string }> {
  let dirs: string[];
  try {
    dirs = await fsp.readdir(PROJECTS_ROOT);
  } catch {
    return { projects: [], totalSessions: 0, totalArchived: 0, archiveRoot: ARCHIVE_ROOT };
  }

  const byProject = new Map<string, ProjectSummary>();
  let totalSessions = 0;
  let totalArchived = 0;

  for (const dir of dirs) {
    const dirPath = path.join(PROJECTS_ROOT, dir);
    let files: string[];
    try {
      const st = await fsp.stat(dirPath);
      if (!st.isDirectory()) continue;
      files = (await fsp.readdir(dirPath)).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }

    for (const f of files) {
      const jsonlPath = path.join(dirPath, f);
      const parsed = await parseSession(jsonlPath);
      if (!parsed) continue;
      const { name, cwd } = projectNameFromCwd(parsed.cwd);
      if (filterCwd && cwd !== filterCwd) continue;
      totalSessions++;

      const proj = byProject.get(cwd) ?? { name, cwd, sessions: 0, archived: 0 };
      proj.sessions++;

      const outDir = path.join(ARCHIVE_ROOT, slug(name));
      // sessionId comes from the transcript's own content — slug it so a
      // malicious "../../x" value can't write outside the archive root.
      const outFile = path.join(outDir, `${slug(parsed.sessionId)}.md`);

      // Incremental: only (re)write if the source is newer than the archive.
      let needsWrite = true;
      try {
        const [src, dst] = await Promise.all([fsp.stat(jsonlPath), fsp.stat(outFile)]);
        if (dst.mtimeMs >= src.mtimeMs) needsWrite = false;
      } catch {
        /* archive missing — write it */
      }
      if (needsWrite) {
        await fsp.mkdir(outDir, { recursive: true });
        await fsp.writeFile(outFile, renderMarkdown(parsed, name), "utf8");
        proj.archived++;
        totalArchived++;
      }
      byProject.set(cwd, proj);
    }
  }

  const projects = [...byProject.values()].sort((a, b) => b.sessions - a.sessions);
  return { projects, totalSessions, totalArchived, archiveRoot: ARCHIVE_ROOT };
}
