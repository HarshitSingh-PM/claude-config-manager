import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { scanAllSessions, sessionsRoot, dropFromCache } from "@/lib/sessionScan";

export const dynamic = "force-dynamic";

// App-owned sidecar holding per-session labels + manual project assignment.
function metaPath(): string {
  return path.join(sessionsRoot(), ".ccm-sessions.json");
}

async function readMeta(): Promise<Record<string, { name?: string; projectPath?: string }>> {
  try {
    return JSON.parse(await fs.readFile(metaPath(), "utf8"));
  } catch {
    return {};
  }
}
async function writeMeta(meta: Record<string, { name?: string; projectPath?: string }>) {
  await fs.mkdir(path.dirname(metaPath()), { recursive: true });
  await fs.writeFile(metaPath(), JSON.stringify(meta, null, 2), "utf8");
}

// Top candidate paths (absolute), most-mentioned first — the client matches
// these against the real project list to resolve the project.
function topMentions(mentions: Record<string, number>): { path: string; count: number }[] {
  return Object.entries(mentions)
    .map(([p, count]) => ({ path: p, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function GET() {
  const home = os.homedir();
  const [scanned, meta] = await Promise.all([scanAllSessions(), readMeta()]);

  const sessions = scanned
    .map((s) => {
      const customName = meta[s.id]?.name ?? null;
      return {
        id: s.id,
        dir: s.dir,
        filePath: s.filePath,
        customName,
        firstPrompt: s.firstPrompt,
        title: customName || s.firstPrompt || "(untitled session)",
        messages: s.messages,
        created: s.created,
        modified: s.modified,
        sizeBytes: s.sizeBytes,
        gitBranch: s.gitBranch,
        launchCwd: s.cwd,
        assignedProjectPath: meta[s.id]?.projectPath ?? null,
        mentions: topMentions(s.mentions),
      };
    })
    .sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0));

  return NextResponse.json({ home, count: sessions.length, sessions });
}

// Rename (label) and/or assign a session to a project.
export async function POST(req: Request) {
  const body = (await req.json()) as {
    id?: string;
    name?: string | null;
    projectPath?: string | null;
  };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const meta = await readMeta();
  const entry = { ...(meta[body.id] ?? {}) };
  if (body.name !== undefined) {
    const n = (body.name ?? "").trim();
    if (n) entry.name = n;
    else delete entry.name;
  }
  if (body.projectPath !== undefined) {
    if (body.projectPath) entry.projectPath = body.projectPath;
    else delete entry.projectPath;
  }
  if (Object.keys(entry).length) meta[body.id] = entry;
  else delete meta[body.id];
  await writeMeta(meta);
  return NextResponse.json({ ok: true });
}

// Permanently delete a session transcript (frees disk, removes it from /resume).
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const filePath = url.searchParams.get("path");
  const id = url.searchParams.get("id");
  if (!filePath) return NextResponse.json({ error: "path required" }, { status: 400 });
  const root = sessionsRoot();
  const resolved = path.resolve(filePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "path outside sessions root" }, { status: 403 });
  }
  if (!resolved.endsWith(".jsonl")) {
    return NextResponse.json({ error: "not a session file" }, { status: 400 });
  }
  try {
    await fs.unlink(resolved);
    dropFromCache(resolved);
    if (id) {
      const meta = await readMeta();
      if (meta[id]) {
        delete meta[id];
        await writeMeta(meta);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
