import { NextResponse } from "next/server";
import { archiveAll } from "@/lib/conversations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET  /api/conversations           → archive everything (incremental) + summary
// POST /api/conversations {cwd?}    → archive one project (or all) on demand
export async function GET() {
  try {
    return NextResponse.json(await archiveAll());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let cwd: string | undefined;
  try {
    const body = (await req.json()) as { cwd?: string };
    cwd = typeof body.cwd === "string" ? body.cwd : undefined;
  } catch {
    /* no body = archive all */
  }
  try {
    return NextResponse.json(await archiveAll(cwd));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
