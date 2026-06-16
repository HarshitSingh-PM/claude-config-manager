"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  Globe,
  Lock,
  ShieldCheck,
  Settings as SettingsIcon,
  FileText,
  Keyboard,
  ServerCog,
  Layers,
  Check,
  Sparkles,
  AlertTriangle,
  Save,
  RotateCcw,
  CodeSquare,
  Zap,
  KeyRound,
  TerminalSquare,
  Wrench,
  Library,
  FolderGit2,
  LayoutDashboard,
} from "lucide-react";
import { tabs, type TabDef, type TabFile } from "@/lib/tabs";
import type { Scope, FileTarget } from "@/lib/paths";
import { safeParseJson, stringifyConfig } from "@/lib/utils";
import { Card, TextInput, Toggle } from "./primitives";
import { SettingsForm } from "./forms/SettingsForm";
import { ClaudeMdForm } from "./forms/ClaudeMdForm";
import { McpForm } from "./forms/McpForm";
import { KeybindingsForm } from "./forms/KeybindingsForm";
import { DirEditor } from "./forms/DirEditor";
import { SkillsDirEditor } from "./forms/SkillsDirEditor";
import { CredentialsForm } from "./forms/CredentialsForm";
import { StatusLineForm } from "./forms/StatusLineForm";
import { BuildShell } from "./BuildShell";
import { LibraryShell } from "./LibraryShell";
import { ProjectsShell } from "./ProjectsShell";
import { DashboardShell } from "./DashboardShell";
import { McpShell } from "./McpShell";
import { InfoIcon, Tooltip } from "./Tooltip";

type View = "home" | "config" | "projects" | "mcp" | "build" | "library";
const NAV: { v: View; label: string; Icon: typeof SettingsIcon }[] = [
  { v: "home", label: "Home", Icon: LayoutDashboard },
  { v: "config", label: "Config", Icon: SettingsIcon },
  { v: "projects", label: "Projects", Icon: FolderGit2 },
  { v: "mcp", label: "MCP", Icon: ServerCog },
  { v: "build", label: "Build", Icon: Wrench },
  { v: "library", label: "Library", Icon: Library },
];

type PathsInfo = {
  os: { platform: string; pretty: string };
  userClaudeDir: string;
  enterpriseManagedDir: string;
  defaultProjectDir: string;
  targets: Record<string, FileTarget>;
};

type FileState = {
  loaded: boolean;
  rawContent: string; // last loaded raw content (for diff comparison)
  draft: Record<string, unknown> | string; // object for JSON files, string for markdown files (just the body)
  dirty: boolean;
  saving: boolean;
  exists: boolean;
  hasBackedUp: boolean; // true once we've created at least one .bak for this file this session
  lastSavedAt: number | null;
};

const AUTOSAVE_DEBOUNCE_MS = 1200;
const AUTOSAVE_STORAGE_KEY = "ccm:autosave";

const tabIcons: Record<Scope, React.ReactNode> = {
  user: <Globe size={14} />,
  "project-shared": <FolderOpen size={14} />,
  "project-local": <Lock size={14} />,
  enterprise: <ShieldCheck size={14} />,
};

const fileTypeIcons: Record<TabFile["type"], React.ReactNode> = {
  settings: <SettingsIcon size={13} />,
  credentials: <KeyRound size={13} />,
  statusline: <TerminalSquare size={13} />,
  claudemd: <FileText size={13} />,
  mcp: <ServerCog size={13} />,
  keybindings: <Keyboard size={13} />,
  "agents-dir": <Layers size={13} />,
  "commands-dir": <Layers size={13} />,
  "output-styles-dir": <Layers size={13} />,
  "skills-dir": <Sparkles size={13} />,
};

export function AppShell() {
  const [paths, setPaths] = useState<PathsInfo | null>(null);
  const [projectDir, setProjectDir] = useState<string>("");
  const [view, setView] = useState<View>("home");
  const [activeTab, setActiveTab] = useState<Scope>("user");
  const [activeFileIds, setActiveFileIds] = useState<Record<Scope, string>>({
    user: "user.settings",
    "project-shared": "project.settings",
    "project-local": "projectLocal.settings",
    enterprise: "enterprise.managedSettings",
  });
  const activeFileId = activeFileIds[activeTab];
  const setActiveFileId = (id: string) =>
    setActiveFileIds((prev) => ({ ...prev, [activeTab]: id }));
  const [fileStates, setFileStates] = useState<Record<string, FileState>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  // Deep-link from Library: when set, the next DirEditor / SkillsDirEditor
  // render uses this as the initially-selected child.
  const [initialChild, setInitialChild] = useState<string | null>(null);
  const [autosave, setAutosaveState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(AUTOSAVE_STORAGE_KEY) === "1";
  });
  const [now, setNow] = useState<number>(() => Date.now()); // for "saved Xs ago"

  const setAutosave = (v: boolean) => {
    setAutosaveState(v);
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, v ? "1" : "0");
    }
  };

  // Tick clock once a second so "Saved 12s ago" stays accurate
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Initial paths fetch
  useEffect(() => {
    fetch("/api/paths")
      .then((r) => r.json())
      .then((data: PathsInfo) => {
        setPaths(data);
        setProjectDir(data.defaultProjectDir ?? "");
      });
  }, []);

  // Re-fetch when project dir changes
  useEffect(() => {
    if (!projectDir) return;
    fetch(`/api/paths?projectDir=${encodeURIComponent(projectDir)}`)
      .then((r) => r.json())
      .then((data: PathsInfo) => setPaths(data));
  }, [projectDir]);

  const currentTab = useMemo(
    () => tabs.find((t) => t.id === activeTab) as TabDef,
    [activeTab],
  );

  const currentFile = useMemo(
    () => currentTab.files.find((f) => f.id === activeFileId) ?? currentTab.files[0],
    [currentTab, activeFileId],
  );

  // The on-disk file & state key. Views that share state with another entry
  // (e.g. Credentials → settings.json) point to that entry's target.
  const targetId = currentFile.fileTargetId ?? currentFile.id;
  const target = paths?.targets[targetId];
  const needsProject = activeTab === "project-shared" || activeTab === "project-local";
  const projectMissing = needsProject && !projectDir;

  // Load a file's content (lazy)
  const loadFile = useCallback(
    async (id: string, t: FileTarget) => {
      if (!t.absolutePath) return;
      if (t.format === "directory") return; // handled inside DirEditor
      const res = await fetch(`/api/file?path=${encodeURIComponent(t.absolutePath)}`);
      const data = await res.json();
      const raw = (data.content as string | undefined) ?? "";
      const draft =
        t.format === "json" ? safeParseJson(raw) : (raw as string);
      setFileStates((prev) => ({
        ...prev,
        [id]: {
          loaded: true,
          rawContent: raw,
          draft,
          dirty: false,
          saving: false,
          exists: Boolean(data.exists),
          hasBackedUp: false,
          lastSavedAt: null,
        },
      }));
    },
    [],
  );

  // Load current file when activeFileId changes
  useEffect(() => {
    if (!target || !target.absolutePath) return;
    if (target.format === "directory") return;
    if (fileStates[targetId]?.loaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFile(targetId, target);
  }, [target, targetId, fileStates, loadFile]);

  const setDraft = (id: string, next: Record<string, unknown> | string) => {
    setFileStates((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, draft: next, dirty: true } };
    });
  };

  const stringifyDraft = (file: TabFile, state: FileState): string => {
    if (file.type === "claudemd") {
      return typeof state.draft === "string" ? state.draft : "";
    }
    const obj = (state.draft as Record<string, unknown>) ?? {};
    return stringifyConfig(obj);
  };

  // Save a specific file. options.silent suppresses the toast (autosave).
  // options.backup forces a backup even if we've already taken one this session.
  const saveFile = useCallback(
    async (
      fileId: string,
      options: { silent?: boolean; backup?: boolean } = {},
    ) => {
      const t = paths?.targets[fileId];
      const state = fileStates[fileId];
      const file = tabs.flatMap((tab) => tab.files).find((f) => f.id === fileId);
      if (!t || !t.absolutePath || !state || !state.dirty || !file) return;
      const content = stringifyDraft(file, state);
      // First save after load gets a backup. Subsequent saves (autosave) skip
      // backup to keep the directory clean. Manual Save button forces backup.
      const shouldBackup = options.backup ?? !state.hasBackedUp;
      setFileStates((prev) => ({
        ...prev,
        [fileId]: { ...prev[fileId], saving: true },
      }));
      try {
        const res = await fetch("/api/file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: t.absolutePath, content, backup: shouldBackup }),
        });
        const data = await res.json();
        if (!res.ok) {
          setToast({ kind: "err", msg: data.error ?? "Save failed" });
        } else {
          if (!options.silent) {
            setToast({
              kind: "ok",
              msg: data.backupPath
                ? `Saved → ${t.absolutePath} (backup: ${data.backupPath.split("/").pop()})`
                : `Saved → ${t.absolutePath}`,
            });
          }
          setFileStates((prev) => ({
            ...prev,
            [fileId]: {
              ...prev[fileId],
              rawContent: content,
              dirty: false,
              saving: false,
              exists: true,
              hasBackedUp: prev[fileId].hasBackedUp || shouldBackup,
              lastSavedAt: Date.now(),
            },
          }));
        }
      } catch (err) {
        setToast({ kind: "err", msg: String(err) });
      } finally {
        setFileStates((prev) => ({
          ...prev,
          [fileId]: { ...prev[fileId], saving: false },
        }));
      }
    },
    [paths, fileStates],
  );

  // Manual save (current file, force backup)
  const save = () => saveFile(targetId, { backup: true });

  // ─── Autosave: debounce per dirty file ─────────────────────
  // Enterprise scope is excluded — those paths are policy and usually require
  // admin rights; you really want an explicit Save there.
  useEffect(() => {
    if (!autosave) return;
    if (activeTab === "enterprise") return;
    const state = fileStates[targetId];
    if (!state || !state.dirty || state.saving) return;
    if (!target?.absolutePath) return;
    if (target.format === "directory") return;
    const handle = setTimeout(() => {
      saveFile(targetId, { silent: true });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [autosave, activeTab, targetId, fileStates, target, saveFile]);

  const discard = () => {
    if (!target || !target.absolutePath) return;
    setFileStates((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    setReloadKey((k) => k + 1);
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const dirtyCount = Object.values(fileStates).filter((s) => s.dirty).length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Header ───────────────────────────────────────── */}
      <header className="border-b border-[color:var(--border)] backdrop-blur-md bg-[color:var(--bg)]/80 sticky top-0 z-20">
        <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ rotate: -6, scale: 0.9 }}
              animate={{ rotate: 0, scale: 1 }}
              className="h-8 w-8 rounded-lg bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-2)] flex items-center justify-center text-black font-bold text-sm"
            >
              C
            </motion.div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Claude Config Manager</h1>
              <p className="text-[11px] text-[color:var(--fg-faint)]">
                Local, open-source UI for Claude Code config files.
              </p>
            </div>

            {/* ─── Primary nav: Config / Build / Library ─────── */}
            <div className="ml-3 inline-flex items-center bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-lg p-0.5 relative">
              {NAV.map(({ v, label, Icon }) => {
                const active = view === v;
                return (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className="relative px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5 z-10"
                  >
                    {active && (
                      <motion.div
                        layoutId="primary-nav-pill"
                        className="absolute inset-0 bg-[color:var(--accent)] rounded-md"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span
                      className={`relative inline-flex items-center gap-1.5 ${
                        active ? "text-black" : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
                      }`}
                    >
                      <Icon size={12} />
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {view === "config" && paths && (
              <span className="text-[11px] text-[color:var(--fg-muted)] inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" />
                Detected: <span className="font-mono">{paths.os.pretty}</span>
              </span>
            )}
            {view === "config" && dirtyCount > 0 && (
              <span className="text-[11px] text-[color:var(--warning)] inline-flex items-center gap-1.5">
                <AlertTriangle size={11} />
                {dirtyCount} unsaved
              </span>
            )}
            {view === "config" && (
            <Tooltip
              content={
                <>
                  Autosaves the active file 1.2 seconds after you stop typing.
                  Enterprise tab is excluded.
                </>
              }
              significance={
                <>
                  A timestamped <span className="font-mono">.bak-*</span> is made
                  on the first save after loading a file. Subsequent autosaves
                  write without a new backup so your folder stays clean.
                </>
              }
            >
              <button
                onClick={() => setAutosave(!autosave)}
                className="flex items-center gap-2 px-2.5 py-1 rounded-md hover:bg-[color:var(--bg-elev-2)] transition"
              >
                <Zap
                  size={12}
                  className={
                    autosave
                      ? "text-[color:var(--accent)]"
                      : "text-[color:var(--fg-faint)]"
                  }
                />
                <span
                  className={`text-[11px] font-medium ${
                    autosave ? "text-[color:var(--accent)]" : "text-[color:var(--fg-muted)]"
                  }`}
                >
                  Autosave
                </span>
                <Toggle checked={autosave} onChange={setAutosave} />
              </button>
            </Tooltip>
            )}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] transition"
            >
              <CodeSquare size={13} /> Source
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {view === "home" ? (
          <DashboardShell onNavigate={(v) => setView(v)} />
        ) : view === "mcp" ? (
          <McpShell projectDir={projectDir} />
        ) : view === "build" ? (
          <BuildShell />
        ) : view === "projects" ? (
          <ProjectsShell />
        ) : view === "library" ? (
          <LibraryShell
            projectDir={projectDir}
            onOpenInConfig={(targetId, fileName) => {
              const tab = tabs.find((t) => t.files.some((f) => (f.fileTargetId ?? f.id) === targetId));
              const file = tab?.files.find((f) => (f.fileTargetId ?? f.id) === targetId);
              if (tab && file) {
                setView("config");
                setActiveTab(tab.id);
                setActiveFileIds((prev) => ({ ...prev, [tab.id]: file.id }));
                // For skill rows, fileName looks like "code-review/SKILL.md" —
                // strip the trailing "/SKILL.md" so SkillsDirEditor gets just
                // the subdir name. DirEditor expects a bare filename.
                const child = fileName.endsWith("/SKILL.md")
                  ? fileName.replace(/\/SKILL\.md$/, "")
                  : fileName;
                setInitialChild(child);
                setReloadKey((k) => k + 1);
              }
            }}
          />
        ) : (
        <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-5">
          {/* ─── Project picker ────────────────────────────── */}
          <Card className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-[color:var(--fg)]">Project directory</span>
              <InfoIcon
                content="The directory used for project-scoped tabs (Global Project, Local Claude). Auto-detected to your current working directory."
                significance="Switch to point at any local repo. Only project tabs need this; user/enterprise scopes ignore it."
              />
            </div>
            <div className="flex-1 min-w-[280px]">
              <TextInput
                value={projectDir}
                onChange={setProjectDir}
                placeholder="/absolute/path/to/your/project"
                monospaced
              />
            </div>
            <span className="text-[11px] text-[color:var(--fg-faint)]">
              ~/.claude → <span className="font-mono text-[color:var(--fg-muted)]">{paths?.userClaudeDir}</span>
            </span>
          </Card>

          {/* ─── Tabs ───────────────────────────────────────── */}
          <div className="flex items-center gap-1 border-b border-[color:var(--border)]">
            {tabs.map((t) => {
              const active = t.id === activeTab;
              return (
                <Tooltip
                  key={t.id}
                  content={t.description}
                  significance={t.hint}
                >
                  <button
                    onClick={() => setActiveTab(t.id)}
                    className={`relative px-4 py-2.5 text-sm transition flex items-center gap-2 ${
                      active
                        ? "text-[color:var(--fg)]"
                        : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
                    }`}
                  >
                    <span className={active ? "text-[color:var(--accent)]" : ""}>
                      {tabIcons[t.id]}
                    </span>
                    {t.label}
                    {active && (
                      <motion.div
                        layoutId="active-tab-underline"
                        className="absolute left-2 right-2 -bottom-px h-[2px] bg-[color:var(--accent)] rounded-full"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </div>

          {/* ─── Tab description ────────────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="text-xs text-[color:var(--fg-muted)] leading-relaxed"
            >
              {currentTab.description}{" "}
              <span className="text-[color:var(--fg-faint)]">{currentTab.hint}</span>
            </motion.div>
          </AnimatePresence>

          {/* ─── File list + Editor ─────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
            {/* Sidebar */}
            <Card className="p-2.5 h-fit">
              <div className="text-[10px] font-medium tracking-wide uppercase text-[color:var(--fg-faint)] px-2 py-1.5">
                Files
              </div>
              <div className="space-y-0.5">
                {currentTab.files.map((f) => {
                  const fTargetId = f.fileTargetId ?? f.id;
                  const state = fileStates[fTargetId];
                  const isActive = f.id === currentFile.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setActiveFileId(f.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-md transition flex items-center gap-2 ${
                        isActive
                          ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                          : "text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]"
                      }`}
                    >
                      <span className="shrink-0">{fileTypeIcons[f.type]}</span>
                      <span className="text-xs font-mono truncate flex-1">{f.label}</span>
                      <span className="shrink-0 flex items-center gap-1">
                        {state?.dirty && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--warning)]" />
                        )}
                        {state?.loaded && !state.dirty && state.exists && (
                          <Check size={11} className="text-[color:var(--success)]" />
                        )}
                        {state?.loaded && !state.exists && (
                          <Tooltip content="File does not exist yet. Will be created on save.">
                            <span className="text-[10px] text-[color:var(--fg-faint)] uppercase">new</span>
                          </Tooltip>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {target?.absolutePath && (
                <div className="mt-3 px-2 py-2 border-t border-[color:var(--border)]">
                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)] mb-1">
                    Will save to
                  </div>
                  <div className="text-[10.5px] font-mono break-all text-[color:var(--fg-muted)]">
                    {target.absolutePath}
                  </div>
                </div>
              )}
            </Card>

            {/* Editor */}
            <div className="space-y-4 min-w-0">
              {projectMissing ? (
                <Card className="p-10 text-center">
                  <FolderOpen size={28} className="mx-auto text-[color:var(--fg-faint)] mb-3" />
                  <h3 className="text-sm font-medium mb-1.5">Pick a project directory</h3>
                  <p className="text-xs text-[color:var(--fg-muted)] max-w-md mx-auto">
                    This tab edits project-scoped files. Set the project directory above and the
                    file paths will resolve.
                  </p>
                </Card>
              ) : !target?.absolutePath ? (
                <Card className="p-10 text-center text-xs text-[color:var(--fg-muted)]">
                  Loading…
                </Card>
              ) : target.format === "directory" && currentFile.type === "skills-dir" ? (
                <SkillsDirEditor
                  dirPath={target.absolutePath}
                  reloadKey={reloadKey}
                  initialActiveSkill={initialChild}
                  onSaved={() => {
                    setToast({ kind: "ok", msg: `Saved to ${target.absolutePath}` });
                    setInitialChild(null);
                  }}
                />
              ) : target.format === "directory" ? (
                <DirEditor
                  dirPath={target.absolutePath}
                  kind={currentFile.type as "agents-dir" | "commands-dir" | "output-styles-dir"}
                  reloadKey={reloadKey}
                  initialActiveFile={initialChild}
                  onSaved={() => {
                    setToast({ kind: "ok", msg: `Saved to ${target.absolutePath}` });
                    setInitialChild(null);
                  }}
                />
              ) : target.format === "shell" && currentFile.type === "statusline" ? (
                <StatusLineForm
                  scriptPath={target.absolutePath}
                  settingsPath={paths!.targets["user.settings"].absolutePath}
                  onSaved={(msg) => setToast({ kind: "ok", msg })}
                  onError={(msg) => setToast({ kind: "err", msg })}
                />
              ) : (
                <>
                  <FileHeader
                    target={target}
                    state={fileStates[targetId]}
                    onSave={save}
                    onDiscard={discard}
                    autosaveActive={autosave && activeTab !== "enterprise"}
                    now={now}
                  />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentFile.id + ":" + reloadKey}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                    >
                      <FormBody
                        file={currentFile}
                        state={fileStates[targetId]}
                        onChange={(next) => setDraft(targetId, next)}
                      />
                    </motion.div>
                  </AnimatePresence>
                </>
              )}
            </div>
          </div>

          <StartupHelper />
        </div>
        )}
      </main>

      {/* ─── Toast ──────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="fixed bottom-6 right-6 z-30 max-w-md"
          >
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${
                toast.kind === "ok"
                  ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]"
                  : "border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 text-[color:var(--danger)]"
              }`}
            >
              {toast.kind === "ok" ? <Check size={15} /> : <AlertTriangle size={15} />}
              <div className="text-xs leading-snug break-all">{toast.msg}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function relativeTime(ms: number): string {
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function FileHeader({
  target,
  state,
  onSave,
  onDiscard,
  autosaveActive,
  now,
}: {
  target: FileTarget;
  state: FileState | undefined;
  onSave: () => void;
  onDiscard: () => void;
  autosaveActive: boolean;
  now: number;
}) {
  const dirty = state?.dirty;
  const saving = state?.saving;
  const lastSavedAt = state?.lastSavedAt;
  const savedAgo = lastSavedAt ? relativeTime(now - lastSavedAt) : null;

  let status: { text: string; tone: "muted" | "saving" | "success" | "warning" } | null = null;
  if (saving) {
    status = { text: "Saving…", tone: "saving" };
  } else if (dirty && autosaveActive) {
    status = { text: "Pending autosave…", tone: "warning" };
  } else if (dirty) {
    status = { text: "Unsaved changes", tone: "warning" };
  } else if (savedAgo) {
    status = { text: `Saved ${savedAgo}`, tone: "success" };
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-[color:var(--bg-elev)]/60 border border-[color:var(--border)] rounded-xl px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{target.label}</span>
          <span
            className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${
              target.gitTracked
                ? "text-[color:var(--success)] border-[color:var(--success)]/40"
                : "text-[color:var(--warning)] border-[color:var(--warning)]/40"
            }`}
          >
            {target.gitTracked ? "git-tracked" : "gitignored"}
          </span>
          {autosaveActive && (
            <Tooltip
              content="Autosave is on for this tab — changes save 1.2s after you stop typing."
              significance="The Save button still works for force-now (and triggers an extra .bak)."
            >
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-[color:var(--accent)]/40 text-[color:var(--accent)] inline-flex items-center gap-1">
                <Zap size={9} /> auto
              </span>
            </Tooltip>
          )}
          {status && (
            <motion.span
              key={status.text}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-[10.5px] inline-flex items-center gap-1.5 ${
                status.tone === "success"
                  ? "text-[color:var(--success)]"
                  : status.tone === "warning"
                    ? "text-[color:var(--warning)]"
                    : status.tone === "saving"
                      ? "text-[color:var(--accent)]"
                      : "text-[color:var(--fg-muted)]"
              }`}
            >
              {status.tone === "saving" && (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                  className="inline-block"
                >
                  <RotateCcw size={9} />
                </motion.span>
              )}
              {status.tone === "success" && <Check size={10} />}
              {(status.tone === "warning") && (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
              {status.text}
            </motion.span>
          )}
        </div>
        <div className="text-[11px] text-[color:var(--fg-muted)] mt-0.5 truncate">
          {target.description}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onDiscard}
          disabled={!dirty}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 h-7 rounded-md border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RotateCcw size={11} /> Discard
        </button>
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 text-xs px-3 h-7 rounded-md bg-[color:var(--accent)] text-black font-medium hover:bg-[color:var(--accent-2)] transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Save size={11} /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function FormBody({
  file,
  state,
  onChange,
}: {
  file: TabFile;
  state: FileState | undefined;
  onChange: (next: Record<string, unknown> | string) => void;
}) {
  if (!state?.loaded) {
    return (
      <Card className="p-10 text-center text-xs text-[color:var(--fg-muted)]">
        Loading file…
      </Card>
    );
  }
  switch (file.type) {
    case "settings":
      return (
        <SettingsForm
          values={state.draft as Record<string, unknown>}
          onChange={(v) => onChange(v)}
        />
      );
    case "credentials":
      return (
        <CredentialsForm
          values={state.draft as Record<string, unknown>}
          onChange={(v) => onChange(v)}
        />
      );
    case "claudemd":
      return (
        <ClaudeMdForm body={state.draft as string} onChange={(b) => onChange(b)} />
      );
    case "mcp":
      return (
        <McpForm values={state.draft as Record<string, unknown>} onChange={(v) => onChange(v)} />
      );
    case "keybindings":
      return (
        <KeybindingsForm
          values={state.draft as Record<string, unknown>}
          onChange={(v) => onChange(v)}
        />
      );
    default:
      return null;
  }
}

function StartupHelper() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={14} className="text-[color:var(--accent)]" />
        <h3 className="text-sm font-medium">Make Claude Code pick this up</h3>
      </div>
      <p className="text-xs text-[color:var(--fg-muted)] leading-relaxed mb-3">
        Files written by this tool land in Claude Code&apos;s standard locations — Claude Code
        will pick them up automatically on the next session start. No symlinks, no daemons.
      </p>
      <ul className="text-[11.5px] text-[color:var(--fg-muted)] space-y-1.5 leading-relaxed">
        <li>
          <span className="text-[color:var(--accent)] font-mono">~/.claude/*</span> applies to
          every project on this machine.
        </li>
        <li>
          <span className="text-[color:var(--accent)] font-mono">&lt;project&gt;/.claude/*</span>{" "}
          + <span className="font-mono">CLAUDE.md</span> are read whenever you{" "}
          <span className="font-mono">cd</span> into that project.
        </li>
        <li>
          <span className="text-[color:var(--accent)] font-mono">
            .claude/settings.local.json
          </span>{" "}
          should be in your .gitignore — this tool labels gitignored files so you can tell at a
          glance.
        </li>
        <li>
          Each save writes a timestamped <span className="font-mono">.bak-*</span> alongside the
          original — nothing is lost.
        </li>
      </ul>
    </Card>
  );
}
