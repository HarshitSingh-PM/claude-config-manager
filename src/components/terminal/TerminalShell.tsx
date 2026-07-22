"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  X,
  TerminalSquare,
  Sparkles,
  Square,
  Columns2,
  Columns3,
  Grid2x2,
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
  FolderTree,
} from "lucide-react";
import { TerminalPane } from "./TerminalPane";
import { FileTree } from "./FileTree";
import { FileViewer } from "./FileViewer";
import { ControlBar } from "./ControlBar";
import { TerminalHistory } from "./TerminalHistory";
import { Check, FileDown, History } from "lucide-react";
import { isDesktop, resolveDroppedPath, shellQuote } from "@/lib/desktop";

type SessionMeta = {
  id: string;
  title: string;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
  createdAt: number;
  exited: boolean;
  exitCode: number | null;
};

type Layout = 1 | 2 | 3 | 4;
const LS_KEY = "ccm:terminal:layout-v1";

const LAYOUTS: { n: Layout; Icon: typeof Square; label: string }[] = [
  { n: 1, Icon: Square, label: "Single" },
  { n: 2, Icon: Columns2, label: "2 panes" },
  { n: 3, Icon: Columns3, label: "3 panes" },
  { n: 4, Icon: Grid2x2, label: "2 × 2" },
];

const gridClass: Record<Layout, string> = {
  1: "grid-cols-1 grid-rows-1",
  2: "grid-cols-2 grid-rows-1",
  3: "grid-cols-3 grid-rows-1",
  4: "grid-cols-2 grid-rows-2",
};

export default function TerminalShell({ projectDir }: { projectDir: string }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [ptyError, setPtyError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [layout, setLayout] = useState<Layout>(1);
  // panes[i] = session id shown in pane i (or null = empty slot).
  const [panes, setPanes] = useState<(string | null)[]>([null]);
  const [focused, setFocused] = useState(0);
  const [homeDir, setHomeDir] = useState<string>("");
  const [newCwd, setNewCwd] = useState<string>(projectDir || "");
  const [showTree, setShowTree] = useState(true);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const didInit = useRef(false);

  const workspaceDir = newCwd || projectDir || homeDir;

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Write raw bytes to the focused pane's session (used by the control bar).
  const focusedSessionId = panes[focused] ?? null;
  const sendToFocused = useCallback(
    (data: string) => {
      if (!focusedSessionId) return;
      fetch(`/api/terminal/${focusedSessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "input", data }),
      }).catch(() => {});
    },
    [focusedSessionId],
  );

  // ─── Drag & drop: dropped files/folders resolve to absolute paths. ───
  // Paths are pasted into the focused terminal (shell-quoted), and a dropped
  // folder also becomes the workspace root so the file tree jumps to it.
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const onDrop = useCallback(
    (e: ReactDragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);

      const items = Array.from(e.dataTransfer.items || []).filter((i) => i.kind === "file");
      let resolved: { path: string; isDir: boolean }[] = [];
      if (items.length) {
        resolved = items
          .map((it) => {
            const f = it.getAsFile();
            const path = f ? resolveDroppedPath(f) : null;
            const entry = it.webkitGetAsEntry?.();
            return path ? { path, isDir: Boolean(entry?.isDirectory) } : null;
          })
          .filter((x): x is { path: string; isDir: boolean } => x !== null);
      } else {
        resolved = Array.from(e.dataTransfer.files || [])
          .map((f) => {
            const path = resolveDroppedPath(f);
            return path ? { path, isDir: false } : null;
          })
          .filter((x): x is { path: string; isDir: boolean } => x !== null);
      }

      if (!resolved.length) {
        setToast({
          kind: "err",
          msg: isDesktop()
            ? "Couldn't read the dropped file's path."
            : "Drag-and-drop paths need the desktop app (browser hides file paths).",
        });
        return;
      }

      const quoted = resolved.map((r) => shellQuote(r.path)).join(" ") + " ";
      const hasSession = Boolean(focusedSessionId);
      if (hasSession) sendToFocused(quoted);

      const firstDir = resolved.find((r) => r.isDir)?.path ?? null;
      if (firstDir) setNewCwd(firstDir);

      const n = resolved.length;
      setToast({
        kind: "ok",
        msg: `${n} path${n > 1 ? "s" : ""}${hasSession ? " pasted into terminal" : " ready"}${
          firstDir ? " · workspace set" : ""
        }`,
      });
    },
    [focusedSessionId, sendToFocused],
  );

  const refreshSessions = useCallback(async (): Promise<SessionMeta[]> => {
    const res = await fetch("/api/terminal");
    const data = await res.json();
    setAvailable(Boolean(data.available));
    setPtyError(data.error ?? null);
    setSessions(data.sessions ?? []);
    return (data.sessions ?? []) as SessionMeta[];
  }, []);

  const createSession = useCallback(
    async (launch: "shell" | "claude", cwd?: string, targetPane?: number) => {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launch, cwd: cwd || workspaceDir || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setPtyError(d.error ?? "Failed to create terminal");
        setAvailable(false);
        return;
      }
      const { session } = (await res.json()) as { session: SessionMeta };
      setSessions((prev) => [...prev, session]);
      setPanes((prev) => {
        const next = [...prev];
        const idx = targetPane ?? focused;
        next[idx] = session.id;
        return next;
      });
      if (targetPane !== undefined) setFocused(targetPane);
    },
    [workspaceDir, focused],
  );

  const closeSession = useCallback(async (id: string) => {
    await fetch(`/api/terminal/${id}`, { method: "DELETE" }).catch(() => {});
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setPanes((prev) => prev.map((p) => (p === id ? null : p)));
  }, []);

  // ─── Initial load: restore layout, adopt live sessions, or spawn one. ───
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      // Learn the home dir for the tree / default cwd.
      fetch("/api/fs-tree")
        .then((r) => r.json())
        .then((d) => {
          if (d?.home) {
            setHomeDir(d.home);
            setNewCwd((c) => c || projectDir || d.home);
          }
        })
        .catch(() => {});

      const live = await refreshSessions();

      let restored: { layout: Layout; panes: (string | null)[] } | null = null;
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) restored = JSON.parse(raw);
      } catch {
        /* ignore */
      }
      const liveIds = new Set(live.map((s) => s.id));
      if (restored && restored.panes.some((p) => p && liveIds.has(p))) {
        setLayout(restored.layout);
        setPanes(
          restored.panes
            .slice(0, restored.layout)
            .map((p) => (p && liveIds.has(p) ? p : null)),
        );
      } else if (live.length > 0) {
        setPanes([live[live.length - 1].id]);
      } else if (available !== false) {
        // Fresh start — spawn one shell in the workspace.
        createSession("shell");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist layout + pane assignment.
  useEffect(() => {
    if (!didInit.current) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ layout, panes }));
    } catch {
      /* ignore */
    }
  }, [layout, panes]);

  const changeLayout = (n: Layout) => {
    setLayout(n);
    setPanes((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(null);
      return next;
    });
    if (focused >= n) setFocused(0);
  };

  // Auto-fill empty panes with unassigned live sessions when the grid grows.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPanes((prev) => {
      const assigned = new Set(prev.filter(Boolean) as string[]);
      const spare = sessions.filter((s) => !assigned.has(s.id)).map((s) => s.id);
      let changed = false;
      const next = prev.map((p) => {
        if (p === null && spare.length) {
          changed = true;
          return spare.shift()!;
        }
        return p;
      });
      return changed ? next : prev;
    });
  }, [layout, sessions]);

  const assignToPane = (paneIdx: number, id: string) => {
    setPanes((prev) => {
      const next = [...prev];
      // If the session is already in another pane, swap so it isn't duplicated.
      const existing = next.indexOf(id);
      if (existing !== -1 && existing !== paneIdx) next[existing] = prev[paneIdx];
      next[paneIdx] = id;
      return next;
    });
    setFocused(paneIdx);
  };

  const openTerminalHere = (dir: string) => {
    setNewCwd(dir);
    createSession("shell", dir);
  };

  const sessionById = useMemo(() => {
    const m = new Map<string, SessionMeta>();
    for (const s of sessions) m.set(s.id, s);
    return m;
  }, [sessions]);

  // Poll sessions so each terminal's live working directory (parsed from OSC 7
  // on the server) stays current in the UI.
  useEffect(() => {
    const iv = setInterval(() => {
      refreshSessions();
    }, 3000);
    return () => clearInterval(iv);
  }, [refreshSessions]);

  // The file tree follows the focused terminal: whenever you click a pane — or
  // cd into a project inside it — the workspace opens that folder so its files
  // are right there. setNewCwd is a no-op when the value is unchanged.
  const focusedCwd = focusedSessionId ? sessionById.get(focusedSessionId)?.cwd ?? null : null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (focusedCwd) setNewCwd(focusedCwd);
  }, [focusedCwd]);

  // ─── PTY unavailable fallback ──────────────────────────────
  if (available === false) {
    return (
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="mx-auto max-w-lg rounded-xl border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/5 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 text-[color:var(--warning)]" size={26} />
          <h3 className="mb-1.5 text-sm font-medium">Terminal backend unavailable</h3>
          <p className="mx-auto max-w-md text-xs leading-relaxed text-[color:var(--fg-muted)]">
            The native <span className="font-mono">node-pty</span> module could not be loaded, so
            embedded terminals can&apos;t start.
          </p>
          {ptyError && (
            <pre className="mt-3 overflow-auto rounded bg-[color:var(--bg-elev-2)] p-2 text-left text-[10px] text-[color:var(--fg-faint)]">
              {ptyError}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative mx-auto flex h-[calc(100vh-64px)] max-w-[1600px] flex-col px-4 py-3"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragEnter={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) {
          dragDepth.current += 1;
          setDragging(true);
        }
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={onDrop}
    >
      {/* ─── Toolbar ─────────────────────────────────────────── */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowTree((v) => !v)}
          title={showTree ? "Hide file tree" : "Show file tree"}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-2.5 text-xs text-[color:var(--fg-muted)] transition hover:text-[color:var(--fg)]"
        >
          {showTree ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
        </button>

        <div className="inline-flex items-center gap-1.5">
          <button
            onClick={() => createSession("shell")}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--border-strong)] bg-[color:var(--bg-elev-2)] px-3 text-[13px] font-medium text-[color:var(--fg)] transition hover:border-[color:var(--accent)]/50 hover:bg-[color:var(--bg-elev-3)]"
          >
            <Plus size={14} /> Shell
          </button>
          <button
            onClick={() => createSession("claude")}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[linear-gradient(100deg,var(--accent),var(--accent-2))] px-3 text-[13px] font-semibold text-[color:var(--accent-ink)] transition hover:brightness-110 shadow-[0_4px_16px_var(--accent-glow)]"
          >
            <Sparkles size={14} /> Claude
          </button>
        </div>

        <button
          onClick={() => setShowHistory(true)}
          title="Session history — saved transcripts (survive restarts)"
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--border)] px-2.5 text-[13px] font-medium text-[color:var(--fg-muted)] transition hover:text-[color:var(--fg)] hover:border-[color:var(--border-strong)]"
        >
          <History size={14} /> History
        </button>

        {/* Layout switcher */}
        <div className="relative ml-auto inline-flex items-center gap-0.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elev-2)] p-0.5">
          {LAYOUTS.map(({ n, Icon, label }) => {
            const active = layout === n;
            return (
              <button
                key={n}
                onClick={() => changeLayout(n)}
                title={label}
                className="relative z-10 inline-flex h-7 w-8 items-center justify-center rounded-md"
              >
                {active && (
                  <motion.div
                    layoutId="term-layout-pill"
                    className="absolute inset-0 rounded-md bg-[color:var(--accent)]"
                    transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  />
                )}
                <Icon
                  size={14}
                  className={`relative ${active ? "text-black" : "text-[color:var(--fg-muted)]"}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Session rail ────────────────────────────────────── */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">
          <TerminalSquare size={11} /> Sessions
        </span>
        {sessions.length === 0 && (
          <span className="text-[11px] text-[color:var(--fg-faint)]">none yet</span>
        )}
        <AnimatePresence initial={false}>
          {sessions.map((s) => {
            const inPane = panes.indexOf(s.id);
            const isShown = inPane !== -1;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`group inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition ${
                  isShown
                    ? "border-[color:var(--accent)]/50 bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--border-strong)]"
                }`}
              >
                <button
                  onClick={() => assignToPane(focused, s.id)}
                  className="inline-flex items-center gap-1.5"
                  title={`${s.title} · ${s.cwd}`}
                >
                  {s.title === "Claude" ? <Sparkles size={11} /> : <TerminalSquare size={11} />}
                  <span className="max-w-[120px] truncate font-mono">{s.title}</span>
                  {s.exited && <span className="text-[9px] uppercase opacity-70">exited</span>}
                  {isShown && (
                    <span className="rounded bg-[color:var(--accent)]/20 px-1 text-[9px]">
                      {inPane + 1}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => closeSession(s.id)}
                  title="Close session"
                  className="rounded p-0.5 opacity-50 transition hover:bg-[color:var(--danger)]/15 hover:text-[color:var(--danger)] hover:opacity-100"
                >
                  <X size={11} />
                </button>
              </motion.div>
            );
          })}
      </AnimatePresence>
      </div>

      {/* ─── Body: file tree + terminal grid ─────────────────── */}
      <div className="flex min-h-0 flex-1 gap-3">
        {showTree && (
          <div className="hidden w-[230px] shrink-0 flex-col rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elev)]/50 p-2 md:flex">
            <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">
              <FolderTree size={11} /> Workspace
            </div>
            <div className="min-h-0 flex-1">
              <FileTree
                cwd={workspaceDir}
                activeFile={openFile}
                onOpenTerminal={openTerminalHere}
                onOpenFile={(p) => setOpenFile(p)}
              />
            </div>
          </div>
        )}

        {/* Terminal grid + file-viewer overlay (terminals stay mounted underneath). */}
        <div className="relative min-h-0 flex-1">
        <div className={`grid h-full min-h-0 gap-2 ${gridClass[layout]}`}>
          {panes.slice(0, layout).map((sid, i) => (
            <div key={i} className="min-h-0 min-w-0">
              {sid && sessionById.has(sid) ? (
                <TerminalPane
                  sessionId={sid}
                  focused={focused === i}
                  onFocus={() => setFocused(i)}
                  onExit={() => {
                    // Keep the pane; the "[process exited]" line stays visible.
                  }}
                />
              ) : (
                <button
                  onClick={() => {
                    setFocused(i);
                    createSession("shell", undefined, i);
                  }}
                  onMouseDown={() => setFocused(i)}
                  className={`flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-xs transition ${
                    focused === i
                      ? "border-[color:var(--accent)]/50 text-[color:var(--accent)]"
                      : "border-[color:var(--border)] text-[color:var(--fg-faint)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--fg-muted)]"
                  }`}
                >
                  <Plus size={18} />
                  New terminal
                  <span className="text-[10px] text-[color:var(--fg-faint)]">
                    or pick a session above
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>

          {/* File viewer / editor overlay */}
          {openFile && (
            <FileViewer
              key={openFile}
              path={openFile}
              onClose={() => setOpenFile(null)}
              onToast={(kind, msg) => setToast({ kind, msg })}
            />
          )}
        </div>
      </div>

      {/* ─── Claude control bar (acts on the focused pane) ───── */}
      <ControlBar
        onSend={sendToFocused}
        targetLabel={
          focusedSessionId
            ? sessionById.get(focusedSessionId)?.title ?? `pane ${focused + 1}`
            : null
        }
        disabled={!focusedSessionId}
      />

      {/* ─── Toast ───────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="fixed bottom-6 right-6 z-40 max-w-md"
          >
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${
                toast.kind === "ok"
                  ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]"
                  : "border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 text-[color:var(--danger)]"
              }`}
            >
              {toast.kind === "ok" ? <Check size={15} /> : <AlertTriangle size={15} />}
              <div className="break-all text-xs leading-snug">{toast.msg}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Session history ─────────────────────────────────── */}
      {showHistory && (
        <TerminalHistory
          onClose={() => setShowHistory(false)}
          onReopen={(cwd, launch) => {
            setNewCwd(cwd);
            createSession(launch, cwd);
            setShowHistory(false);
            setToast({ kind: "ok", msg: `Reopened ${cwd}` });
          }}
        />
      )}

      {/* ─── Drag & drop overlay ─────────────────────────────── */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute inset-2 z-50 flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed border-[color:var(--accent)] bg-[color:var(--bg)]/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="inline-flex h-14 w-14 items-center justify-center rounded-[var(--radius)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
            >
              <FileDown size={26} />
            </motion.div>
            <div className="text-center">
              <div className="t-title text-[color:var(--fg)]">Drop files or folders</div>
              <div className="t-small text-[color:var(--fg-muted)] mt-0.5">
                Their paths paste into the focused terminal — a folder also sets the workspace.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
