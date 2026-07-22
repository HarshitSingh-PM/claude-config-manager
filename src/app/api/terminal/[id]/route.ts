import { NextResponse } from "next/server";
import {
  getSessionMeta,
  killSession,
  renameSession,
  resizeSession,
  subscribe,
  writeInput,
} from "@/lib/terminal/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/terminal/[id] — Server-Sent Events stream of terminal output.
// The scrollback buffer is replayed first, then live output is pushed. Each
// chunk is JSON-encoded so control chars / newlines survive the SSE framing.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getSessionMeta(id)) {
    return NextResponse.json({ error: "no such session" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          /* controller already closed */
        }
      };

      send("ready", JSON.stringify({ id }));

      unsubscribe = subscribe(
        id,
        (chunk) => send("output", JSON.stringify(chunk)),
        (code) => {
          send("exit", JSON.stringify({ code }));
          cleanup();
          try {
            controller.close();
          } catch {
            /* ignore */
          }
        },
      );

      if (!unsubscribe) {
        send("exit", JSON.stringify({ code: 0 }));
        try {
          controller.close();
        } catch {
          /* ignore */
        }
        return;
      }

      // SSE keep-alive comment so proxies / the browser don't drop an idle stream.
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    if (ping) {
      clearInterval(ping);
      ping = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// POST /api/terminal/[id] — { op: "input", data } | { op: "resize", cols, rows } | { op: "rename", title }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const op = body.op;
  if (op === "input" && typeof body.data === "string") {
    return NextResponse.json({ ok: writeInput(id, body.data) });
  }
  if (op === "resize" && typeof body.cols === "number" && typeof body.rows === "number") {
    return NextResponse.json({ ok: resizeSession(id, body.cols, body.rows) });
  }
  if (op === "rename" && typeof body.title === "string") {
    return NextResponse.json({ ok: renameSession(id, body.title) });
  }
  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}

// DELETE /api/terminal/[id] — kill the session.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ ok: killSession(id) });
}
