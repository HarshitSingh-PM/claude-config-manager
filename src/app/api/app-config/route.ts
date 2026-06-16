import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import { readAppConfig, writeAppConfig, defaultVaultRoot } from "@/lib/appConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = await readAppConfig();
  const home = os.homedir();
  return NextResponse.json({
    ...cfg,
    home,
    defaultVaultRoot: defaultVaultRoot(),
    // logic.md files are read by Claude Code only when they live under a path
    // Claude can reach; the editor's file API also sandboxes writes to $HOME.
    withinHome: cfg.contextVaultRoot === home || cfg.contextVaultRoot.startsWith(home + path.sep),
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { contextVaultRoot?: string };
  const patch: Partial<{ contextVaultRoot: string }> = {};
  if (typeof body.contextVaultRoot === "string" && body.contextVaultRoot.trim()) {
    // Expand a leading ~ for convenience.
    let v = body.contextVaultRoot.trim();
    if (v === "~" || v.startsWith("~/")) v = path.join(os.homedir(), v.slice(1));
    if (!path.isAbsolute(v)) {
      return NextResponse.json({ error: "vault root must be an absolute path" }, { status: 400 });
    }
    patch.contextVaultRoot = v;
  }
  const next = await writeAppConfig(patch);
  return NextResponse.json(next);
}
