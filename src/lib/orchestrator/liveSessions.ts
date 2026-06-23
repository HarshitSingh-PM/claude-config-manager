// Observe claude sessions ALREADY running on this machine (terminals, other
// Claude Code windows) — ones the orchestrator did not launch. We can't stream
// them like our own child processes, so we tail their transcripts in
// ~/.claude/projects to surface what each is currently doing, and best-effort
// count live `claude` processes for a headline number. Read-only.

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { type LiveSession } from "./types";

const EDGE = 64 * 1024; // bytes read from each end of a transcript

function projectsRoot(): string {
  return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "projects");
}

function isNoise(text: string): boolean {
  const t = text.trimStart();
  return (
    !t ||
    t.startsWith("<command-") ||
    t.startsWith("<local-command") ||
    t.includes("local-agent-mode") ||
    t.includes("system-reminder") ||
    t.startsWith("Caveat:") ||
    t.startsWith("[Request interrupted")
  );
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const b of content) {
      const x = b as { type?: string; text?: string };
      if (x && x.type === "text" && typeof x.text === "string") parts.push(x.text);
    }
    return parts.join(" ");
  }
  return "";
}

function describeTool(name: string, input: Record<string, unknown>): { kind: LiveSession["lastActivityKind"]; label: string } {
  const s = (k: string) => (typeof input?.[k] === "string" ? (input[k] as string) : "");
  if (name === "Task" || name === "Agent")
    return { kind: "subagent", label: `Delegating → ${input.subagent_type || input.description || "subagent"}` };
  if (name === "Skill") return { kind: "skill", label: `Skill · ${s("command") || s("skill") || "skill"}` };
  if (name.startsWith("mcp__")) return { kind: "mcp", label: name };
  const detail =
    s("command") || s("file_path") || s("pattern") || s("url") || s("query") || s("notebook_path") || "";
  const short = detail.replace(/\s+/g, " ").trim().slice(0, 60);
  return { kind: "tool", label: `${name}${short ? " · " + short : ""}` };
}

async function readEdges(file: string, size: number): Promise<{ head: string; tail: string }> {
  const fd = await fs.open(file, "r");
  try {
    const headLen = Math.min(size, EDGE);
    const headBuf = Buffer.alloc(headLen);
    await fd.read(headBuf, 0, headLen, 0);
    const tailLen = Math.min(size, EDGE);
    const tailBuf = Buffer.alloc(tailLen);
    await fd.read(tailBuf, 0, tailLen, Math.max(0, size - tailLen));
    return { head: headBuf.toString("utf8"), tail: tailBuf.toString("utf8") };
  } finally {
    await fd.close();
  }
}

function parseLines(chunk: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const line of chunk.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      /* partial line at a chunk boundary — skip */
    }
  }
  return out;
}

function titleFrom(headLines: Record<string, unknown>[]): string {
  for (const o of headLines) {
    if (o.type !== "user" || o.isMeta) continue;
    const msg = o.message as { content?: unknown } | undefined;
    const text = extractText(msg?.content);
    if (!isNoise(text)) return text.replace(/\s+/g, " ").trim().slice(0, 120);
  }
  return "Claude session";
}

// Walk the tail backwards to find the most recent meaningful activity.
function activityFrom(tailLines: Record<string, unknown>[]): {
  label: string;
  kind: LiveSession["lastActivityKind"];
  at: number;
  model?: string;
  cwd?: string;
  subagentActive: boolean;
} {
  let model: string | undefined;
  let cwd: string | undefined;
  let subagentActive = false;
  for (let i = tailLines.length - 1; i >= 0; i--) {
    const o = tailLines[i];
    if (!cwd && typeof o.cwd === "string") cwd = o.cwd;
    if (o.isSidechain) subagentActive = true;
    const ts = typeof o.timestamp === "string" ? Date.parse(o.timestamp as string) : NaN;
    if (o.type === "assistant") {
      const msg = o.message as { content?: unknown[]; model?: string } | undefined;
      if (!model && msg?.model) model = msg.model;
      const blocks = Array.isArray(msg?.content) ? msg!.content : [];
      // most recent tool use in this message wins
      for (let j = blocks.length - 1; j >= 0; j--) {
        const b = blocks[j] as Record<string, unknown>;
        if (b.type === "tool_use") {
          const d = describeTool(String(b.name || ""), (b.input as Record<string, unknown>) || {});
          return { ...d, at: ts || 0, model, cwd, subagentActive };
        }
      }
      const text = extractText(msg?.content);
      if (text.trim()) return { label: "Writing response…", kind: "text", at: ts || 0, model, cwd, subagentActive };
    }
    if (o.type === "user") {
      const msg = o.message as { content?: unknown } | undefined;
      const content = msg?.content;
      const isToolResult =
        Array.isArray(content) && content.some((b) => (b as { type?: string }).type === "tool_result");
      if (!isToolResult) {
        const text = extractText(content);
        if (!isNoise(text)) return { label: "Waiting for input", kind: "idle", at: ts || 0, model, cwd, subagentActive };
      }
    }
  }
  return { label: "Active", kind: "idle", at: 0, model, cwd, subagentActive };
}

export async function listActiveSessions(maxAgeMs = 30 * 60 * 1000, limit = 12): Promise<LiveSession[]> {
  const root = projectsRoot();
  const cutoff = Date.now() - maxAgeMs;
  let dirs: string[] = [];
  try {
    dirs = await fs.readdir(root);
  } catch {
    return [];
  }
  // collect recently-modified .jsonl files across all project dirs
  const candidates: { file: string; mtime: number; size: number }[] = [];
  await Promise.all(
    dirs.map(async (d) => {
      const dir = path.join(root, d);
      let files: string[] = [];
      try {
        files = await fs.readdir(dir);
      } catch {
        return;
      }
      for (const f of files) {
        if (!f.endsWith(".jsonl")) continue;
        try {
          const st = await fs.stat(path.join(dir, f));
          if (st.mtimeMs >= cutoff) candidates.push({ file: path.join(dir, f), mtime: st.mtimeMs, size: st.size });
        } catch {
          /* ignore */
        }
      }
    }),
  );
  candidates.sort((a, b) => b.mtime - a.mtime);
  const top = candidates.slice(0, limit);

  const sessions = await Promise.all(
    top.map(async (c): Promise<LiveSession | null> => {
      try {
        const { head, tail } = await readEdges(c.file, c.size);
        const headLines = parseLines(head);
        const tailLines = parseLines(tail);
        const act = activityFrom(tailLines);
        const cwd = act.cwd || os.homedir();
        return {
          sessionId: path.basename(c.file, ".jsonl"),
          title: titleFrom(headLines),
          cwd,
          project: path.basename(cwd) || "~",
          model: act.model,
          lastActivity: act.label,
          lastActivityKind: act.kind,
          lastActiveAt: act.at || c.mtime,
          sizeBytes: c.size,
          subagentActive: act.subagentActive,
        };
      } catch {
        return null;
      }
    }),
  );
  return sessions.filter((s): s is LiveSession => s !== null);
}

// Best-effort count of interactive `claude` processes (not our headless -p runs,
// not the dev server). Returns null if `ps` isn't available.
export function countClaudeProcesses(): Promise<number | null> {
  return new Promise((resolve) => {
    execFile("ps", ["-axo", "command="], { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(null);
      let n = 0;
      for (const raw of stdout.split("\n")) {
        const c = raw.trim();
        if (!c) continue;
        const first = c.split(/\s+/)[0];
        const isClaude = /(^|\/)claude$/.test(first);
        if (!isClaude) continue;
        // exclude our own headless runs and anything obviously not a session
        if (/--output-format|stream-json|(^|\s)-p(\s|$)/.test(c)) continue;
        n++;
      }
      resolve(n);
    });
  });
}
