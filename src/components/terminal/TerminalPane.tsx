"use client";
import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";

// Terminal color theme, matched to the app's design tokens (globals.css). xterm
// needs concrete hex values, so these mirror --bg / --fg / --accent etc.
const THEME = {
  background: "#0a0a0c",
  foreground: "#ededee",
  cursor: "#818cf8",
  cursorAccent: "#0a0a0c",
  selectionBackground: "rgba(129,140,248,0.30)",
  black: "#161619",
  red: "#f87171",
  green: "#34d399",
  yellow: "#fbbf24",
  blue: "#818cf8",
  magenta: "#a78bfa",
  cyan: "#22d3ee",
  white: "#a1a1aa",
  brightBlack: "#6d6d75",
  brightRed: "#fca5a5",
  brightGreen: "#6ee7b7",
  brightYellow: "#fcd34d",
  brightBlue: "#a5b4fc",
  brightMagenta: "#c4b5fd",
  brightCyan: "#67e8f9",
  brightWhite: "#ededee",
};

export function TerminalPane({
  sessionId,
  focused,
  onFocus,
  onExit,
}: {
  sessionId: string;
  focused: boolean;
  onFocus: () => void;
  onExit?: (code: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "exited">("connecting");
  // Mirror of `status` for use inside long-lived stream callbacks, which would
  // otherwise close over a stale value.
  const statusRef = useRef<"connecting" | "live" | "exited">("connecting");
  const setStat = (s: "connecting" | "live" | "exited") => {
    statusRef.current = s;
    setStatus(s);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const termRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fitRef = useRef<any>(null);

  // Sequential input sender so keystrokes reach the PTY strictly in order even
  // though each is an independent fetch.
  const inputChain = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let disposed = false;
    let es: EventSource | null = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !hostRef.current) return;

      const term = new Terminal({
        theme: THEME,
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: 12.5,
        lineHeight: 1.25,
        cursorBlink: true,
        scrollback: 5000,
        allowProposedApi: true,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(hostRef.current);
      termRef.current = term;
      fitRef.current = fit;
      try {
        fit.fit();
      } catch {
        /* container not measured yet */
      }

      const postResize = () => {
        const t = termRef.current;
        if (!t) return;
        fetch(`/api/terminal/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "resize", cols: t.cols, rows: t.rows }),
        }).catch(() => {});
      };

      // Send initial size, then keep the PTY in sync with the pane.
      postResize();
      ro = new ResizeObserver(() => {
        try {
          fitRef.current?.fit();
        } catch {
          /* ignore */
        }
        postResize();
      });
      ro.observe(hostRef.current);

      term.onData((data: string) => {
        inputChain.current = inputChain.current.then(() =>
          fetch(`/api/terminal/${sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op: "input", data }),
          }).catch(() => {}),
        );
      });

      // ─── Output stream (SSE) ───────────────────────────────
      es = new EventSource(`/api/terminal/${sessionId}`);
      es.addEventListener("ready", () => {
        // Clear before the scrollback replay so an auto-reconnect repaints
        // cleanly instead of duplicating history.
        term.reset();
        setStat("live");
      });
      es.addEventListener("output", (e: MessageEvent) => {
        try {
          term.write(JSON.parse(e.data));
        } catch {
          /* ignore malformed frame */
        }
      });
      es.addEventListener("exit", (e: MessageEvent) => {
        let code = 0;
        try {
          code = JSON.parse(e.data).code ?? 0;
        } catch {
          /* ignore */
        }
        setStat("exited");
        term.write(`\r\n\x1b[38;5;244m[process exited${code ? " · code " + code : ""}]\x1b[0m\r\n`);
        onExit?.(code);
        es?.close();
      });
      es.onerror = () => {
        // EventSource auto-reconnects; the "ready" handler resets on reconnect.
        if (statusRef.current !== "exited") setStat("connecting");
      };
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      es?.close();
      try {
        termRef.current?.dispose();
      } catch {
        /* ignore */
      }
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Refit + focus when this pane becomes the focused one or the layout changes.
  useEffect(() => {
    if (focused) {
      const id = setTimeout(() => {
        try {
          fitRef.current?.fit();
          termRef.current?.focus();
        } catch {
          /* ignore */
        }
      }, 60);
      return () => clearTimeout(id);
    }
  }, [focused]);

  return (
    <div
      onMouseDown={onFocus}
      className={`relative h-full w-full min-h-0 overflow-hidden rounded-lg border transition-colors ${
        focused
          ? "border-[color:var(--accent)]/60 shadow-[0_0_0_1px_var(--accent-soft)]"
          : "border-[color:var(--border)]"
      }`}
    >
      <div
        ref={hostRef}
        className="h-full w-full bg-[color:var(--bg)] px-2 py-1.5"
        style={{ contain: "strict" }}
      />
      {status !== "live" && (
        <div className="pointer-events-none absolute right-2 top-2 rounded bg-[color:var(--bg-elev-2)]/80 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[color:var(--fg-faint)]">
          {status === "connecting" ? "connecting…" : "exited"}
        </div>
      )}
    </div>
  );
}
