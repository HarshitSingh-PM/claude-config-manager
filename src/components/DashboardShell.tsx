"use client";
import { useEffect, useMemo, useState } from "react";
import {
  FolderGit2,
  MessagesSquare,
  ShieldCheck,
  ShieldAlert,
  Database,
  BrainCircuit,
  KeyRound,
  Wrench,
  Library,
  Settings as SettingsIcon,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Trash2,
  Cpu,
  HardDrive,
  Lock,
} from "lucide-react";
import { Card } from "./primitives";
import { relTime } from "./SessionsPanel";

type View = "config" | "projects" | "build" | "library";

type Dashboard = {
  home: string;
  sessions: {
    count: number;
    totalBytes: number;
    smallCount: number;
    activeThisWeek: number;
    lastActive: number | null;
  };
  config: {
    settingsExists: boolean;
    model: string | null;
    permissionMode: string | null;
    bypassesPermissions: boolean;
    sandboxEnabled: boolean;
    credentialsLocked: boolean;
    autoMemory: boolean;
    denyCount: number;
    allowCount: number;
    hasGlobalClaudeMd: boolean;
  };
  vault: { root: string; logicAutoMaintain: boolean };
};

type ProjectLite = {
  name: string;
  seenByClaude: boolean;
  files: { kind: string; exists: boolean }[];
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

type Action = {
  id: string;
  tone: "warn" | "info";
  icon: React.ReactNode;
  title: string;
  detail: string;
  cta: string;
  go: View;
};

export function DashboardShell({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [projects, setProjects] = useState<ProjectLite[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d: Dashboard) => !cancelled && setData(d))
      .catch(() => {});
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d: { projects: ProjectLite[] }) => !cancelled && setProjects(d.projects ?? []))
      .catch(() => !cancelled && setProjects([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const proj = useMemo(() => {
    const list = projects ?? [];
    const has = (p: ProjectLite, kind: string) =>
      p.files.some((f) => f.kind === kind && f.exists);
    return {
      count: list.length,
      usedWithClaude: list.filter((p) => p.seenByClaude).length,
      logic: list.filter((p) => has(p, "logic")).length,
      creds: list.filter((p) => has(p, "credentials")).length,
    };
  }, [projects]);

  const actions = useMemo<Action[]>(() => {
    if (!data) return [];
    const a: Action[] = [];
    if (!data.config.settingsExists) {
      a.push({
        id: "no-settings", tone: "warn", icon: <SettingsIcon size={14} />,
        title: "Create your global settings.json",
        detail: "You have no ~/.claude/settings.json yet — set your model, permissions, and defaults.",
        cta: "Open Config", go: "config",
      });
    }
    if (data.config.bypassesPermissions) {
      a.push({
        id: "bypass", tone: "warn", icon: <ShieldAlert size={14} />,
        title: "Permission mode is bypassPermissions",
        detail: "All tool prompts are skipped. Safe only inside a sandbox — review this.",
        cta: "Review permissions", go: "config",
      });
    }
    if (!data.config.credentialsLocked) {
      a.push({
        id: "creds", tone: "warn", icon: <Lock size={14} />,
        title: "Lock down credential reads",
        detail: "No deny rules block Claude from reading .env / ~/.ssh / tokens. Apply the lockdown preset.",
        cta: "Open Config", go: "config",
      });
    }
    if (!data.config.sandboxEnabled) {
      a.push({
        id: "sandbox", tone: "info", icon: <ShieldCheck size={14} />,
        title: "Enable the sandbox",
        detail: "Without it, deny rules don't restrict arbitrary Bash. Sandbox isolates filesystem + network.",
        cta: "Open Config", go: "config",
      });
    }
    if (!data.vault.logicAutoMaintain) {
      a.push({
        id: "automaintain", tone: "info", icon: <BrainCircuit size={14} />,
        title: "Turn on auto-maintain logic.md & credentials.md",
        detail: "Let Claude record decisions and shared keys per project, automatically each session.",
        cta: "Open Projects", go: "projects",
      });
    }
    if (proj.count > 0 && proj.logic < proj.count) {
      a.push({
        id: "logic-cov", tone: "info", icon: <BrainCircuit size={14} />,
        title: `Add logic.md to ${proj.count - proj.logic} project${proj.count - proj.logic === 1 ? "" : "s"}`,
        detail: "A decision log per project keeps context across sessions and avoids re-deciding.",
        cta: "Open Projects", go: "projects",
      });
    }
    if (data.sessions.smallCount > 0) {
      a.push({
        id: "cleanup", tone: "info", icon: <Trash2 size={14} />,
        title: `Clean up ${data.sessions.smallCount} tiny session${data.sessions.smallCount === 1 ? "" : "s"}`,
        detail: "Short throwaway sessions clutter /resume and take disk. Prune them in the Sessions view.",
        cta: "Open Sessions", go: "projects",
      });
    }
    return a;
  }, [data, proj]);

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-7 space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Welcome to Claude Config Manager</h2>
        <p className="text-xs text-[color:var(--fg-muted)] mt-1">
          Your control center for Claude Code on this machine — config health, projects, sessions,
          and what&apos;s worth doing next. Jump into a section below.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<FolderGit2 size={15} />}
          label="Projects"
          value={projects === null ? "…" : String(proj.count)}
          sub={projects === null ? "" : `${proj.usedWithClaude} used with Claude`}
          onClick={() => onNavigate("projects")}
        />
        <KpiCard
          icon={<MessagesSquare size={15} />}
          label="Claude sessions"
          value={data === null ? "…" : String(data.sessions.count)}
          sub={
            data === null
              ? ""
              : `${fmtBytes(data.sessions.totalBytes)} · ${data.sessions.activeThisWeek} active this week`
          }
          onClick={() => onNavigate("projects")}
        />
        <KpiCard
          icon={data?.config.credentialsLocked && data?.config.sandboxEnabled ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
          label="Config health"
          value={
            data === null
              ? "…"
              : data.config.credentialsLocked && data.config.sandboxEnabled
                ? "Solid"
                : data.config.settingsExists
                  ? "Review"
                  : "Empty"
          }
          sub={data === null ? "" : `${data.config.model ?? "default model"} · ${data.config.permissionMode ?? "default"} mode`}
          tone={data && !(data.config.credentialsLocked && data.config.sandboxEnabled) ? "warn" : "ok"}
          onClick={() => onNavigate("config")}
        />
        <KpiCard
          icon={<Database size={15} />}
          label="Context vault"
          value={projects === null ? "…" : `${proj.logic}/${proj.count}`}
          sub={
            data === null
              ? ""
              : `logic.md · auto-maintain ${data.vault.logicAutoMaintain ? "on" : "off"}`
          }
          onClick={() => onNavigate("projects")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Recommended actions */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={15} className="text-[color:var(--accent)]" />
            <h3 className="text-sm font-semibold">Recommended next steps</h3>
          </div>
          {data === null ? (
            <div className="text-xs text-[color:var(--fg-muted)] py-6 text-center">Checking your setup…</div>
          ) : actions.length === 0 ? (
            <div className="flex items-center gap-2.5 py-6 justify-center text-[color:var(--success)]">
              <CheckCircle2 size={18} />
              <span className="text-sm">Everything looks well configured. Nice.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {actions.map((act) => (
                <button
                  key={act.id}
                  onClick={() => onNavigate(act.go)}
                  className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg border border-[color:var(--border)] hover:border-[color:var(--accent)]/40 hover:bg-[color:var(--bg-elev-2)] transition group"
                >
                  <span
                    className={`shrink-0 mt-0.5 ${
                      act.tone === "warn" ? "text-[color:var(--warning)]" : "text-[color:var(--accent)]"
                    }`}
                  >
                    {act.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-[color:var(--fg)]">{act.title}</span>
                    <span className="block text-[11px] text-[color:var(--fg-muted)] leading-relaxed mt-0.5">
                      {act.detail}
                    </span>
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] text-[color:var(--fg-faint)] group-hover:text-[color:var(--accent)] transition mt-0.5">
                    {act.cta} <ArrowRight size={11} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* At a glance + jump-to */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">At a glance</h3>
            <div className="space-y-2.5">
              <GlanceRow icon={<Cpu size={13} />} label="Model" value={data?.config.model ?? "default"} />
              <GlanceRow
                icon={<ShieldCheck size={13} />}
                label="Permission mode"
                value={data?.config.permissionMode ?? "default"}
              />
              <GlanceRow
                icon={<Lock size={13} />}
                label="Credentials locked"
                value={data ? (data.config.credentialsLocked ? "yes" : "no") : "…"}
                bad={data ? !data.config.credentialsLocked : false}
              />
              <GlanceRow
                icon={<HardDrive size={13} />}
                label="Sessions on disk"
                value={data ? fmtBytes(data.sessions.totalBytes) : "…"}
              />
              <GlanceRow
                icon={<KeyRound size={13} />}
                label="credentials.md coverage"
                value={projects === null ? "…" : `${proj.creds}/${proj.count}`}
              />
              <GlanceRow
                icon={<MessagesSquare size={13} />}
                label="Last session"
                value={data?.sessions.lastActive ? relTime(data.sessions.lastActive) : "—"}
              />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <JumpCard icon={<SettingsIcon size={16} />} label="Config" hint="settings, MCP, hooks" onClick={() => onNavigate("config")} />
            <JumpCard icon={<FolderGit2 size={16} />} label="Projects" hint="files & sessions" onClick={() => onNavigate("projects")} />
            <JumpCard icon={<Wrench size={16} />} label="Build" hint="agents, commands" onClick={() => onNavigate("build")} />
            <JumpCard icon={<Library size={16} />} label="Library" hint="browse presets" onClick={() => onNavigate("library")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, onClick, tone = "ok",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  onClick: () => void;
  tone?: "ok" | "warn";
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elev)]/60 backdrop-blur-sm p-4 hover:border-[color:var(--accent)]/40 hover:bg-[color:var(--bg-elev-2)] transition group"
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
            tone === "warn"
              ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
              : "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
          }`}
        >
          {icon}
        </span>
        <ArrowRight
          size={13}
          className="text-[color:var(--fg-faint)] opacity-0 group-hover:opacity-100 transition"
        />
      </div>
      <div className="text-2xl font-semibold mt-3 tracking-tight">{value}</div>
      <div className="text-[11px] text-[color:var(--fg)] mt-0.5">{label}</div>
      {sub && <div className="text-[10.5px] text-[color:var(--fg-faint)] mt-0.5">{sub}</div>}
    </button>
  );
}

function GlanceRow({
  icon, label, value, bad,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bad?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="inline-flex items-center gap-2 text-[color:var(--fg-muted)]">
        <span className="text-[color:var(--fg-faint)]">{icon}</span>
        {label}
      </span>
      <span
        className={`font-mono text-[11px] ${
          bad ? "text-[color:var(--warning)]" : "text-[color:var(--fg)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function JumpCard({
  icon, label, hint, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elev)]/60 p-3.5 hover:border-[color:var(--accent)]/40 hover:bg-[color:var(--bg-elev-2)] transition group"
    >
      <span className="text-[color:var(--accent)] inline-flex">{icon}</span>
      <div className="text-xs font-medium mt-2 inline-flex items-center gap-1">
        {label}
        <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 transition" />
      </div>
      <div className="text-[10.5px] text-[color:var(--fg-faint)] mt-0.5">{hint}</div>
    </button>
  );
}
