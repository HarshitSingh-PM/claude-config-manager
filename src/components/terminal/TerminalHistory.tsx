"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  History,
  TerminalSquare,
  Sparkles,
  FolderOpen,
  Trash2,
  Eye,
  RefreshCw,
  Loader2,
} from "lucide-react";
import "@xterm/xterm/css/xterm.css";

type Meta = {
  id: string;
  title: string;
  shell: string;
  cwd: string;
  launch: "shell" | "claude";
  createdAt: number;
  endedAt: number | null;
  exitCode: number | null;
  bytes: number;
  live: boolean;
};

function relTime(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Read-only xterm that renders a saved transcript (preserving ANSI colors).
function TranscriptViewer({ meta, onClose, onReopen }: {
  meta: Meta;
  onClose: () => void;
  onReopen: (cwd: string, launch: "shell" | "claude") => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let term: any = null;
    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      const res = await fetch(`/api/terminal/history?id=${encodeURIComponent(meta.id)}`);
      const data = await res.json().catch(() => ({ content: "" }));
      if (disposed || !host.current) return;
      term = new Terminal({
        theme: { background: "#070809", foreground: "#f2f3f5", cursor: "#070809" },
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12.5,
        lineHeight: 1.25,
        disableStdin: true,
        cursorBlink: false,
        scrollback: 100000,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host.current);
      try { fit.fit(); } catch { /* not measured */ }
      if (data.truncatedHead) {
        term.write("\x1b[38;5;244m[showing the tail of a large transcript]\x1b[0m\r\n\r\n");
      }
      term.write((data.content as string) ?? "");
      setLoading(false);
    })();
    return () => {
      disposed = true;
      try { term?.dispose(); } catch { /* ignore */ }
    };
  }, [meta.id]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col rounded-[var(--radius)] border border-[color:var(--border-strong)] bg-[color:var(--bg-elev)]">
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-2">
        {meta.launch === "claude" ? (
          <Sparkles size={14} className="text-[color:var(--accent)]" />
        ) : (
          <TerminalSquare size={14} className="text-[color:var(--accent)]" />
        )}
        <span className="truncate t-small font-medium">{meta.title}</span>
        <span className="t-label text-[color:var(--fg-faint)] font-mono truncate hidden sm:inline">
          {meta.cwd}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => onReopen(meta.cwd, meta.launch)}
            className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border-strong)] px-2 py-1 t-label font-medium text-[color:var(--fg-muted)] transition hover:text-[color:var(--fg)] hover:border-[color:var(--accent)]/50"
          >
            <FolderOpen size={12} /> Reopen folder
          </button>
          <button onClick={onClose} className="rounded-md p-1 text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center t-small text-[color:var(--fg-faint)]">
            <Loader2 size={14} className="mr-2 animate-spin" /> Loading transcript…
          </div>
        )}
        <div ref={host} className="h-full w-full bg-[color:var(--bg)] px-2 py-1.5" style={{ contain: "strict" }} />
      </div>
    </div>
  );
}

export function TerminalHistory({
  onClose,
  onReopen,
}: {
  onClose: () => void;
  onReopen: (cwd: string, launch: "shell" | "claude") => void;
}) {
  const [rows, setRows] = useState<Meta[] | null>(null);
  const [viewing, setViewing] = useState<Meta | null>(null);

  const load = useCallback(() => {
    fetch("/api/terminal/history")
      .then((r) => r.json())
      .then((d: { sessions: Meta[] }) => setRows(d.sessions ?? []))
      .catch(() => setRows([]));
  }, []);
  useEffect(() => load(), [load]);

  const del = async (id: string) => {
    await fetch(`/api/terminal/history?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    if (viewing?.id === id) setViewing(null);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-6"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.97, y: 8 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.97, y: 8 }}
          transition={{ type: "spring", stiffness: 460, damping: 34 }}
          className="relative flex h-[74vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-strong)] bg-[color:var(--bg-elev)] shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-center gap-2.5 border-b border-[color:var(--border)] px-5 py-3.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              <History size={16} />
            </span>
            <div>
              <h3 className="t-title">Session history</h3>
              <p className="t-label text-[color:var(--fg-faint)]">
                Transcripts are saved automatically and survive restarts.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={load} title="Refresh" className="rounded-md p-1.5 text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]">
                <RefreshCw size={14} />
              </button>
              <button onClick={onClose} className="rounded-md p-1.5 text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2.5">
            {rows === null ? (
              <div className="py-16 text-center t-small text-[color:var(--fg-faint)]">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center t-small text-[color:var(--fg-faint)]">
                No saved sessions yet. Open a terminal — its transcript will appear here.
              </div>
            ) : (
              <div className="space-y-1.5">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="group flex items-center gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--bg-elev-2)]/40 px-3 py-2.5 transition hover:border-[color:var(--border-strong)]"
                  >
                    <span className={`shrink-0 ${r.launch === "claude" ? "text-[color:var(--accent)]" : "text-[color:var(--fg-muted)]"}`}>
                      {r.launch === "claude" ? <Sparkles size={15} /> : <TerminalSquare size={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="t-small font-medium truncate">{r.title}</span>
                        {r.live ? (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 t-label font-semibold text-[color:var(--success)] bg-[color:var(--success)]/12">
                            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" /> live
                          </span>
                        ) : (
                          <span className="t-label text-[color:var(--fg-faint)]">
                            exited{r.exitCode ? ` · ${r.exitCode}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="t-label text-[color:var(--fg-faint)] font-mono truncate">{r.cwd}</div>
                    </div>
                    <div className="shrink-0 text-right t-label text-[color:var(--fg-faint)] hidden sm:block">
                      <div>{relTime(r.createdAt)}</div>
                      <div>{fmtBytes(r.bytes)}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      <button onClick={() => setViewing(r)} title="View transcript" className="rounded-md p-1.5 text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-3)] hover:text-[color:var(--accent)]">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => onReopen(r.cwd, r.launch)} title="Reopen this folder in a new terminal" className="rounded-md p-1.5 text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-3)] hover:text-[color:var(--fg)]">
                        <FolderOpen size={14} />
                      </button>
                      <button onClick={() => del(r.id)} title="Delete transcript" className="rounded-md p-1.5 text-[color:var(--fg-muted)] hover:bg-[color:var(--danger)]/15 hover:text-[color:var(--danger)]">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {viewing && (
            <div className="absolute inset-0 z-10 p-2">
              <TranscriptViewer meta={viewing} onClose={() => setViewing(null)} onReopen={onReopen} />
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
