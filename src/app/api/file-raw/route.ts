import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Serves a file's raw bytes for in-app viewing (PDFs, images) — the text-only
// /api/file route can't carry binary. Confined to the user's home tree and to
// an extension allow-list so this can't be turned into a general file exfil.
const MAX_BYTES = 60 * 1024 * 1024; // 60 MB guard

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

function isWithinHome(p: string): boolean {
  const home = os.homedir();
  return p === home || p.startsWith(home + path.sep);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get("path");
  if (!target || !path.isAbsolute(target)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  if (!isWithinHome(target)) {
    return NextResponse.json({ error: "path outside home directory" }, { status: 403 });
  }
  const ext = path.extname(target).toLowerCase();
  const mime = MIME[ext];
  if (!mime) {
    return NextResponse.json({ error: `unsupported type: ${ext || "(none)"}` }, { status: 415 });
  }
  try {
    const stat = await fs.stat(target).catch(() => null);
    if (!stat || !stat.isFile()) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (stat.size > MAX_BYTES) {
      return NextResponse.json({ error: "file too large to preview" }, { status: 413 });
    }
    const buf = await fs.readFile(target);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(path.basename(target))}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
