import { NextResponse } from "next/server";
import { listActiveSessions, countClaudeProcesses } from "@/lib/orchestrator/liveSessions";

export const dynamic = "force-dynamic";

// Live claude sessions running on this machine that the orchestrator did NOT
// launch (terminals, other Claude Code windows). Polled by the board.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const minutes = Math.max(1, Math.min(180, Number(url.searchParams.get("minutes")) || 30));
  const [sessions, processCount] = await Promise.all([
    listActiveSessions(minutes * 60 * 1000),
    countClaudeProcesses(),
  ]);
  return NextResponse.json({ sessions, processCount, scannedAt: Date.now() });
}
