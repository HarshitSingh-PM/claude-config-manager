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
import { motion } from "framer-motion";
import { Card } from "./primitives";
import { relTime } from "./SessionsPanel";
import { Reveal, Stagger, AnimatedNumber, Skeleton, fadeUp, SPRING } from "./motion";

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
    <div className="max-w-[1440px] mx-auto px-6 py-9 space-y-7">
      {/* Hero */}
      <Reveal>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="t-eyebrow text-[color:var(--accent)] mb-2.5 inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] shadow-[0_0_10px_var(--accent-glow)]" />
              Control Center
            </div>
            <h2 className="t-display text-gradient max-w-2xl">
              Everything about Claude Code, in one place.
            </h2>
            <p className="t-body text-[color:var(--fg-muted)] mt-3 max-w-xl">
              Config health, projects, sessions, and what&apos;s worth doing next — all on this
              machine. Jump into a section below.
            </p>
          </div>
        </div>
      </Reveal>

      {/* KPI stat tiles */}
      <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.07}>
        <KpiCard
          icon={<FolderGit2 size={15} />}
          label="Projects"
          loading={projects === null}
          count={proj.count}
          sub={projects === null ? "" : `${proj.usedWithClaude} used with Claude`}
          onClick={() => onNavigate("projects")}
        />
        <KpiCard
          icon={<MessagesSquare size={15} />}
          label="Claude sessions"
          loading={data === null}
          count={data?.sessions.count ?? 0}
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
          loading={data === null}
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
          tone={
            data === null
              ? "ok"
              : data.config.credentialsLocked && data.config.sandboxEnabled
                ? "good"
                : data.config.settingsExists
                  ? "warn"
                  : "bad"
          }
          onClick={() => onNavigate("config")}
        />
        <KpiCard
          icon={<Database size={15} />}
          label="Context vault"
          loading={projects === null}
          value={projects === null ? "…" : `${proj.logic}/${proj.count}`}
          sub={
            data === null
              ? ""
              : `logic.md · auto-maintain ${data.vault.logicAutoMaintain ? "on" : "off"}`
          }
          onClick={() => onNavigate("projects")}
        />
      </Stagger>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
        {/* Recommended actions */}
        <Card variant="elevated" className="p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              <Sparkles size={16} />
            </span>
            <h3 className="t-h2">Recommended next steps</h3>
          </div>
          {data === null ? (
            <div className="text-xs text-[color:var(--fg-muted)] py-6 text-center">Checking your setup…</div>
          ) : actions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING}
              className="flex items-center gap-2.5 py-6 justify-center text-[color:var(--success)]"
            >
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.1 }}
              >
                <CheckCircle2 size={18} />
              </motion.span>
              <span className="text-sm">Everything looks well configured. Nice.</span>
            </motion.div>
          ) : (
            <Stagger className="space-y-2.5" stagger={0.06}>
              {actions.map((act) => (
                <motion.button
                  key={act.id}
                  variants={fadeUp}
                  onClick={() => onNavigate(act.go)}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.99 }}
                  transition={SPRING}
                  className="w-full text-left flex items-start gap-3.5 px-4 py-3.5 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--bg-elev-2)]/40 hover:border-[color:var(--accent)]/45 hover:bg-[color:var(--bg-elev-2)] transition-colors group"
                >
                  <span
                    className={`shrink-0 mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg ${
                      act.tone === "warn"
                        ? "text-[color:var(--warning)] bg-[color:var(--warning)]/12"
                        : "text-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                    }`}
                  >
                    {act.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block t-small font-semibold text-[color:var(--fg)]">{act.title}</span>
                    <span className="block t-label text-[color:var(--fg-muted)] leading-relaxed mt-1">
                      {act.detail}
                    </span>
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-1 t-label font-medium text-[color:var(--fg-faint)] group-hover:text-[color:var(--accent)] transition mt-0.5">
                    {act.cta} <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </motion.button>
              ))}
            </Stagger>
          )}
        </Card>

        {/* At a glance + jump-to */}
        <div className="space-y-5">
          <Card variant="elevated" className="p-6">
            <h3 className="t-h2 mb-4">At a glance</h3>
            <Stagger className="space-y-3" stagger={0.04}>
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
            </Stagger>
          </Card>

          <Stagger className="grid grid-cols-2 gap-3" stagger={0.05}>
            <JumpCard icon={<SettingsIcon size={16} />} label="Config" hint="settings, MCP, hooks" onClick={() => onNavigate("config")} />
            <JumpCard icon={<FolderGit2 size={16} />} label="Projects" hint="files & sessions" onClick={() => onNavigate("projects")} />
            <JumpCard icon={<Wrench size={16} />} label="Build" hint="agents, commands" onClick={() => onNavigate("build")} />
            <JumpCard icon={<Library size={16} />} label="Library" hint="browse presets" onClick={() => onNavigate("library")} />
          </Stagger>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, onClick, tone = "ok", count, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  sub: string;
  onClick: () => void;
  tone?: "ok" | "warn" | "good" | "bad";
  /** When provided, the value counts up to this number. */
  count?: number;
  loading?: boolean;
}) {
  const chip =
    tone === "warn"
      ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
      : tone === "good"
        ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
        : tone === "bad"
          ? "bg-[color:var(--danger)]/15 text-[color:var(--danger)]"
          : "bg-[color:var(--accent-soft)] text-[color:var(--accent)]";
  const valueColor =
    tone === "warn"
      ? "text-[color:var(--warning)]"
      : tone === "good"
        ? "text-[color:var(--success)]"
        : tone === "bad"
          ? "text-[color:var(--danger)]"
          : "text-[color:var(--fg)]";
  return (
    <motion.button
      variants={fadeUp}
      onClick={onClick}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING}
      className="text-left rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--bg-elev)]/80 backdrop-blur-md p-5 surface-interactive surface-hi group"
    >
      <div className="flex items-center justify-between">
        <motion.span
          whileHover={{ rotate: -8, scale: 1.08 }}
          transition={SPRING}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] ${chip}`}
        >
          {icon}
        </motion.span>
        <ArrowRight
          size={15}
          className="text-[color:var(--fg-faint)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[color:var(--accent)] transition-all"
        />
      </div>
      {loading ? (
        <Skeleton className="h-9 w-20 mt-4" />
      ) : (
        <div
          className={`text-[2rem] leading-none font-semibold mt-4 tracking-tight ${
            count != null ? "text-brand-gradient" : valueColor
          }`}
        >
          {count != null ? <AnimatedNumber value={count} /> : value}
        </div>
      )}
      <div className="t-small font-medium text-[color:var(--fg)] mt-2.5">{label}</div>
      {loading ? (
        <Skeleton className="h-3 w-24 mt-1.5" />
      ) : (
        sub && <div className="t-label text-[color:var(--fg-faint)] mt-1">{sub}</div>
      )}
    </motion.button>
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
    <motion.div variants={fadeUp} className="flex items-center justify-between gap-3 t-small">
      <span className="inline-flex items-center gap-2 text-[color:var(--fg-muted)]">
        <span className="text-[color:var(--fg-faint)]">{icon}</span>
        {label}
      </span>
      <span
        className={`font-mono t-label ${
          bad ? "text-[color:var(--warning)]" : "text-[color:var(--fg)]"
        }`}
      >
        {value}
      </span>
    </motion.div>
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
    <motion.button
      variants={fadeUp}
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING}
      className="text-left rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--bg-elev)]/70 p-4 surface-interactive surface-hi group"
    >
      <motion.span
        whileHover={{ scale: 1.12, rotate: -6 }}
        transition={SPRING}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
      >
        {icon}
      </motion.span>
      <div className="t-small font-semibold mt-2.5 inline-flex items-center gap-1">
        {label}
        <ArrowRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[color:var(--accent)] transition-all" />
      </div>
      <div className="t-label text-[color:var(--fg-faint)] mt-1">{hint}</div>
    </motion.button>
  );
}
