"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessagesSquare, FolderDown, Loader2, Check, RefreshCw } from "lucide-react";
import { Card, Button, Toggle } from "./primitives";
import { InfoIcon } from "./Tooltip";

type ProjectSummary = { name: string; cwd: string; sessions: number; archived: number };
type Result = {
  projects: ProjectSummary[];
  totalSessions: number;
  totalArchived: number;
  archiveRoot: string;
};

const AUTO_KEY = "ccm:conv-archive-auto";

export function ConversationArchive() {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<number | null>(null);
  const [auto, setAuto] = useState<boolean>(true);
  const didAuto = useRef(false);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/conversations");
      const data = (await res.json()) as Result;
      if (!("error" in data)) {
        setResult(data);
        setLastRun(Date.now());
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, []);

  // Load the auto preference, and archive once on mount if it's on.
  useEffect(() => {
    let on = true;
    try {
      on = localStorage.getItem(AUTO_KEY) !== "0";
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuto(on);
    if (on && !didAuto.current) {
      didAuto.current = true;
      run();
    }
  }, [run]);

  const setAutoPref = (v: boolean) => {
    setAuto(v);
    try {
      localStorage.setItem(AUTO_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <Card variant="elevated" className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
            <MessagesSquare size={17} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="t-title">Conversation archive</h3>
              <InfoIcon
                content="Saves a plain-Markdown copy of every Claude Code conversation, per project — verbatim 'You / Claude' turns, no summarization."
                significance="It only reads the session files Claude Code already wrote and writes separate .md files. It never feeds anything back to Claude, so it uses zero context-window tokens."
              />
            </div>
            <p className="t-small text-[color:var(--fg-muted)] mt-0.5 max-w-lg leading-relaxed">
              A local, readable copy of your chats — one <span className="font-mono">.md</span> per
              session, grouped by project. Never touches your context window.
            </p>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={run} disabled={busy} icon={busy ? <Loader2 size={13} className="animate-spin" /> : <FolderDown size={13} />}>
          {busy ? "Archiving…" : "Archive now"}
        </Button>
      </div>

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 t-small">
            <span className="text-[color:var(--fg-muted)]">
              <span className="font-mono text-[color:var(--fg)]">{result.totalSessions}</span> sessions
            </span>
            <span className="text-[color:var(--fg-muted)]">
              <span className="font-mono text-[color:var(--accent)]">{result.totalArchived}</span> written this run
            </span>
            <span className="text-[color:var(--fg-muted)]">
              <span className="font-mono text-[color:var(--fg)]">{result.projects.length}</span> projects
            </span>
            {lastRun && (
              <span className="inline-flex items-center gap-1 t-label text-[color:var(--success)]">
                <Check size={12} /> up to date
              </span>
            )}
          </div>

          {result.projects.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-[var(--radius-sm)] border border-[color:var(--border)] divide-y divide-[color:var(--border)]">
              {result.projects.map((p) => (
                <div key={p.cwd} className="flex items-center justify-between gap-3 px-3 py-1.5 t-small">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 font-mono t-label text-[color:var(--fg-faint)]">{p.cwd}</span>
                  </span>
                  <span className="shrink-0 font-mono t-label text-[color:var(--fg-muted)]">
                    {p.sessions} session{p.sessions === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="t-label text-[color:var(--fg-faint)] font-mono break-all">
            → {result.archiveRoot}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[color:var(--border)] pt-3.5">
        <div className="flex items-center gap-2">
          <RefreshCw size={13} className="text-[color:var(--fg-faint)]" />
          <span className="t-small text-[color:var(--fg-muted)]">Auto-archive when I open the app</span>
        </div>
        <Toggle checked={auto} onChange={setAutoPref} />
      </div>
    </Card>
  );
}
