import { getOrchestrator } from "@/lib/orchestrator/runtime";

export const dynamic = "force-dynamic";

// Server-Sent Events: pushes the live snapshot (runs + history + metrics) to the
// board on every change, debounced inside the orchestrator. The browser also has
// a polling fallback against the GET route if this connection can't be held.
export async function GET() {
  const orch = getOrchestrator();
  const encoder = new TextEncoder();

  let cleanup: () => void = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(orch.snapshot())}\n\n`));
        } catch {
          closed = true;
        }
      };
      send(); // initial state immediately
      const unsubscribe = orch.subscribe(send);
      // heartbeat keeps intermediaries from closing an idle connection
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
        }
      }, 15000);
      cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
