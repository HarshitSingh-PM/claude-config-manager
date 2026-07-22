"use client";
import { useEffect, useMemo, useState } from "react";
import {
  FolderGit2,
  Folder,
  FileText,
  Settings as SettingsIcon,
  ServerCog,
  ScrollText,
  Search,
  Save,
  RotateCcw,
  Plus,
  GitBranch,
  Sparkles,
  Check,
  Layers,
  Database,
  Pencil,
  BrainCircuit,
  MessagesSquare,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Textarea, Toggle } from "./primitives";
import { Stagger, fadeUp, SPRING } from "./motion";
import {
  SessionsView,
  resolveSession,
  type RawSession,
  type Session,
  type ProjectRef,
} from "./SessionsPanel";

type ProjectFile = {
  kind: string;
  label: string;
  format: "markdown" | "json";
  absolutePath: string;
  exists: boolean;
  size: number;
  mtime: number | null;
  inVault?: boolean;
};

type Project = {
  name: string;
  path: string;
  hasGit: boolean;
  lastActive: number | null;
  seenByClaude: boolean;
  counts: { agents: number; commands: number; skills: number };
  presentCount: number;
  files: ProjectFile[];
};

const fileIcon: Record<string, React.ReactNode> = {
  logic: <BrainCircuit size={13} />,
  credentials: <KeyRound size={13} />,
  claudemd: <FileText size={13} />,
  claudelocal: <FileText size={13} />,
  summary: <ScrollText size={13} />,
  agents: <FileText size={13} />,
  settings: <SettingsIcon size={13} />,
  settingsLocal: <SettingsIcon size={13} />,
  mcp: <ServerCog size={13} />,
};

function logicStub(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `# Project logic & decisions

Long-term memory for this project — the decisions, rules, and rationale behind
how things work, so they aren't re-litigated or forgotten across Claude sessions.

## ${today}
- (decision) … — because …
`;
}

function credentialsStub(): string {
  return `# Credentials — track & rotate (local only, NEVER commit)

> Inventory of the API keys, tokens, and passwords this project uses, so you can
> see what exists and when to rotate. Stored in your context vault, outside any git
> repo. Do not commit or sync this file. For high-value secrets, prefer an encrypted
> store. Masked values (prefix…last4) are enough to identify a key for rotation —
> you don't need the live secret here.

| Service | Key / secret name | Value (masked) | Where it lives | Shared/created | Rotate every | Last rotated | Status |
|---------|-------------------|----------------|----------------|----------------|--------------|--------------|--------|
| example | API_KEY | sk_live_…a1b2 | .env | 2026-01-01 | 90d | — | active |
`;
}

// Stub content seeded when the user creates a missing file.
const STUBS: Record<string, string> = {
  claudelocal:
    "# Project notes (local, gitignored)\n\nPersonal context for Claude on this project. Not committed.\n",
  summary:
    "# Project summary\n\nA short, high-signal overview of what this project is and its current state.\n",
  claudemd: "# Project instructions\n\nGuidance Claude should follow when working in this repo.\n",
  agents: "# Agent guidance\n\n",
  settings: "{\n  \n}\n",
  settingsLocal: "{\n  \n}\n",
  mcp: '{\n  "mcpServers": {}\n}\n',
};

function relativeTime(ms: number | null): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const s = Math.max(1, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function ProjectsShell() {
  const [mode, setMode] = useState<"projects" | "sessions">("projects");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [vaultRoot, setVaultRoot] = useState<string>("");
  const [rawSessions, setRawSessions] = useState<RawSession[] | null>(null);
  const [query, setQuery] = useState("");
  const [activePath, setActivePath] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sessReloadKey, setSessReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjects(null);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: { projects: Project[]; vaultRoot?: string }) => {
        if (cancelled) return;
        setProjects(data.projects ?? []);
        if (data.vaultRoot) setVaultRoot(data.vaultRoot);
        if (data.projects?.length && !activePath) {
          setActivePath(data.projects[0].path);
        }
      })
      .catch(() => !cancelled && setProjects([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRawSessions(null);
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: { sessions: RawSession[] }) => {
        if (!cancelled) setRawSessions(data.sessions ?? []);
      })
      .catch(() => !cancelled && setRawSessions([]));
    return () => {
      cancelled = true;
    };
  }, [sessReloadKey]);

  const filtered = useMemo(() => {
    if (!projects) return [];
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
    );
  }, [projects, query]);

  const active = useMemo(
    () => projects?.find((p) => p.path === activePath) ?? null,
    [projects, activePath],
  );

  const projectRefs: ProjectRef[] = useMemo(
    () => (projects ?? []).map((p) => ({ name: p.name, path: p.path })),
    [projects],
  );

  // Resolve each session's project against the real project list (client-side
  // so nested-vs-top-level paths are disambiguated). null while still loading.
  const sessions: Session[] | null = useMemo(
    () => (rawSessions ? rawSessions.map((s) => resolveSession(s, projectRefs)) : null),
    [rawSessions, projectRefs],
  );

  const sessionsForActive = useMemo(
    () => (sessions ?? []).filter((s) => s.project === activePath),
    [sessions, activePath],
  );

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <FolderGit2 size={15} className="text-[color:var(--accent)]" />
            Projects
          </h2>
          <p className="text-[11px] text-[color:var(--fg-faint)] mt-0.5">
            Every project on this machine with Claude-relevant files — edit each project&apos;s
            config, decision log, and Claude sessions in one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {mode === "projects" && projects && (
            <span className="text-[11px] text-[color:var(--fg-muted)]">
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </span>
          )}
          {mode === "sessions" && sessions && (
            <span className="text-[11px] text-[color:var(--fg-muted)]">
              {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </span>
          )}
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "projects", label: "By project", icon: <FolderGit2 size={12} /> },
              { value: "sessions", label: "All sessions", icon: <MessagesSquare size={12} /> },
            ]}
          />
        </div>
      </div>

      <ContextSettings
        vaultRoot={vaultRoot}
        onVaultChange={(v) => {
          setVaultRoot(v);
          setReloadKey((k) => k + 1);
        }}
      />

      <AnimatePresence mode="wait">
      <motion.div
        key={mode}
        initial={{ opacity: 0, x: mode === "sessions" ? 16 : -16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: mode === "sessions" ? -16 : 16 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
      {mode === "sessions" ? (
        <div className="mt-4">
          <SessionsView
            sessions={sessions ?? []}
            projects={projectRefs}
            loading={sessions === null}
            onMutate={() => setSessReloadKey((k) => k + 1)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5 mt-4">
          {/* ─── Project list ─────────────────────────────── */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--fg-faint)]"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter projects…"
                className="w-full bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md pl-8 pr-3 py-1.5 text-xs placeholder:text-[color:var(--fg-faint)] focus:border-[color:var(--accent)] transition"
              />
            </div>

            <Card className="p-2 h-fit max-h-[70vh] overflow-y-auto">
              {!projects ? (
                <div className="text-[11px] text-[color:var(--fg-faint)] py-6 text-center">
                  Scanning…
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-[11px] text-[color:var(--fg-faint)] py-6 text-center">
                  No projects found.
                </div>
              ) : (
                <Stagger className="space-y-0.5" stagger={0.025}>
                  {filtered.map((p) => {
                    const isActive = p.path === activePath;
                    return (
                      <motion.button
                        key={p.path}
                        variants={fadeUp}
                        onClick={() => setActivePath(p.path)}
                        whileTap={{ scale: 0.98 }}
                        whileHover={{ x: 2 }}
                        transition={SPRING}
                        className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${
                          isActive
                            ? "bg-[color:var(--accent-soft)]"
                            : "hover:bg-[color:var(--bg-elev-2)]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {p.hasGit ? (
                            <FolderGit2
                              size={13}
                              className={
                                isActive ? "text-[color:var(--accent)]" : "text-[color:var(--fg-muted)]"
                              }
                            />
                          ) : (
                            <Folder
                              size={13}
                              className={
                                isActive ? "text-[color:var(--accent)]" : "text-[color:var(--fg-muted)]"
                              }
                            />
                          )}
                          <span
                            className={`text-xs font-medium font-mono truncate flex-1 ${
                              isActive ? "text-[color:var(--accent)]" : "text-[color:var(--fg)]"
                            }`}
                          >
                            {p.name}
                          </span>
                          {p.seenByClaude && (
                            <Sparkles size={10} className="text-[color:var(--accent)] shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 pl-[19px]">
                          <span className="text-[10px] text-[color:var(--fg-faint)]">
                            {p.presentCount} file{p.presentCount === 1 ? "" : "s"}
                          </span>
                          <span className="text-[10px] text-[color:var(--fg-faint)]">·</span>
                          <span className="text-[10px] text-[color:var(--fg-faint)]">
                            {relativeTime(p.lastActive)}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </Stagger>
              )}
            </Card>
          </div>

          {/* ─── Project detail ───────────────────────────── */}
          <div className="min-w-0">
            {active ? (
              <ProjectDetail
                key={active.path}
                project={active}
                sessions={sessionsForActive}
                sessionsLoading={sessions === null}
                projectRefs={projectRefs}
                onChanged={() => setReloadKey((k) => k + 1)}
                onSessionMutate={() => setSessReloadKey((k) => k + 1)}
              />
            ) : (
              <Card className="p-10 text-center text-sm text-[color:var(--fg-muted)]">
                Select a project on the left.
              </Card>
            )}
          </div>
        </div>
      )}
      </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[color:var(--bg-elev-2)] border border-[color:var(--border)]">
      {options.map((o) => {
        const isActive = value === o.value;
        return (
          <motion.button
            key={o.value}
            onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.95 }}
            className={`relative inline-flex items-center gap-1.5 text-[11px] px-2.5 h-6 rounded-md transition-colors z-10 ${
              isActive ? "text-black font-medium" : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="segmented-pill"
                className="absolute inset-0 rounded-md bg-[color:var(--accent)] -z-10"
                transition={SPRING}
              />
            )}
            {o.icon}
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Vault location + logic.md auto-maintenance settings ───────────
function ContextSettings({
  vaultRoot,
  onVaultChange,
}: {
  vaultRoot: string;
  onVaultChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(vaultRoot);
  const [saving, setSaving] = useState(false);
  const [logicEnabled, setLogicEnabled] = useState<boolean | null>(null);
  const [logicPath, setLogicPath] = useState<string>("");
  const [togglingLogic, setTogglingLogic] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDraft(vaultRoot), [vaultRoot]);

  useEffect(() => {
    fetch("/api/logic-instruction")
      .then((r) => r.json())
      .then((d: { enabled: boolean; path: string }) => {
        setLogicEnabled(Boolean(d.enabled));
        setLogicPath(d.path ?? "");
      })
      .catch(() => setLogicEnabled(false));
  }, []);

  const saveVault = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/app-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextVaultRoot: draft }),
      });
      const data = (await res.json()) as { contextVaultRoot?: string };
      const next = data.contextVaultRoot ?? draft;
      // Keep the injected logic instruction's path in sync with the new vault.
      if (logicEnabled) {
        await fetch("/api/logic-instruction", { method: "POST" });
      }
      setEditing(false);
      onVaultChange(next);
    } finally {
      setSaving(false);
    }
  };

  const toggleLogic = async (on: boolean) => {
    setTogglingLogic(true);
    try {
      await fetch("/api/logic-instruction", { method: on ? "POST" : "DELETE" });
      setLogicEnabled(on);
    } finally {
      setTogglingLogic(false);
    }
  };

  return (
    <Card className="px-4 py-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Vault location */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">
            <Database size={11} /> Context vault — where logic.md &amp; generated files are stored
          </div>
          {editing ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveVault();
                  if (e.key === "Escape") setEditing(false);
                }}
                placeholder="~/ClaudeContext"
                className="flex-1 bg-[color:var(--bg-elev-2)] border border-[color:var(--accent)] rounded-md px-2.5 py-1.5 text-xs font-mono"
                autoFocus
              />
              <button
                onClick={saveVault}
                disabled={saving}
                className="text-xs px-3 h-7 rounded-md bg-[color:var(--accent)] text-[color:var(--accent-ink)] font-medium hover:bg-[color:var(--accent-2)] transition disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs px-2 h-7 rounded-md text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1 group">
              <span className="text-xs font-mono text-[color:var(--fg)] truncate">
                {vaultRoot || "…"}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="text-[color:var(--fg-faint)] hover:text-[color:var(--accent)] transition shrink-0"
                aria-label="Change vault location"
              >
                <Pencil size={11} />
              </button>
            </div>
          )}
        </div>

        {/* logic.md auto-maintenance */}
        <div className="flex items-start gap-3 lg:border-l lg:border-[color:var(--border)] lg:pl-4 shrink-0">
          <div className="max-w-[300px]">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--fg)]">
              <BrainCircuit size={12} className="text-[color:var(--accent)]" />
              Auto-maintain logic.md &amp; credentials.md
            </div>
            <p className="text-[10px] text-[color:var(--fg-faint)] mt-0.5 leading-relaxed">
              Teaches Claude (via your global CLAUDE.md) to log your decisions to logic.md and any
              shared keys/passwords (masked) to credentials.md each session.
            </p>
            {logicEnabled && logicPath && (
              <p className="text-[9.5px] font-mono text-[color:var(--fg-faint)] mt-1 truncate">
                ↳ {logicPath}
              </p>
            )}
          </div>
          <div className="pt-0.5">
            <Toggle
              checked={Boolean(logicEnabled)}
              onChange={(v) => !togglingLogic && toggleLogic(v)}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProjectDetail({
  project,
  sessions,
  sessionsLoading,
  projectRefs,
  onChanged,
  onSessionMutate,
}: {
  project: Project;
  sessions: Session[];
  sessionsLoading: boolean;
  projectRefs: ProjectRef[];
  onChanged: () => void;
  onSessionMutate: () => void;
}) {
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveFile(null);
  }, [project.path]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">{project.name}</h3>
              {project.hasGit && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-[color:var(--success)]/40 text-[color:var(--success)] inline-flex items-center gap-1">
                  <GitBranch size={9} /> git
                </span>
              )}
              {project.seenByClaude && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-[color:var(--accent)]/40 text-[color:var(--accent)] inline-flex items-center gap-1">
                  <Sparkles size={9} /> used with Claude
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-[color:var(--fg-muted)] mt-1 break-all">
              {project.path}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">
              Last active
            </div>
            <div className="text-xs text-[color:var(--fg-muted)]">
              {relativeTime(project.lastActive)}
            </div>
          </div>
        </div>

        {(project.counts.agents > 0 ||
          project.counts.commands > 0 ||
          project.counts.skills > 0) && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[color:var(--border)]">
            <CountChip icon={<Layers size={11} />} n={project.counts.agents} label="agents" />
            <CountChip icon={<Layers size={11} />} n={project.counts.commands} label="commands" />
            <CountChip icon={<Sparkles size={11} />} n={project.counts.skills} label="skills" />
          </div>
        )}
      </Card>

      {/* File list */}
      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-4">
        <Card className="p-2 h-fit">
          <div className="text-[10px] font-medium tracking-wide uppercase text-[color:var(--fg-faint)] px-2 py-1.5">
            Local files
          </div>
          <div className="space-y-0.5">
            {project.files.map((f) => {
              const isActive = activeFile?.kind === f.kind;
              return (
                <button
                  key={f.kind}
                  onClick={() => setActiveFile(f)}
                  className={`w-full text-left px-2.5 py-2 rounded-md transition flex items-center gap-2 ${
                    isActive
                      ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                      : f.exists
                        ? "text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]"
                        : "text-[color:var(--fg-faint)] hover:bg-[color:var(--bg-elev-2)]"
                  }`}
                >
                  <span className="shrink-0">{fileIcon[f.kind] ?? <FileText size={13} />}</span>
                  <span className="text-xs font-mono truncate flex-1">{f.label}</span>
                  {f.inVault && (
                    <Database size={10} className="text-[color:var(--fg-faint)] shrink-0" />
                  )}
                  {f.exists ? (
                    <Check size={11} className="text-[color:var(--success)] shrink-0" />
                  ) : (
                    <span className="text-[9px] uppercase text-[color:var(--fg-faint)] shrink-0">
                      new
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <div className="min-w-0">
          {activeFile ? (
            <FileEditor key={activeFile.absolutePath} file={activeFile} onChanged={onChanged} />
          ) : (
            <Card className="p-10 text-center text-sm text-[color:var(--fg-muted)]">
              Select a file to view or edit it.
            </Card>
          )}
        </div>
      </div>

      {/* Claude sessions for this project */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessagesSquare size={14} className="text-[color:var(--accent)]" />
          <h4 className="text-xs font-semibold">Claude sessions</h4>
          <span className="text-[10px] text-[color:var(--fg-faint)]">
            auto-detected from what each session worked on
          </span>
        </div>
        <SessionsView
          sessions={sessions}
          projects={projectRefs}
          loading={sessionsLoading}
          onMutate={onSessionMutate}
          scopeProjectPath={project.path}
        />
      </Card>
    </div>
  );
}

function CountChip({ icon, n, label }: { icon: React.ReactNode; n: number; label: string }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--fg-muted)]">
      <span className="text-[color:var(--accent)]">{icon}</span>
      {n} {label}
    </span>
  );
}

function FileEditor({ file, onChanged }: { file: ProjectFile; onChanged: () => void }) {
  const [content, setContent] = useState<string>("");
  const [original, setOriginal] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = content !== original;

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/file?path=${encodeURIComponent(file.absolutePath)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const raw = typeof data.content === "string" ? data.content : "";
        setContent(raw);
        setOriginal(raw);
        setCreated(Boolean(data.exists));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file.absolutePath]);

  const seedStub = () => {
    if (file.kind === "logic") setContent(logicStub());
    else if (file.kind === "credentials") setContent(credentialsStub());
    else setContent(STUBS[file.kind] ?? "");
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file.absolutePath, content, backup: true }),
      });
      if (res.ok) {
        setOriginal(content);
        setSavedAt(Date.now());
        const wasNew = !created;
        setCreated(true);
        if (wasNew) onChanged();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-sm font-medium font-mono truncate flex items-center gap-1.5">
            {file.inVault && <Database size={12} className="text-[color:var(--accent)] shrink-0" />}
            {file.label}
          </div>
          <div className="text-[10.5px] font-mono text-[color:var(--fg-faint)] break-all mt-0.5">
            {file.absolutePath}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirty && (
            <span className="text-[10px] uppercase text-[color:var(--warning)]">unsaved</span>
          )}
          {!dirty && savedAt && (
            <span className="text-[10px] text-[color:var(--success)] inline-flex items-center gap-1">
              <Check size={10} /> saved
            </span>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 text-xs px-3 h-7 rounded-md bg-[color:var(--accent)] text-[color:var(--accent-ink)] font-medium hover:bg-[color:var(--accent-2)] transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Save size={11} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {file.kind === "logic" && (
        <div className="mb-3 text-[10.5px] text-[color:var(--fg-muted)] bg-[color:var(--accent-soft)] border border-[color:var(--accent)]/20 rounded-md px-3 py-2 leading-relaxed">
          This project&apos;s decision log, kept in your central context vault. Turn on
          <span className="font-medium"> Auto-maintain logic.md</span> above to have Claude read and
          update it automatically each session.
        </div>
      )}

      {file.kind === "credentials" && (
        <div className="mb-3 text-[10.5px] text-[color:var(--warning)] bg-[color:var(--warning)]/10 border border-[color:var(--warning)]/30 rounded-md px-3 py-2 leading-relaxed flex items-start gap-2">
          <ShieldAlert size={13} className="shrink-0 mt-0.5" />
          <span>
            Local credential tracker, kept in your context vault (outside any git repo) so you can
            track &amp; rotate keys. <span className="font-medium">Plaintext — never commit or sync
            this file.</span> Prefer masked values (prefix…last4); for high-value secrets use an
            encrypted store.
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-[color:var(--fg-muted)] py-8 text-center">Loading…</div>
      ) : !created && content === "" ? (
        <div className="border border-dashed border-[color:var(--border)] rounded-lg p-8 text-center">
          <p className="text-xs text-[color:var(--fg-muted)] mb-3">
            <span className="font-mono">{file.label}</span> doesn&apos;t exist yet
            {file.inVault ? " in your vault" : " in this project"}.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={seedStub}
              className="inline-flex items-center gap-1.5 text-xs px-3 h-7 rounded-md bg-[color:var(--accent)]/15 text-[color:var(--accent)] border border-[color:var(--accent)]/30 hover:bg-[color:var(--accent)]/25 transition"
            >
              <Plus size={11} /> Create from template
            </button>
            <button
              onClick={() => setContent(" ")}
              className="text-xs px-3 h-7 rounded-md border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
            >
              Start blank
            </button>
          </div>
        </div>
      ) : (
        <>
          <Textarea
            value={content}
            onChange={setContent}
            rows={20}
            monospaced
            placeholder={`Contents of ${file.label}…`}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-[color:var(--fg-faint)]">
              {file.format === "json" ? "JSON" : "Markdown"} · saves a timestamped .bak alongside
            </span>
            {dirty && (
              <button
                onClick={() => setContent(original)}
                className="inline-flex items-center gap-1 text-[11px] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
              >
                <RotateCcw size={10} /> Revert
              </button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
