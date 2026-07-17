"use client";
import { useMemo, useState } from "react";
import {
  MessageSquareText,
  Trash2,
  Pencil,
  Check,
  X,
  GitBranch,
  ChevronRight,
  Clock,
  FolderGit2,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Select } from "./primitives";
import { EASE_OUT, SPRING } from "./motion";

// As returned by /api/sessions (project not yet resolved).
export type RawSession = {
  id: string;
  dir: string;
  filePath: string;
  customName: string | null;
  firstPrompt: string | null;
  title: string;
  messages: number;
  created: number | null;
  modified: number | null;
  sizeBytes: number;
  gitBranch: string | null;
  launchCwd: string | null;
  assignedProjectPath: string | null;
  mentions: { path: string; count: number }[];
};

// After client-side resolution against the real project list.
export type Session = RawSession & {
  detectedProjectName: string | null;
  detectedProjectPath: string | null;
  project: string | null;
};

export type ProjectRef = { name: string; path: string };

// Resolve which project a session worked on: score each project by how often
// the session mentioned a path at or below that project's root, and pick the
// strongest. A manual assignment always wins.
export function resolveSession(s: RawSession, projects: ProjectRef[]): Session {
  let best: ProjectRef | null = null;
  let bestScore = 0;
  for (const p of projects) {
    let score = 0;
    for (const mn of s.mentions ?? []) {
      if (mn.path === p.path || mn.path.startsWith(p.path + "/")) score += mn.count;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  const detectedProjectPath = best?.path ?? null;
  return {
    ...s,
    detectedProjectName: best?.name ?? null,
    detectedProjectPath,
    project: s.assignedProjectPath ?? detectedProjectPath,
  };
}

export function relTime(ms: number | null): string {
  if (!ms) return "—";
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function patchSession(body: { id: string; name?: string | null; projectPath?: string | null }) {
  await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function deleteSession(s: Session) {
  await fetch(
    `/api/sessions?path=${encodeURIComponent(s.filePath)}&id=${encodeURIComponent(s.id)}`,
    { method: "DELETE" },
  );
}

type SortKey = "modified" | "created" | "messages" | "name" | "size";

// Rows rendered before "Show more". Keeps the DOM small — rendering many
// hundreds of animated, backdrop-blurred cards at once makes every click in
// the view janky.
const PAGE_SIZE = 50;
// Only the first screenful gets an entrance animation; the rest mount plain.
const ANIMATED_ROWS = 24;

export function SessionsView({
  sessions,
  projects,
  loading,
  onMutate,
  scopeProjectPath,
}: {
  sessions: Session[];
  projects: ProjectRef[];
  loading: boolean;
  onMutate: () => void;
  scopeProjectPath?: string; // when set, hide the project column (already scoped)
}) {
  const [sort, setSort] = useState<SortKey>("modified");
  const [shown, setShown] = useState(PAGE_SIZE);

  const sorted = useMemo(() => {
    const arr = [...sessions];
    switch (sort) {
      case "created":
        return arr.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
      case "messages":
        return arr.sort((a, b) => b.messages - a.messages);
      case "size":
        return arr.sort((a, b) => b.sizeBytes - a.sizeBytes);
      case "name":
        return arr.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return arr.sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0));
    }
  }, [sessions, sort]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-[color:var(--fg-muted)]">
          {loading ? "Scanning sessions…" : `${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">Sort</span>
          <div className="w-40">
            <Select
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: "modified", label: "Last worked" },
                { value: "created", label: "First started" },
                { value: "messages", label: "Most messages" },
                { value: "size", label: "Largest" },
                { value: "name", label: "Name (A–Z)" },
              ]}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-xs text-[color:var(--fg-muted)]">Scanning…</Card>
      ) : sorted.length === 0 ? (
        <Card className="p-8 text-center text-xs text-[color:var(--fg-muted)]">
          {scopeProjectPath
            ? "No Claude sessions detected for this project yet."
            : "No Claude sessions found."}
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.slice(0, shown).map((s, i) => (
            <SessionRow
              key={s.filePath}
              session={s}
              projects={projects}
              hideProject={Boolean(scopeProjectPath)}
              onMutate={onMutate}
              animate={i < ANIMATED_ROWS}
            />
          ))}
          {sorted.length > shown && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={() => setShown((n) => n + 150)}
                className="text-[11px] px-3 h-7 rounded-md border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] hover:border-[color:var(--border-strong)] transition"
              >
                Show more
              </button>
              <button
                onClick={() => setShown(sorted.length)}
                className="text-[11px] text-[color:var(--fg-faint)] hover:text-[color:var(--fg-muted)] transition"
              >
                Show all {sorted.length}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session,
  projects,
  hideProject,
  onMutate,
  animate = true,
}: {
  session: Session;
  projects: ProjectRef[];
  hideProject?: boolean;
  onMutate: () => void;
  animate?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(session.customName ?? "");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const projectName =
    projects.find((p) => p.path === session.project)?.name ??
    session.detectedProjectName ??
    null;
  const isAssigned = Boolean(session.assignedProjectPath);

  const saveName = async () => {
    setBusy(true);
    await patchSession({ id: session.id, name: name.trim() || null });
    setBusy(false);
    setEditing(false);
    onMutate();
  };

  const assign = async (projectPath: string) => {
    setBusy(true);
    await patchSession({ id: session.id, projectPath: projectPath || null });
    setBusy(false);
    onMutate();
  };

  const doDelete = async () => {
    setBusy(true);
    await deleteSession(session);
    setBusy(false);
    onMutate();
  };

  // No `layout` prop here on purpose: layout tracking across hundreds of
  // sibling rows forces framer-motion to re-measure the whole list on every
  // render, which is what made the view feel laggy.
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={EASE_OUT}
    >
    <Card className="px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <motion.button
          onClick={() => setExpanded((e) => !e)}
          whileTap={{ scale: 0.8 }}
          className="mt-0.5 text-[color:var(--fg-faint)] hover:text-[color:var(--fg)] transition shrink-0"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={SPRING} className="inline-flex">
            <ChevronRight size={14} />
          </motion.span>
        </motion.button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditing(false);
                }}
                placeholder="Custom label…"
                className="flex-1 bg-[color:var(--bg-elev-2)] border border-[color:var(--accent)] rounded-md px-2 py-1 text-xs"
              />
              <button onClick={saveName} disabled={busy} aria-label="Save name" className="text-[color:var(--success)] hover:opacity-80">
                <Check size={14} />
              </button>
              <button onClick={() => setEditing(false)} aria-label="Cancel" className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <span className="text-xs font-medium truncate text-[color:var(--fg)]">
                {session.title}
              </span>
              {session.customName && (
                <span className="text-[9px] uppercase text-[color:var(--accent)] shrink-0">renamed</span>
              )}
              <button
                onClick={() => {
                  setName(session.customName ?? "");
                  setEditing(true);
                }}
                aria-label="Rename"
                className="opacity-0 group-hover:opacity-100 text-[color:var(--fg-faint)] hover:text-[color:var(--accent)] transition shrink-0"
              >
                <Pencil size={11} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2.5 mt-1 flex-wrap text-[10px] text-[color:var(--fg-faint)]">
            <span className="inline-flex items-center gap-1">
              <Clock size={9} /> {relTime(session.modified)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquareText size={9} /> {session.messages}
            </span>
            <span>{fmtBytes(session.sizeBytes)}</span>
            {session.gitBranch && session.gitBranch !== "HEAD" && (
              <span className="inline-flex items-center gap-1">
                <GitBranch size={9} /> {session.gitBranch}
              </span>
            )}
            {!hideProject && projectName && (
              <span
                className="inline-flex items-center gap-1 text-[color:var(--accent)]"
                title={isAssigned ? "Assigned to project" : "Auto-detected project"}
              >
                {isAssigned ? <FolderGit2 size={9} /> : <Sparkles size={9} />}
                {projectName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {confirmDel ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[color:var(--danger)]">Delete?</span>
              <button onClick={doDelete} disabled={busy} className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--danger)]/15 text-[color:var(--danger)] hover:bg-[color:var(--danger)]/25">
                Yes
              </button>
              <button onClick={() => setConfirmDel(false)} className="text-[10px] px-1.5 py-0.5 rounded text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]">
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              aria-label="Delete session"
              className="h-6 w-6 inline-flex items-center justify-center rounded-md text-[color:var(--fg-faint)] hover:text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10 transition"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
        <div className="mt-2.5 pt-2.5 border-t border-[color:var(--border)] space-y-2 pl-[26px]">
          {session.firstPrompt && (
            <div>
              <div className="text-[9px] uppercase tracking-wide text-[color:var(--fg-faint)] mb-0.5">
                First prompt
              </div>
              <div className="text-[11px] text-[color:var(--fg-muted)] leading-relaxed">
                {session.firstPrompt}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
            <Meta label="Started" value={relTime(session.created)} />
            <Meta label="Launched from" value={session.launchCwd ?? "—"} mono />
            <Meta label="Session id" value={session.id} mono />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-wide text-[color:var(--fg-faint)]">Project</span>
            <div className="w-56">
              <Select
                value={session.assignedProjectPath ?? ""}
                onChange={assign}
                options={[
                  {
                    value: "",
                    label: session.detectedProjectName
                      ? `Auto: ${session.detectedProjectName}`
                      : "Unassigned",
                  },
                  ...projects.map((p) => ({ value: p.path, label: p.name })),
                ]}
              />
            </div>
          </div>
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </Card>
    </motion.div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <span className="text-[color:var(--fg-faint)] uppercase tracking-wide shrink-0">{label}</span>
      <span className={`text-[color:var(--fg-muted)] truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
