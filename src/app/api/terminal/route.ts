import { NextResponse } from "next/server";
import { createSession, listSessions, ptyAvailable } from "@/lib/terminal/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/terminal — list live sessions + PTY availability.
export async function GET() {
  const avail = ptyAvailable();
  return NextResponse.json({ available: avail.ok, error: avail.error, sessions: listSessions() });
}

// POST /api/terminal — create a session. Body: { cwd?, shell?, cols?, rows?, title?, launch? }
export async function POST(req: Request) {
  const avail = ptyAvailable();
  if (!avail.ok) {
    return NextResponse.json(
      { error: avail.error || "Terminal backend (node-pty) is unavailable in this build." },
      { status: 503 },
    );
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty body is fine — all fields optional */
  }
  try {
    const meta = createSession({
      cwd: typeof body.cwd === "string" ? body.cwd : undefined,
      shell: typeof body.shell === "string" ? body.shell : undefined,
      cols: typeof body.cols === "number" ? body.cols : undefined,
      rows: typeof body.rows === "number" ? body.rows : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      launch: body.launch === "claude" ? "claude" : "shell",
    });
    return NextResponse.json({ ok: true, session: meta });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
