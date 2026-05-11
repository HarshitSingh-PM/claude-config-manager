import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";

function isSafeAbs(p: string): boolean {
  if (!p) return false;
  if (!path.isAbsolute(p)) return false;
  return true;
}

function isWithinAllowed(p: string): boolean {
  const home = os.homedir();
  const allowed = [
    home,
    process.cwd(),
    "/Library/Application Support/ClaudeCode",
    "/etc/claude-code",
    "C:\\Program Files\\ClaudeCode",
  ];
  return allowed.some((root) => p === root || p.startsWith(root + path.sep) || p.startsWith(root));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get("path");
  if (!target || !isSafeAbs(target)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  if (!isWithinAllowed(target)) {
    return NextResponse.json({ error: "path outside allowed roots" }, { status: 403 });
  }
  try {
    const stat = await fs.stat(target).catch(() => null);
    if (!stat) {
      return NextResponse.json({ exists: false, content: "" });
    }
    if (stat.isDirectory()) {
      const entries = await fs.readdir(target, { withFileTypes: true });
      return NextResponse.json({
        exists: true,
        isDir: true,
        entries: entries.map((e) => ({
          name: e.name,
          isDir: e.isDirectory(),
        })),
      });
    }
    const content = await fs.readFile(target, "utf8");
    return NextResponse.json({ exists: true, isDir: false, content, mtime: stat.mtimeMs });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as { path?: string; content?: string; backup?: boolean };
  const target = body.path;
  const content = body.content ?? "";
  const wantBackup = body.backup !== false;
  if (!target || !isSafeAbs(target)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  if (!isWithinAllowed(target)) {
    return NextResponse.json({ error: "path outside allowed roots" }, { status: 403 });
  }
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    let backupPath: string | null = null;
    if (wantBackup) {
      try {
        const stat = await fs.stat(target);
        if (stat.isFile()) {
          const ts = new Date().toISOString().replace(/[:.]/g, "-");
          backupPath = `${target}.bak-${ts}`;
          await fs.copyFile(target, backupPath);
        }
      } catch {
        /* file didn't exist — no backup needed */
      }
    }
    await fs.writeFile(target, content, "utf8");
    return NextResponse.json({ ok: true, backupPath });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get("path");
  if (!target || !isSafeAbs(target)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  if (!isWithinAllowed(target)) {
    return NextResponse.json({ error: "path outside allowed roots" }, { status: 403 });
  }
  try {
    const stat = await fs.stat(target).catch(() => null);
    if (!stat) return NextResponse.json({ ok: true, noop: true });
    if (stat.isDirectory()) {
      return NextResponse.json({ error: "refusing to delete directory" }, { status: 400 });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${target}.bak-${ts}`;
    await fs.copyFile(target, backupPath);
    await fs.unlink(target);
    return NextResponse.json({ ok: true, backupPath });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
