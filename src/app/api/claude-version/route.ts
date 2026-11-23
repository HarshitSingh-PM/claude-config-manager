import { NextResponse } from "next/server";
import { execFile } from "node:child_process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The Claude Code release this build's config coverage was written against.
const COVERED_VERSION = "2.1.330";

// Reports the locally installed `claude` CLI version (if any) so the header can
// tell the user whether their install is newer than the schemas in this app.
export async function GET() {
  const installed = await new Promise<string | null>((resolve) => {
    execFile("claude", ["--version"], { timeout: 4000 }, (err, stdout) => {
      if (err) return resolve(null);
      const m = /(\d+\.\d+\.\d+)/.exec(String(stdout));
      resolve(m ? m[1] : null);
    });
  });
  return NextResponse.json({ covered: COVERED_VERSION, installed });
}
