import { NextResponse } from "next/server";
import { applyBundle, decryptBundle, inspectAgainstDisk } from "@/lib/transfer/bundle";

export const dynamic = "force-dynamic";

interface ImportBody {
  mode?: "inspect" | "apply";
  passphrase?: string;
  /** the .ccsync file, base64-encoded */
  dataBase64?: string;
  /** apply mode: which bundle paths to restore */
  selectPaths?: string[];
}

export async function POST(req: Request) {
  let body: ImportBody;
  try {
    body = (await req.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.dataBase64) {
    return NextResponse.json({ error: "dataBase64 required" }, { status: 400 });
  }
  if (!body.passphrase) {
    return NextResponse.json({ error: "passphrase required" }, { status: 400 });
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(body.dataBase64, "base64");
  } catch {
    return NextResponse.json({ error: "dataBase64 is not valid base64" }, { status: 400 });
  }

  try {
    const manifest = decryptBundle(buf, body.passphrase);
    if (body.mode === "apply") {
      const selectPaths = Array.isArray(body.selectPaths) ? body.selectPaths.map(String) : [];
      if (selectPaths.length === 0) {
        return NextResponse.json({ error: "selectPaths is empty — nothing to restore" }, { status: 400 });
      }
      const result = applyBundle(manifest, selectPaths);
      return NextResponse.json({ ok: result.errors.length === 0, ...result });
    }
    const { files } = inspectAgainstDisk(manifest);
    return NextResponse.json({
      ok: true,
      createdAt: manifest.createdAt,
      hostname: manifest.hostname,
      files,
    });
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    const status = /passphrase|bundle/.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
