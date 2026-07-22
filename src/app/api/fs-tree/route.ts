import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lists a single directory level for the terminal workspace file tree. The UI
// expands folders lazily, one request per folder, so we never walk the whole
// tree. Reads are confined to the user's home tree (same spirit as /api/file).
function isWithinHome(p: string): boolean {
  const home = os.homedir();
  return p === home || p.startsWith(home + path.sep);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get("path") || os.homedir();
  const showAll = url.searchParams.get("all") === "1";

  if (!path.isAbsolute(target)) {
    return NextResponse.json({ error: "path must be absolute" }, { status: 400 });
  }
  if (!isWithinHome(target)) {
    return NextResponse.json({ error: "path outside home directory" }, { status: 403 });
  }

  try {
    const stat = await fs.stat(target).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      return NextResponse.json({ error: "not a directory" }, { status: 404 });
    }
    const raw = await fs.readdir(target, { withFileTypes: true });
    const entries = raw
      .filter((e) => showAll || !e.name.startsWith("."))
      .map((e) => {
        // Resolve symlinks just enough to know if the target is a directory.
        let isDir = e.isDirectory();
        if (e.isSymbolicLink()) {
          isDir = false; // treated as a file unless we can cheaply confirm; keeps listing fast
        }
        return { name: e.name, isDir };
      })
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });

    const home = os.homedir();
    const parent = path.dirname(target);
    return NextResponse.json({
      path: target,
      parent: parent !== target && isWithinHome(parent) ? parent : null,
      home,
      name: path.basename(target) || target,
      entries,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
