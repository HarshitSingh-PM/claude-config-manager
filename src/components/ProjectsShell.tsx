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
} from "lucide-react";
import { Card, Textarea } from "./primitives";

type ProjectFile = {
  kind: string;
  label: string;
  format: "markdown" | "json";
  absolutePath: string;
  exists: boolean;
  size: number;
  mtime: number | null;
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
  claudemd: <FileText size={13} />,
  claudelocal: <FileText size={13} />,
  summary: <ScrollText size={13} />,
  agents: <FileText size={13} />,
  settings: <SettingsIcon size={13} />,
  settingsLocal: <SettingsIcon size={13} />,
  mcp: <ServerCog size={13} />,
};

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
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [query, setQuery] = useState("");
  const [activePath, setActivePath] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setProjects(null);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: { projects: Project[] }) => {
        if (cancelled) return;
        setProjects(data.projects ?? []);
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

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <FolderGit2 size={15} className="text-[color:var(--accent)]" />
            Projects
          </h2>
          <p className="text-[11px] text-[color:var(--fg-faint)] mt-0.5">
            Every project on this machine with Claude-relevant files — edit each project&apos;s
            local config, summary, and instructions in one place.
          </p>
        </div>
        {projects && (
          <span className="text-[11px] text-[color:var(--fg-muted)]">
            {projects.length} project{projects.length === 1 ? "" : "s"} detected
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5">
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
              <div className="space-y-0.5">
                {filtered.map((p) => {
                  const isActive = p.path === activePath;
                  return (
                    <button
                      key={p.path}
                      onClick={() => setActivePath(p.path)}
                      className={`w-full text-left px-2.5 py-2 rounded-md transition ${
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
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ─── Project detail ───────────────────────────── */}
        <div className="min-w-0">
          {active ? (
            <ProjectDetail key={active.path} project={active} onChanged={() => setReloadKey((k) => k + 1)} />
          ) : (
            <Card className="p-10 text-center text-sm text-[color:var(--fg-muted)]">
              Select a project on the left.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectDetail({ project, onChanged }: { project: Project; onChanged: () => void }) {
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);

  // Reset selection when switching projects (key on path already remounts, but be safe).
  useEffect(() => {
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
    setContent(STUBS[file.kind] ?? "");
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
        if (wasNew) onChanged(); // refresh list so the "new" badge clears
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-sm font-medium font-mono truncate">{file.label}</div>
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
            className="inline-flex items-center gap-1.5 text-xs px-3 h-7 rounded-md bg-[color:var(--accent)] text-black font-medium hover:bg-[color:var(--accent-2)] transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Save size={11} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-[color:var(--fg-muted)] py-8 text-center">Loading…</div>
      ) : !created && content === "" ? (
        <div className="border border-dashed border-[color:var(--border)] rounded-lg p-8 text-center">
          <p className="text-xs text-[color:var(--fg-muted)] mb-3">
            <span className="font-mono">{file.label}</span> doesn&apos;t exist yet in this project.
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
