import { NextResponse } from "next/server";
import os from "node:os";
import { buildBundle, collectFiles, previewCategories, type IncludeFlags } from "@/lib/transfer/bundle";

export const dynamic = "force-dynamic";

interface ExportBody {
  preview?: boolean;
  passphrase?: string;
  include?: IncludeFlags;
  extraPaths?: string[];
}

export async function POST(req: Request) {
  let body: ExportBody;
  try {
    body = (await req.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const extraPaths = Array.isArray(body.extraPaths) ? body.extraPaths.map(String) : [];

  try {
    if (body.preview) {
      return NextResponse.json(previewCategories(extraPaths));
    }

    const passphrase = body.passphrase || "";
    if (passphrase.length < 8) {
      return NextResponse.json({ error: "passphrase must be at least 8 characters" }, { status: 400 });
    }
    const include = body.include || {};
    const collected = collectFiles(include, extraPaths);
    if (collected.files.length === 0) {
      return NextResponse.json({ error: "nothing selected — no files found for the chosen categories" }, { status: 400 });
    }
    const bundle = buildBundle(collected, passphrase);
    const date = new Date().toISOString().slice(0, 10);
    const host = os.hostname().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 24) || "mac";
    return new Response(new Uint8Array(bundle), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="claude-setup-${host}-${date}.ccsync"`,
        "X-File-Count": String(collected.files.length),
        "X-Skipped-Count": String(collected.skipped.length),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
