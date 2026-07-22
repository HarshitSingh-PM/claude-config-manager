import { NextResponse } from "next/server";
import { deleteTranscript, listTranscripts, readTranscript } from "@/lib/terminal/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/terminal/history          → list all saved transcripts (live + past)
// GET /api/terminal/history?id=<id>  → raw transcript text for one session
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const t = await readTranscript(id);
    if (!t) return NextResponse.json({ error: "transcript not found" }, { status: 404 });
    return NextResponse.json(t);
  }
  return NextResponse.json({ sessions: await listTranscripts() });
}

// DELETE /api/terminal/history?id=<id> → remove a saved transcript
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ ok: await deleteTranscript(id) });
}
