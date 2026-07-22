"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Network,
  GitBranch,
  Sparkles,
  Wrench,
  ServerCog,
  ListChecks,
  Square,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Loader2,
  Activity,
  Coins,
  Gauge,
  Layers,
  AlertTriangle,
  Copy,
  Rocket,
  Users,
  Cpu,
  Terminal,
  Eye,
  Clock,
  RotateCw,
  Plus,
  ClipboardList,
  Save,
  Play,
  Pause,
  CheckCircle2,
} from "lucide-react";
import { Card, TextInput, Textarea, Select, Badge } from "./primitives";
import { Tooltip, InfoIcon } from "./Tooltip";
import { cn } from "@/lib/utils";
import type {
  Run,
  ActivityNode,
  LiveSnapshot,
  AggregateMetrics,
  AgentDef,
  SkillInfo,
  PermMode,
  NodeKind,
  LiveSession,
  LiveSessionsResponse,
  TeamTemplate,
  TeamRole,
  TeamMode,
  Campaign,
} from "@/lib/orchestrator/types";

const EMPTY_AGG: AggregateMetrics = {
  active: 0,
  queued: 0,
  completed: 0,
  failed: 0,
  totalRuns: 0,
  successRate: 0,
  totalCostUsd: 0,
  totalTokens: 0,
  byAgent: [],
  byModel: [],
  topTools: [],
  topSkills: [],
};
const EMPTY_SNAPSHOT: LiveSnapshot = { runs: [], history: [], metrics: EMPTY_AGG, campaigns: [] };

interface Meta {
  agents: AgentDef[];
  skills: SkillInfo[];
  teamTemplates: TeamTemplate[];
  claudeAvailable: boolean;
  claudeBin: string | null;
  defaults: { cwd: string; permissionMode: PermMode; model: string };
}

const MODELS = [
  { value: "sonnet", label: "Sonnet — fast, balanced (recommended)" },
  { value: "opus", label: "Opus — most capable" },
  { value: "haiku", label: "Haiku — cheapest, quick" },
  { value: "fable", label: "Fable" },
];

const PERM_MODES: { value: PermMode; label: string; tone: "success" | "warning" | "danger" | "accent" }[] = [
  { value: "acceptEdits", label: "Accept edits — runs tools & writes files (recommended)", tone: "accent" },
  { value: "plan", label: "Plan only — explores & proposes, no changes (safe)", tone: "success" },
  { value: "auto", label: "Auto — the model decides per tool call", tone: "warning" },
  { value: "bypassPermissions", label: "Full auto — skips ALL permission checks", tone: "danger" },
];

// ─── data hook: GET for catalogs, SSE (with polling fallback) for live state ──
function useOrchestrator(projectDir: string) {
  const [live, setLive] = useState<LiveSnapshot>(EMPTY_SNAPSHOT);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [connected, setConnected] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const r = await fetch(`/api/orchestrator?projectDir=${encodeURIComponent(projectDir)}`);
      const d = await r.json();
      setMeta({
        agents: d.agents ?? [],
        skills: d.skills ?? [],
        teamTemplates: d.teamTemplates ?? [],
        claudeAvailable: d.claudeAvailable,
        claudeBin: d.claudeBin,
        defaults: d.defaults,
      });
      setLive({ runs: d.runs ?? [], history: d.history ?? [], metrics: d.metrics ?? EMPTY_AGG, campaigns: d.campaigns ?? [] });
    } catch {
      /* ignore */
    }
  }, [projectDir]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const startPolling = () => {
      if (poll) return;
      poll = setInterval(async () => {
        try {
          const r = await fetch(`/api/orchestrator?projectDir=${encodeURIComponent(projectDir)}`);
          const d = await r.json();
          if (!stopped) setLive({ runs: d.runs ?? [], history: d.history ?? [], metrics: d.metrics ?? EMPTY_AGG, campaigns: d.campaigns ?? [] });
        } catch {
          /* ignore */
        }
      }, 1500);
    };
    try {
      es = new EventSource(`/api/orchestrator/stream`);
      es.onopen = () => setConnected(true);
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data) as LiveSnapshot;
          if (!stopped) setLive(d);
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        setConnected(false);
        es?.close();
        startPolling();
      };
    } catch {
      startPolling();
    }
    return () => {
      stopped = true;
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [projectDir]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json();
  }, []);

  return { live, meta, connected, post, reload: loadAll };
}

// ─── formatters ─────────────────────────────────────────────────────
function fmtCost(n: number): string {
  if (!n) return "$0";
  return `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;
}
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
function relTime(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const NODE_STYLE: Record<NodeKind, { Icon: typeof Wrench; cls: string; bg: string; border: string }> = {
  subagent: { Icon: GitBranch, cls: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/30" },
  skill: { Icon: Sparkles, cls: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  mcp: { Icon: ServerCog, cls: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  tool: { Icon: Wrench, cls: "text-sky-300", bg: "bg-sky-500/10", border: "border-sky-500/30" },
  todo: { Icon: ListChecks, cls: "text-[color:var(--fg-muted)]", bg: "bg-[color:var(--bg-elev-2)]", border: "border-[color:var(--border)]" },
  error: { Icon: AlertTriangle, cls: "text-[color:var(--danger)]", bg: "bg-[color:var(--danger)]/10", border: "border-[color:var(--danger)]/30" },
};

function NodeStatusIcon({ status }: { status: ActivityNode["status"] }) {
  if (status === "running") return <Loader2 size={11} className="animate-spin text-[color:var(--success)]" />;
  if (status === "error") return <X size={11} className="text-[color:var(--danger)]" />;
  return <Check size={11} className="text-[color:var(--success)]" />;
}

// ─── recursive activity tree ────────────────────────────────────────
function TreeNode({ node, now }: { node: ActivityNode; now: number }) {
  const st = NODE_STYLE[node.kind] ?? NODE_STYLE.tool;
  const Icon = st.Icon;
  const dur = (node.endedAt ?? now) - node.startedAt;
  const isSub = node.kind === "subagent";
  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-start gap-2 rounded-md px-2 py-1.5 border",
          isSub ? cn(st.bg, st.border) : "border-transparent hover:bg-[color:var(--bg-elev-2)]/50",
        )}
      >
        <span className={cn("mt-0.5 shrink-0", st.cls)}>
          <Icon size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("text-xs font-medium truncate", isSub ? st.cls : "text-[color:var(--fg)]")}>
              {node.label}
            </span>
            {isSub && (
              <span className="text-[9px] uppercase tracking-wide px-1 py-px rounded border border-violet-500/40 text-violet-300">
                subagent
              </span>
            )}
            <NodeStatusIcon status={node.status} />
          </div>
          {node.detail && (
            <div className="text-[11px] font-mono text-[color:var(--fg-faint)] truncate mt-0.5">{node.detail}</div>
          )}
        </div>
        <span className="text-[10px] text-[color:var(--fg-faint)] tabular-nums shrink-0 mt-0.5">
          {fmtDuration(dur)}
        </span>
      </div>
      {node.children.length > 0 && (
        <div className="ml-3 mt-0.5 border-l border-[color:var(--border)] pl-2 space-y-0.5">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Run["status"] }) {
  const map: Record<Run["status"], { label: string; cls: string }> = {
    queued: { label: "Queued", cls: "text-[color:var(--warning)] border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10" },
    running: { label: "Running", cls: "text-[color:var(--success)] border-[color:var(--success)]/40 bg-[color:var(--success)]/10" },
    completed: { label: "Done", cls: "text-[color:var(--success)] border-[color:var(--success)]/40" },
    failed: { label: "Failed", cls: "text-[color:var(--danger)] border-[color:var(--danger)]/40" },
    stopped: { label: "Stopped", cls: "text-[color:var(--fg-muted)] border-[color:var(--border)]" },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-md border", s.cls)}>
      {status === "running" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--success)] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" />
        </span>
      )}
      {s.label}
    </span>
  );
}

function MetricChip({ Icon, value, label }: { Icon: typeof Coins; value: string; label: string }) {
  return (
    <Tooltip content={label}>
      <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--fg-muted)] tabular-nums">
        <Icon size={11} className="text-[color:var(--fg-faint)]" />
        {value}
      </span>
    </Tooltip>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className="inline-flex items-center justify-center h-5 w-5 rounded text-[color:var(--fg-faint)] hover:text-[color:var(--fg)] hover:bg-[color:var(--bg-elev-2)] transition"
      aria-label="Copy"
    >
      {done ? <Check size={11} className="text-[color:var(--success)]" /> : <Copy size={11} />}
    </button>
  );
}

// ─── one agent card ─────────────────────────────────────────────────
function RunCard({
  run,
  now,
  onStop,
  onRemove,
  post,
}: {
  run: Run;
  now: number;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
  post: (body: Record<string, unknown>) => Promise<{ error?: string }>;
}) {
  const running = run.status === "running" || run.status === "queued";
  const [expanded, setExpanded] = useState(running);
  const elapsed = (run.endedAt ?? now) - (run.startedAt ?? run.createdAt);
  const m = run.metrics;
  const toolTotal = Object.values(m.toolCounts).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "overflow-hidden",
          run.status === "running" && "border-[color:var(--success)]/40",
          run.status === "failed" && "border-[color:var(--danger)]/40",
        )}
      >
        {/* header */}
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  run.agentName === "general"
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "bg-violet-500/10 text-violet-300",
                )}
              >
                {run.agentName === "general" ? <Bot size={16} /> : <Users size={16} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{run.agentLabel}</span>
                  <StatusPill status={run.status} />
                  <Badge>{run.model}</Badge>
                  <Badge tone={run.permissionMode === "bypassPermissions" ? "danger" : run.permissionMode === "plan" ? "success" : "default"}>
                    {run.permissionMode === "bypassPermissions" ? "full-auto" : run.permissionMode === "acceptEdits" ? "edits" : run.permissionMode}
                  </Badge>
                  {run.role && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md border border-violet-500/40 text-violet-300">
                      {run.role}
                    </span>
                  )}
                  {run.resumedFrom && (
                    <Tooltip content={`Resumed from session ${run.resumedFrom.slice(0, 8)}…`}>
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">
                        <RotateCw size={9} /> resumed
                      </span>
                    </Tooltip>
                  )}
                  {run.campaignId && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">
                      <ClipboardList size={9} /> campaign
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[color:var(--fg-muted)] mt-0.5 line-clamp-1">{run.task}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {running ? (
                <Tooltip content="Stop this agent">
                  <button
                    onClick={() => onStop(run.id)}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10 transition"
                    aria-label="Stop"
                  >
                    <Square size={13} />
                  </button>
                </Tooltip>
              ) : (
                <Tooltip content="Remove from board">
                  <button
                    onClick={() => onRemove(run.id)}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[color:var(--fg-muted)] hover:text-[color:var(--danger)] hover:bg-[color:var(--bg-elev-2)] transition"
                    aria-label="Remove"
                  >
                    <Trash2 size={13} />
                  </button>
                </Tooltip>
              )}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] hover:bg-[color:var(--bg-elev-2)] transition"
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
            </div>
          </div>

          {/* current activity */}
          {running && run.currentActivity && (
            <motion.div
              key={run.currentActivity}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2.5 flex items-center gap-2 text-xs text-[color:var(--success)]"
            >
              <Activity size={12} className="animate-pulse" />
              <span className="truncate font-mono text-[11px]">{run.currentActivity}</span>
            </motion.div>
          )}

          {/* metric chips */}
          <div className="mt-2.5 flex items-center gap-3.5 flex-wrap">
            <MetricChip Icon={Gauge} value={fmtDuration(elapsed)} label="Elapsed" />
            <MetricChip Icon={Coins} value={fmtCost(m.costUsd)} label="Cost (USD)" />
            <MetricChip Icon={Cpu} value={fmtTokens(m.inputTokens + m.outputTokens)} label="Tokens (in + out)" />
            <MetricChip Icon={Layers} value={`${m.numTurns || run.tree.length} turns`} label="Turns" />
            {m.subagentCount > 0 && <MetricChip Icon={GitBranch} value={`${m.subagentCount} sub`} label="Sub-agents spawned" />}
            {toolTotal > 0 && <MetricChip Icon={Wrench} value={`${toolTotal} tools`} label="Tool calls" />}
          </div>
        </div>

        {/* tree + details */}
        <div className="border-t border-[color:var(--border)] bg-[color:var(--bg)]/40">
          {run.tree.length === 0 ? (
            <div className="px-4 py-3 text-[11px] text-[color:var(--fg-faint)] flex items-center gap-2">
              {running ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Starting up…
                </>
              ) : (
                "No tool activity recorded."
              )}
            </div>
          ) : (
            <div className={cn("px-3 py-2 space-y-0.5 overflow-auto", expanded ? "max-h-[460px]" : "max-h-[176px]")}>
              {run.tree.map((n) => (
                <TreeNode key={n.id} node={n} now={now} />
              ))}
            </div>
          )}

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-3 border-t border-[color:var(--border)] space-y-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)] mb-1">Task</div>
                    <div className="text-[11.5px] text-[color:var(--fg-muted)] leading-relaxed whitespace-pre-wrap break-words">
                      {run.task}
                    </div>
                  </div>
                  {run.resultText && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)] mb-1">Result</div>
                      <div className="text-[11.5px] text-[color:var(--fg)] leading-relaxed whitespace-pre-wrap break-words max-h-56 overflow-auto rounded-md bg-[color:var(--bg-elev-2)]/60 p-2.5 border border-[color:var(--border)]">
                        {run.resultText}
                      </div>
                    </div>
                  )}
                  {run.error && (
                    <div className="text-[11.5px] text-[color:var(--danger)] leading-relaxed whitespace-pre-wrap break-words rounded-md bg-[color:var(--danger)]/10 p-2.5 border border-[color:var(--danger)]/30">
                      {run.error}
                    </div>
                  )}
                  {run.sessionId && (
                    <div className="flex items-center gap-2 text-[11px] text-[color:var(--fg-muted)]">
                      <span className="text-[color:var(--fg-faint)]">Resume in terminal:</span>
                      <code className="font-mono text-[10.5px] bg-[color:var(--bg-elev-2)] px-1.5 py-0.5 rounded">
                        claude --resume {run.sessionId.slice(0, 8)}…
                      </code>
                      <CopyButton text={`claude --resume ${run.sessionId}`} />
                    </div>
                  )}
                  {!running && run.sessionId && (
                    <div className="pt-1">
                      <div className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)] mb-1.5">
                        Continue from here
                      </div>
                      <ContinueControl
                        sessionId={run.sessionId}
                        cwd={run.cwd}
                        label={`Continued · ${run.agentLabel}`}
                        post={post}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── launch panel (single agent OR a team) ──────────────────────────
function LaunchPanel({
  meta,
  projectDir,
  post,
}: {
  meta: Meta;
  projectDir: string;
  post: (body: Record<string, unknown>) => Promise<{ error?: string }>;
}) {
  const [kind, setKind] = useState<"single" | "team">("single");
  // shared
  const [model, setModel] = useState(meta.defaults?.model || "sonnet");
  const [permissionMode, setPermissionMode] = useState<PermMode>(meta.defaults?.permissionMode || "acceptEdits");
  const [cwd, setCwd] = useState(meta.defaults?.cwd || projectDir || "");
  const [maxTurns, setMaxTurns] = useState("30");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // single
  const [agentName, setAgentName] = useState("general");
  const [task, setTask] = useState("");
  // team
  const [templateId, setTemplateId] = useState(meta.teamTemplates[0]?.id ?? "custom");
  const [teamName, setTeamName] = useState(meta.teamTemplates[0]?.name ?? "Team");
  const [teamMode, setTeamMode] = useState<TeamMode>(meta.teamTemplates[0]?.mode ?? "orchestrated");
  const [objective, setObjective] = useState("");
  const [roles, setRoles] = useState<TeamRole[]>(meta.teamTemplates[0]?.roles?.map((r) => ({ ...r })) ?? []);

  const agentOptions = useMemo(
    () => [
      { value: "general", label: "General agent (no specialization)" },
      ...meta.agents.map((a) => ({ value: a.name, label: `${a.name}${a.source === "project" ? " (project)" : ""}` })),
    ],
    [meta.agents],
  );
  const selectedAgent = meta.agents.find((a) => a.name === agentName);
  const permTone = PERM_MODES.find((p) => p.value === permissionMode)?.tone ?? "accent";
  const maxTurnsNum = () => Number(maxTurns) || undefined;

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (id === "custom") {
      setRoles([
        { role: "Role 1", agentName: "general", responsibility: "" },
        { role: "Role 2", agentName: "general", responsibility: "" },
      ]);
      return;
    }
    const t = meta.teamTemplates.find((x) => x.id === id);
    if (t) {
      setRoles(t.roles.map((r) => ({ ...r })));
      setTeamMode(t.mode);
      setTeamName(t.name);
    }
  };
  const updateRole = (i: number, patch: Partial<TeamRole>) =>
    setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const launchSingle = async () => {
    if (!task.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const res = await post({
      action: "launch",
      agentName,
      agentLabel: agentName === "general" ? "General agent" : selectedAgent?.name,
      model,
      task: task.trim(),
      cwd: cwd.trim() || undefined,
      permissionMode,
      maxTurns: maxTurnsNum(),
    });
    setBusy(false);
    if (res?.error) setErr(res.error);
    else setTask("");
  };

  const launchTeam = async () => {
    if (!objective.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const res = await post({
      action: "launchTeam",
      teamName: teamName.trim() || "Team",
      teamMode,
      objective: objective.trim(),
      roles: roles.filter((r) => r.responsibility.trim()),
      model,
      cwd: cwd.trim() || undefined,
      permissionMode,
      maxTurns: maxTurnsNum(),
    });
    setBusy(false);
    if (res?.error) setErr(res.error);
    else setObjective("");
  };

  return (
    <Card className="p-4 space-y-3.5 lg:sticky lg:top-[84px]">
      <div className="flex items-center gap-2">
        <Rocket size={15} className="text-[color:var(--accent)]" />
        <h3 className="text-sm font-medium">Launch</h3>
      </div>

      {/* single / team toggle */}
      <div className="grid grid-cols-2 gap-1 bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-lg p-0.5">
        {(["single", "team"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              "h-7 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1.5 transition",
              kind === k ? "bg-[color:var(--accent)] text-[color:var(--accent-ink)]" : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]",
            )}
          >
            {k === "single" ? <Bot size={12} /> : <Users size={12} />}
            {k === "single" ? "Single agent" : "Team"}
          </button>
        ))}
      </div>

      {kind === "single" ? (
        <>
          <div>
            <label className="text-[11px] font-medium text-[color:var(--fg-muted)] flex items-center gap-1 mb-1">
              Agent
              <InfoIcon
                content="The general agent runs your task directly. Picking one of your subagent definitions delegates the task to it via the Task tool."
                significance="Subagent definitions come from ~/.claude/agents and the project's .claude/agents."
              />
            </label>
            <Select value={agentName} onChange={setAgentName} options={agentOptions} />
            {selectedAgent?.description && (
              <p className="text-[10.5px] text-[color:var(--fg-faint)] mt-1 line-clamp-2 leading-relaxed">
                {selectedAgent.description}
              </p>
            )}
          </div>
          <div>
            <label className="text-[11px] font-medium text-[color:var(--fg-muted)] mb-1 block">Task</label>
            <Textarea
              value={task}
              onChange={setTask}
              rows={5}
              monospaced={false}
              placeholder="e.g. Audit the auth flow in src/ for security issues and write up findings."
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="text-[11px] font-medium text-[color:var(--fg-muted)] flex items-center gap-1 mb-1">
              Team template
              <InfoIcon
                content="A starting set of roles. Orchestrated = one lead agent delegates to the roles (one card, hierarchy). Parallel = one agent per role, side by side."
                significance="Edit the roles freely, or pick Custom to start blank."
              />
            </label>
            <Select
              value={templateId}
              onChange={applyTemplate}
              options={[
                ...meta.teamTemplates.map((t) => ({ value: t.id, label: t.name })),
                { value: "custom", label: "Custom team" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-medium text-[color:var(--fg-muted)] mb-1 block">Team name</label>
              <TextInput value={teamName} onChange={setTeamName} placeholder="Build squad" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[color:var(--fg-muted)] mb-1 block">Mode</label>
              <div className="grid grid-cols-2 gap-1 bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md p-0.5 h-[34px]">
                {(["orchestrated", "parallel"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTeamMode(m)}
                    className={cn(
                      "rounded text-[10.5px] font-medium transition",
                      teamMode === m ? "bg-[color:var(--accent)] text-[color:var(--accent-ink)]" : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]",
                    )}
                  >
                    {m === "orchestrated" ? "Lead" : "Parallel"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[color:var(--fg-muted)] mb-1 block">Objective (shared)</label>
            <Textarea
              value={objective}
              onChange={setObjective}
              rows={3}
              monospaced={false}
              placeholder="e.g. Add Stripe billing end to end: schema, API, checkout UI, and tests."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-[color:var(--fg-muted)]">Roles ({roles.length})</label>
              <button
                onClick={() => setRoles((rs) => [...rs, { role: `Role ${rs.length + 1}`, agentName: "general", responsibility: "" }])}
                className="text-[11px] text-[color:var(--accent)] hover:underline inline-flex items-center gap-1"
              >
                <Plus size={11} /> Add role
              </button>
            </div>
            <div className="space-y-2">
              {roles.map((r, i) => (
                <div key={i} className="rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev-2)]/40 p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      value={r.role}
                      onChange={(e) => updateRole(i, { role: e.target.value })}
                      placeholder="Role name"
                      className="flex-1 bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded px-2 py-1 text-[11.5px] font-medium focus:border-[color:var(--accent)] transition"
                    />
                    {roles.length > 1 && (
                      <button
                        onClick={() => setRoles((rs) => rs.filter((_, j) => j !== i))}
                        className="text-[color:var(--fg-faint)] hover:text-[color:var(--danger)] transition shrink-0"
                        aria-label="Remove role"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <Select value={r.agentName} onChange={(v) => updateRole(i, { agentName: v })} options={agentOptions} />
                  <input
                    value={r.responsibility}
                    onChange={(e) => updateRole(i, { responsibility: e.target.value })}
                    placeholder="Responsibility…"
                    className="w-full bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded px-2 py-1 text-[11px] focus:border-[color:var(--accent)] transition"
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* shared: model / max turns / permission / cwd */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="text-[11px] font-medium text-[color:var(--fg-muted)] mb-1 block">Model</label>
          <Select value={model} onChange={setModel} options={MODELS} />
        </div>
        <div>
          <label className="text-[11px] font-medium text-[color:var(--fg-muted)] mb-1 block">Max turns</label>
          <TextInput value={maxTurns} onChange={setMaxTurns} placeholder="30" />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-medium text-[color:var(--fg-muted)] flex items-center gap-1 mb-1">
          Permissions
          <InfoIcon
            content="How the headless agent handles tool permissions. It can't answer interactive prompts, so 'default' isn't offered."
            significance="Plan = read-only & safe. Accept edits = does the work. Full auto skips every check — only for fully trusted tasks."
          />
        </label>
        <Select
          value={permissionMode}
          onChange={(v) => setPermissionMode(v as PermMode)}
          options={PERM_MODES.map((p) => ({ value: p.value, label: p.label }))}
        />
        {permissionMode === "bypassPermissions" && (
          <p className="text-[10.5px] text-[color:var(--danger)] mt-1 flex items-start gap-1 leading-relaxed">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            Skips every permission check — the agent can run any command and edit any file under the
            working directory. Use only for tasks you fully trust.
          </p>
        )}
      </div>

      <div>
        <label className="text-[11px] font-medium text-[color:var(--fg-muted)] mb-1 block">Working directory</label>
        <TextInput value={cwd} onChange={setCwd} placeholder="/absolute/path" monospaced />
      </div>

      {err && (
        <div className="text-[11px] text-[color:var(--danger)] flex items-start gap-1.5 leading-relaxed">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {err}
        </div>
      )}

      {kind === "single" ? (
        <button
          onClick={launchSingle}
          disabled={!task.trim() || busy || !meta.claudeAvailable}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 h-9 rounded-md text-sm font-medium transition",
            "bg-[color:var(--accent)] text-[color:var(--accent-ink)] hover:bg-[color:var(--accent-2)]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
          {busy ? "Launching…" : "Launch agent"}
        </button>
      ) : (
        <button
          onClick={launchTeam}
          disabled={!objective.trim() || busy || !meta.claudeAvailable || roles.filter((r) => r.responsibility.trim()).length === 0}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 h-9 rounded-md text-sm font-medium transition",
            "bg-[color:var(--accent)] text-[color:var(--accent-ink)] hover:bg-[color:var(--accent-2)]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
          {busy ? "Launching team…" : teamMode === "orchestrated" ? "Launch team (lead delegates)" : `Launch ${roles.filter((r) => r.responsibility.trim()).length} agents`}
        </button>
      )}
      <span
        className={cn(
          "block text-center text-[10px]",
          permTone === "danger" ? "text-[color:var(--danger)]" : "text-[color:var(--fg-faint)]",
        )}
      >
        Runs <code className="font-mono">claude -p</code> · {permissionMode}
      </span>
    </Card>
  );
}

// ─── continue / resume control (used on finished runs + observed sessions) ──
function ContinueControl({
  sessionId,
  cwd,
  label,
  post,
  caution,
}: {
  sessionId: string;
  cwd: string;
  label: string;
  post: (body: Record<string, unknown>) => Promise<{ error?: string }>;
  caution?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!task.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const res = await post({ action: "continue", sessionId, cwd, task: task.trim(), agentLabel: label });
    setBusy(false);
    if (res?.error) setErr(res.error);
    else {
      setTask("");
      setOpen(false);
    }
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] px-2 h-7 rounded-md border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] hover:border-[color:var(--accent)]/40 transition"
      >
        <RotateCw size={11} /> Continue
      </button>
    );

  return (
    <div className="space-y-1.5 w-full">
      {caution && (
        <p className="text-[10px] text-[color:var(--warning)] leading-relaxed">
          Best for an idle or finished session — resuming one that&apos;s actively running in a terminal
          can collide.
        </p>
      )}
      <Textarea
        value={task}
        onChange={setTask}
        rows={2}
        monospaced={false}
        placeholder="Next instruction — resumes with full prior context…"
      />
      {err && <div className="text-[10.5px] text-[color:var(--danger)] leading-relaxed">{err}</div>}
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={!task.trim() || busy}
          className="inline-flex items-center gap-1.5 text-[11px] px-2.5 h-7 rounded-md bg-[color:var(--accent)] text-[color:var(--accent-ink)] font-medium hover:bg-[color:var(--accent-2)] transition disabled:opacity-40"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <RotateCw size={11} />} Resume
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setErr(null);
          }}
          className="text-[11px] px-2 h-7 rounded-md text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── global skill / tool activity feed ──────────────────────────────
function SkillActivityFeed({ runs }: { runs: Run[] }) {
  const items = useMemo(() => {
    const acc: { run: Run; node: ActivityNode }[] = [];
    const walk = (run: Run, nodes: ActivityNode[]) => {
      for (const n of nodes) {
        acc.push({ run, node: n });
        walk(run, n.children);
      }
    };
    for (const r of runs) walk(r, r.tree);
    return acc.sort((a, b) => b.node.startedAt - a.node.startedAt).slice(0, 100);
  }, [runs]);

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center text-xs text-[color:var(--fg-muted)]">
        No activity yet. Launch an agent to see which skills, sub-agents and tools fire in real time.
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-[color:var(--border)]">
      {items.map(({ run, node }, i) => {
        const st = NODE_STYLE[node.kind] ?? NODE_STYLE.tool;
        const Icon = st.Icon;
        return (
          <div key={node.id + i} className="flex items-center gap-3 px-3.5 py-2">
            <span className={cn("shrink-0", st.cls)}>
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={cn("text-xs font-medium truncate", node.kind === "subagent" ? st.cls : "text-[color:var(--fg)]")}>
                  {node.label}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">{node.kind}</span>
                <NodeStatusIcon status={node.status} />
              </div>
              {node.detail && <div className="text-[10.5px] font-mono text-[color:var(--fg-faint)] truncate">{node.detail}</div>}
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10.5px] text-[color:var(--fg-muted)] truncate max-w-[140px]">{run.agentLabel}</div>
              <div className="text-[10px] text-[color:var(--fg-faint)]">{relTime(node.startedAt)}</div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ─── measurement view ───────────────────────────────────────────────
function Bar({ value, max, cls }: { value: number; max: number; cls: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-[color:var(--bg-elev-2)] overflow-hidden">
      <div className={cn("h-full rounded-full", cls)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MetricsView({
  metrics,
  history,
  onClearHistory,
}: {
  metrics: AggregateMetrics;
  history: LiveSnapshot["history"];
  onClearHistory: () => void;
}) {
  const maxAgent = Math.max(1, ...metrics.byAgent.map((a) => a.runs));
  const maxTool = Math.max(1, ...metrics.topTools.map((t) => t.count));
  const maxSkill = Math.max(1, ...metrics.topSkills.map((t) => t.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Finished runs" value={String(metrics.totalRuns)} Icon={Activity} />
        <Kpi
          label="Success rate"
          value={`${Math.round(metrics.successRate * 100)}%`}
          Icon={Check}
          tone={
            metrics.totalRuns === 0
              ? undefined
              : metrics.successRate >= 0.8
                ? "text-[color:var(--success)]"
                : metrics.successRate >= 0.5
                  ? "text-[color:var(--warning)]"
                  : "text-[color:var(--danger)]"
          }
        />
        <Kpi label="Total cost" value={fmtCost(metrics.totalCostUsd)} Icon={Coins} />
        <Kpi label="Total tokens" value={fmtTokens(metrics.totalTokens)} Icon={Cpu} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3">By agent</h4>
          {metrics.byAgent.length === 0 ? (
            <p className="text-[11px] text-[color:var(--fg-faint)]">No runs yet.</p>
          ) : (
            <div className="space-y-2.5">
              {metrics.byAgent.map((a) => (
                <div key={a.name}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="truncate text-[color:var(--fg)]">{a.label || a.name}</span>
                    <span className="text-[color:var(--fg-muted)] tabular-nums">
                      {a.runs} · {fmtCost(a.costUsd)} · {fmtTokens(a.tokens)}
                    </span>
                  </div>
                  <Bar value={a.runs} max={maxAgent} cls="bg-[color:var(--accent)]" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3">Models used</h4>
          {metrics.byModel.length === 0 ? (
            <p className="text-[11px] text-[color:var(--fg-faint)]">No runs yet.</p>
          ) : (
            <div className="space-y-2.5">
              {metrics.byModel.map((m) => (
                <div key={m.model} className="flex items-center justify-between text-[11px]">
                  <span className="text-[color:var(--fg)]">{m.model}</span>
                  <span className="text-[color:var(--fg-muted)] tabular-nums">
                    {m.runs} runs · {fmtCost(m.costUsd)} · {fmtTokens(m.tokens)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-300" /> Top skills
          </h4>
          {metrics.topSkills.length === 0 ? (
            <p className="text-[11px] text-[color:var(--fg-faint)]">No skills fired yet.</p>
          ) : (
            <div className="space-y-2.5">
              {metrics.topSkills.map((t) => (
                <div key={t.name}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="truncate text-[color:var(--fg)] font-mono text-[10.5px]">{t.name}</span>
                    <span className="text-[color:var(--fg-muted)] tabular-nums">{t.count}</span>
                  </div>
                  <Bar value={t.count} max={maxSkill} cls="bg-amber-400" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
            <Wrench size={13} className="text-sky-300" /> Top tools
          </h4>
          {metrics.topTools.length === 0 ? (
            <p className="text-[11px] text-[color:var(--fg-faint)]">No tools used yet.</p>
          ) : (
            <div className="space-y-2.5">
              {metrics.topTools.map((t) => (
                <div key={t.name}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="truncate text-[color:var(--fg)] font-mono text-[10.5px]">{t.name}</span>
                    <span className="text-[color:var(--fg-muted)] tabular-nums">{t.count}</span>
                  </div>
                  <Bar value={t.count} max={maxTool} cls="bg-sky-400" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Run history</h4>
          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="text-[11px] text-[color:var(--fg-muted)] hover:text-[color:var(--danger)] inline-flex items-center gap-1 transition"
            >
              <Trash2 size={11} /> Clear
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-[11px] text-[color:var(--fg-faint)]">No finished runs yet.</p>
        ) : (
          <div className="space-y-1">
            {history.slice(0, 40).map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-1.5 border-b border-[color:var(--border)] last:border-0">
                <StatusPill status={h.status} />
                <span className="text-[11px] text-[color:var(--fg)] truncate flex-1 min-w-0">{h.task}</span>
                <span className="text-[10.5px] text-[color:var(--fg-muted)] tabular-nums shrink-0 hidden sm:inline">
                  {h.agentLabel}
                </span>
                <span className="text-[10.5px] text-[color:var(--fg-faint)] tabular-nums shrink-0">
                  {fmtDuration(h.durationMs)} · {fmtCost(h.costUsd)}
                </span>
                <span className="text-[10px] text-[color:var(--fg-faint)] shrink-0 hidden md:inline">{relTime(h.endedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, Icon, tone }: { label: string; value: string; Icon: typeof Activity; tone?: string }) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-[color:var(--fg-faint)] mb-1.5">
        <Icon size={12} className={tone || "text-[color:var(--fg-muted)]"} />
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

// ─── live sessions running on this machine (observed, read-only) ────
function useLiveSessions() {
  const [data, setData] = useState<LiveSessionsResponse>({ sessions: [], processCount: null, scannedAt: 0 });
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/orchestrator/live-sessions");
        const d = (await r.json()) as LiveSessionsResponse;
        if (!stop) setData(d);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 3500);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);
  return data;
}

const ACT_STYLE: Record<LiveSession["lastActivityKind"], { Icon: typeof Wrench; cls: string }> = {
  tool: { Icon: Wrench, cls: "text-sky-300" },
  skill: { Icon: Sparkles, cls: "text-amber-300" },
  subagent: { Icon: GitBranch, cls: "text-violet-300" },
  mcp: { Icon: ServerCog, cls: "text-emerald-300" },
  text: { Icon: Activity, cls: "text-[color:var(--fg-muted)]" },
  idle: { Icon: Clock, cls: "text-[color:var(--fg-faint)]" },
};

function shortModel(m?: string): string {
  if (!m) return "";
  return m.replace(/^claude-/, "").replace(/-\d{6,}$/, "");
}

function LiveSessionCard({
  s,
  now,
  post,
}: {
  s: LiveSession;
  now: number;
  post: (body: Record<string, unknown>) => Promise<{ error?: string }>;
}) {
  const live = now - s.lastActiveAt < 90_000;
  const a = ACT_STYLE[s.lastActivityKind] ?? ACT_STYLE.text;
  const Icon = a.Icon;
  return (
    <Card className={cn("p-3.5", live && "border-[color:var(--success)]/40")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-[color:var(--bg-elev-2)] text-[color:var(--fg-muted)]">
            <Terminal size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium truncate max-w-[300px]">{s.title}</span>
              {live ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-md border text-[color:var(--success)] border-[color:var(--success)]/40 bg-[color:var(--success)]/10">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--success)] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" />
                  </span>
                  Live
                </span>
              ) : (
                <Badge>recent</Badge>
              )}
              {s.model && <Badge>{shortModel(s.model)}</Badge>}
              {s.subagentActive && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md border border-violet-500/40 text-violet-300">
                  <GitBranch size={9} /> sub-agent
                </span>
              )}
              <Tooltip
                content="A claude session the orchestrator didn't launch — observed read-only by tailing its transcript."
                significance="You can't stop or stream it from here; resume it in your terminal with the command shown."
              >
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">
                  <Eye size={10} /> observed
                </span>
              </Tooltip>
            </div>
            <div className="text-[11px] mt-1 flex items-center gap-1.5 min-w-0">
              <Icon size={12} className={cn("shrink-0", a.cls)} />
              <span className="font-mono text-[color:var(--fg-muted)] truncate">{s.lastActivity}</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10.5px] text-[color:var(--fg-muted)] truncate max-w-[160px]">{s.project}</div>
          <div className="text-[10px] text-[color:var(--fg-faint)]">{relTime(s.lastActiveAt)}</div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-[color:var(--fg-faint)] font-mono truncate">{s.cwd}</span>
        <div className="flex items-center gap-1 shrink-0">
          <code className="text-[10px] font-mono bg-[color:var(--bg-elev-2)] px-1.5 py-0.5 rounded text-[color:var(--fg-muted)]">
            claude --resume {s.sessionId.slice(0, 8)}…
          </code>
          <CopyButton text={`claude --resume ${s.sessionId}`} />
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-[color:var(--border)]">
        <ContinueControl
          sessionId={s.sessionId}
          cwd={s.cwd}
          label={`Continued · ${s.project}`}
          post={post}
          caution={live}
        />
      </div>
    </Card>
  );
}

function LiveSessionsSection({
  data,
  now,
  post,
}: {
  data: LiveSessionsResponse;
  now: number;
  post: (body: Record<string, unknown>) => Promise<{ error?: string }>;
}) {
  const n = data.processCount;
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[color:var(--fg-muted)]" />
          <h3 className="text-sm font-medium">Running on this machine</h3>
          {n != null && (
            <Badge tone={n > 0 ? "accent" : "default"}>
              {n} session{n === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <InfoIcon
          content="Live claude sessions the orchestrator didn't launch — your terminals and other Claude Code windows. Detected by counting running claude processes and tailing recent session transcripts."
          significance="These are observed read-only; you can't stop or stream them from here. Launch agents below to run and control them on this board."
        />
      </div>
      {data.sessions.length === 0 ? (
        <Card className="p-4 text-[11px] text-[color:var(--fg-muted)] leading-relaxed">
          No sessions with activity in the last 30 minutes.
          {n ? ` (${n} claude process${n === 1 ? "" : "es"} running — may be idle, waiting for input.)` : ""}
        </Card>
      ) : (
        <div className="space-y-2.5">
          {data.sessions.map((s) => (
            <LiveSessionCard key={s.sessionId} s={s} now={now} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── campaigns (multi-week, resumable work) ─────────────────────────
const FieldLabel = ({ children }: { children: ReactNode }) => (
  <label className="text-[11px] font-medium text-[color:var(--fg-muted)] mb-1 block">{children}</label>
);

function NewCampaignForm({
  meta,
  onCreate,
  onCancel,
}: {
  meta: Meta;
  onCreate: (b: Record<string, unknown>) => Promise<{ error?: string }>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [plan, setPlan] = useState("");
  const [cwd, setCwd] = useState(meta.defaults?.cwd || "");
  const [agentName, setAgentName] = useState("general");
  const [model, setModel] = useState(meta.defaults?.model || "sonnet");
  const [permissionMode, setPermissionMode] = useState<PermMode>(meta.defaults?.permissionMode || "acceptEdits");
  const [maxTurns, setMaxTurns] = useState("50");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const agentOptions = [
    { value: "general", label: "General agent" },
    ...meta.agents.map((a) => ({ value: a.name, label: a.name })),
  ];

  const submit = async () => {
    if (!name.trim() || !objective.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const r = await onCreate({
      name: name.trim(),
      objective: objective.trim(),
      plan: plan.trim() || undefined,
      cwd: cwd.trim() || undefined,
      agentName,
      model,
      permissionMode,
      maxTurns: Number(maxTurns) || undefined,
    });
    setBusy(false);
    if (r?.error) setErr(r.error);
  };

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextInput value={name} onChange={setName} placeholder="e.g. Migrate billing to Stripe" />
          </div>
          <div>
            <FieldLabel>Working directory</FieldLabel>
            <TextInput value={cwd} onChange={setCwd} placeholder="/absolute/path" monospaced />
          </div>
        </div>
        <div>
          <FieldLabel>Objective</FieldLabel>
          <Textarea value={objective} onChange={setObjective} rows={2} monospaced={false} placeholder="The end goal of this multi-week campaign…" />
        </div>
        <div>
          <FieldLabel>Initial plan / checklist (optional)</FieldLabel>
          <Textarea value={plan} onChange={setPlan} rows={4} placeholder={"- [ ] Phase 1: …\n- [ ] Phase 2: …\n- [ ] Phase 3: …"} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <FieldLabel>Agent</FieldLabel>
            <Select value={agentName} onChange={setAgentName} options={agentOptions} />
          </div>
          <div>
            <FieldLabel>Model</FieldLabel>
            <Select value={model} onChange={setModel} options={MODELS} />
          </div>
          <div>
            <FieldLabel>Permissions</FieldLabel>
            <Select value={permissionMode} onChange={(v) => setPermissionMode(v as PermMode)} options={PERM_MODES.map((p) => ({ value: p.value, label: p.value }))} />
          </div>
          <div>
            <FieldLabel>Max turns / session</FieldLabel>
            <TextInput value={maxTurns} onChange={setMaxTurns} placeholder="50" />
          </div>
        </div>
        {err && <div className="text-[11px] text-[color:var(--danger)]">{err}</div>}
        <div className="flex items-center gap-2">
          <button
            onClick={submit}
            disabled={!name.trim() || !objective.trim() || busy}
            className="inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-md bg-[color:var(--accent)] text-[color:var(--accent-ink)] font-medium hover:bg-[color:var(--accent-2)] transition disabled:opacity-40"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={13} />} Create campaign
          </button>
          <button onClick={onCancel} className="text-xs px-3 h-8 rounded-md text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition">
            Cancel
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

function CampaignCard({
  c,
  runs,
  post,
}: {
  c: Campaign;
  runs: Run[];
  post: (body: Record<string, unknown>) => Promise<{ error?: string }>;
}) {
  const [expanded, setExpanded] = useState(false);
  // Draft override: null = show the live campaign plan (auto-updates as sessions
  // run); non-null = the user is editing. Avoids syncing via an effect.
  const [planDraft, setPlanDraft] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const activeRun = runs.find((r) => r.campaignId === c.id && (r.status === "running" || r.status === "queued"));

  const planValue = planDraft ?? c.plan;
  const planDirty = planDraft !== null && planDraft !== c.plan;
  const statusTone = c.status === "done" ? "success" : c.status === "paused" ? "warning" : "accent";
  const savePlan = async () => {
    await post({ action: "campaignUpdate", id: c.id, patch: { plan: planValue } });
    setPlanDraft(null);
  };
  const runNext = async () => {
    setBusy(true);
    await post({ action: "campaignRunSession", id: c.id, instruction: instruction.trim() || undefined });
    setBusy(false);
    setInstruction("");
  };

  return (
    <Card className={cn(activeRun && "border-[color:var(--success)]/40")}>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              <ClipboardList size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{c.name}</span>
                <Badge tone={statusTone}>{c.status}</Badge>
                {activeRun && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-md border text-[color:var(--success)] border-[color:var(--success)]/40 bg-[color:var(--success)]/10">
                    <Loader2 size={9} className="animate-spin" /> session running
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[color:var(--fg-muted)] mt-0.5 line-clamp-1">{c.objective}</div>
            </div>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] hover:bg-[color:var(--bg-elev-2)] transition shrink-0"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        </div>

        <div className="mt-2.5 flex items-center gap-3.5 flex-wrap">
          <MetricChip Icon={Layers} value={`${c.sessions.length} session${c.sessions.length === 1 ? "" : "s"}`} label="Work sessions run" />
          <MetricChip Icon={Coins} value={fmtCost(c.totalCostUsd)} label="Total cost" />
          <MetricChip Icon={Clock} value={relTime(c.updatedAt)} label="Last updated" />
          <MetricChip Icon={Cpu} value={shortModel(c.model)} label="Model" />
        </div>

        {/* run next session */}
        <div className="mt-3 flex items-center gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Optional focus for this session (else continues the plan)…"
            className="flex-1 bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md px-2.5 py-1.5 text-[11.5px] focus:border-[color:var(--accent)] transition"
          />
          <button
            onClick={runNext}
            disabled={busy || !!activeRun || c.status === "done"}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 h-8 rounded-md bg-[color:var(--accent)] text-[color:var(--accent-ink)] font-medium hover:bg-[color:var(--accent-2)] transition disabled:opacity-40 shrink-0"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Run next session
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-4 py-3 border-t border-[color:var(--border)] space-y-4">
              {/* plan */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">Plan / checklist (the agent keeps this current)</div>
                  {planDirty && (
                    <button onClick={savePlan} className="inline-flex items-center gap-1 text-[10.5px] text-[color:var(--accent)] hover:underline">
                      <Save size={10} /> Save
                    </button>
                  )}
                </div>
                <Textarea
                  value={planValue}
                  onChange={(v) => setPlanDraft(v)}
                  rows={6}
                  placeholder="No plan yet — it gets created and updated as sessions run."
                />
              </div>

              {/* session log */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)] mb-1.5">Session log</div>
                {c.sessions.length === 0 ? (
                  <p className="text-[11px] text-[color:var(--fg-faint)]">No sessions yet. Hit “Run next session”.</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...c.sessions].reverse().map((s, i) => (
                      <div key={s.runId + i} className="flex items-start gap-2.5 text-[11px] border-b border-[color:var(--border)] last:border-0 pb-1.5">
                        <StatusPill status={s.status} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[color:var(--fg)] leading-relaxed">{s.summary || "(running…)"}</div>
                          {s.instruction && <div className="text-[10px] text-[color:var(--fg-faint)] mt-0.5">focus: {s.instruction}</div>}
                        </div>
                        <div className="text-right shrink-0 text-[10px] text-[color:var(--fg-faint)]">
                          <div>{fmtCost(s.costUsd)}</div>
                          <div>{relTime(s.startedAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* status actions */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {c.status !== "active" && (
                  <button onClick={() => post({ action: "campaignUpdate", id: c.id, patch: { status: "active" } })} className="inline-flex items-center gap-1 text-[11px] px-2.5 h-7 rounded-md border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition">
                    <Play size={11} /> Activate
                  </button>
                )}
                {c.status === "active" && (
                  <button onClick={() => post({ action: "campaignUpdate", id: c.id, patch: { status: "paused" } })} className="inline-flex items-center gap-1 text-[11px] px-2.5 h-7 rounded-md border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition">
                    <Pause size={11} /> Pause
                  </button>
                )}
                {c.status !== "done" && (
                  <button onClick={() => post({ action: "campaignUpdate", id: c.id, patch: { status: "done" } })} className="inline-flex items-center gap-1 text-[11px] px-2.5 h-7 rounded-md border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--success)] transition">
                    <CheckCircle2 size={11} /> Mark done
                  </button>
                )}
                <button onClick={() => post({ action: "campaignDelete", id: c.id })} className="inline-flex items-center gap-1 text-[11px] px-2.5 h-7 rounded-md border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--danger)] transition ml-auto">
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function CampaignsView({
  campaigns,
  meta,
  runs,
  post,
}: {
  campaigns: Campaign[];
  meta: Meta;
  runs: Run[];
  post: (body: Record<string, unknown>) => Promise<{ error?: string }>;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <ClipboardList size={14} className="text-[color:var(--accent)]" /> Campaigns
          </h3>
          <p className="text-[11px] text-[color:var(--fg-muted)] mt-1 max-w-2xl leading-relaxed">
            Long-running, multi-week work. A campaign keeps an objective and a self-updating plan. “Run
            next session” launches an agent that continues from the saved plan + prior progress, then
            writes back an updated plan — so it survives app restarts and weeks of work.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-md bg-[color:var(--accent)] text-[color:var(--accent-ink)] font-medium hover:bg-[color:var(--accent-2)] transition"
        >
          <Plus size={13} /> New campaign
        </button>
      </div>
      <AnimatePresence>
        {creating && (
          <NewCampaignForm
            meta={meta}
            onCancel={() => setCreating(false)}
            onCreate={async (b) => {
              const r = await post({ action: "campaignCreate", ...b });
              if (!r?.error) setCreating(false);
              return r;
            }}
          />
        )}
      </AnimatePresence>
      {campaigns.length === 0
        ? !creating && (
            <Card className="p-10 text-center">
              <ClipboardList size={28} className="mx-auto text-[color:var(--fg-faint)] mb-3" />
              <h3 className="text-sm font-medium mb-1.5">No campaigns yet</h3>
              <p className="text-xs text-[color:var(--fg-muted)] max-w-sm mx-auto leading-relaxed">
                Create one for a multi-week effort, then run a work session whenever you want — it always
                picks up where it left off, with the plan kept current.
              </p>
            </Card>
          )
        : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <CampaignCard key={c.id} c={c} runs={runs} post={post} />
              ))}
            </div>
          )}
    </div>
  );
}

// Group runs so a team's member cards render together under one header.
function groupRuns(runs: Run[]): { key: string; teamId?: string; teamName?: string; teamMode?: TeamMode; runs: Run[] }[] {
  const order: string[] = [];
  const map = new Map<string, Run[]>();
  for (const r of runs) {
    const key = r.teamId || `solo:${r.id}`;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(r);
  }
  return order.map((key) => {
    const group = map.get(key)!;
    const first = group[0];
    return { key, teamId: first.teamId, teamName: first.teamName, teamMode: first.teamMode, runs: group };
  });
}

// ─── shell ──────────────────────────────────────────────────────────
export function OrchestratorShell({ projectDir }: { projectDir: string }) {
  const { live, meta, connected, post } = useOrchestrator(projectDir);
  const liveSessions = useLiveSessions();
  const [tab, setTab] = useState<"board" | "activity" | "metrics" | "campaigns">("board");
  const [now, setNow] = useState<number>(() => Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // tick a live clock while anything is running (drives elapsed timers)
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const runs = live.runs;
  const activeCount = runs.filter((r) => r.status === "running").length;
  const liveCost = runs.reduce((a, r) => a + (r.metrics.costUsd || 0), 0);

  const onStop = (id: string) => post({ action: "stop", id });
  const onRemove = (id: string) => post({ action: "removeRun", id });
  const finishedCount = runs.filter((r) => r.status !== "running" && r.status !== "queued").length;

  const TABS: { id: typeof tab; label: string; Icon: typeof Network }[] = [
    { id: "board", label: "Live board", Icon: Network },
    { id: "activity", label: "Skill activity", Icon: Sparkles },
    { id: "metrics", label: "Measurement", Icon: Gauge },
    { id: "campaigns", label: "Campaigns", Icon: ClipboardList },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-5">
      {/* intro */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Network size={18} className="text-[color:var(--accent)]" />
            Agent Orchestrator
          </h2>
          <p className="text-xs text-[color:var(--fg-muted)] mt-1 max-w-2xl leading-relaxed">
            Launch multiple Claude agents at once, each on its own task, and watch them work live —
            every tool call, skill, and spawned sub-agent rendered as a hierarchy with running cost
            and token metrics. The board also shows the claude sessions already running on your
            machine (terminals, other windows), observed read-only.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[color:var(--fg-muted)] shrink-0">
          <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-[color:var(--success)]" : "bg-[color:var(--warning)]")} />
          {connected ? "Live" : "Polling"}
        </div>
      </div>

      {/* claude not found */}
      {meta && !meta.claudeAvailable && (
        <Card className="p-4 border-[color:var(--danger)]/40 bg-[color:var(--danger)]/5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-[color:var(--danger)] mt-0.5 shrink-0" />
            <div className="text-xs text-[color:var(--fg-muted)] leading-relaxed">
              <span className="text-[color:var(--danger)] font-medium">The `claude` CLI was not found.</span> The
              orchestrator launches agents by running <code className="font-mono">claude -p</code>. Install Claude
              Code (<code className="font-mono">npm i -g @anthropic-ai/claude-code</code>) or set the{" "}
              <code className="font-mono">CLAUDE_BIN</code> env var to its path, then reopen this view.
            </div>
          </div>
        </Card>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Active now" value={String(activeCount)} Icon={Activity} tone={activeCount > 0 ? "text-[color:var(--success)]" : undefined} />
        <Kpi label="On board" value={String(runs.length)} Icon={Network} />
        <Kpi label="Live cost" value={fmtCost(liveCost)} Icon={Coins} />
        <Kpi label="Total runs" value={String(live.metrics.totalRuns)} Icon={Gauge} />
        <Kpi label="Success" value={`${Math.round(live.metrics.successRate * 100)}%`} Icon={Check} tone="text-[color:var(--success)]" />
      </div>

      {/* main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
        {meta ? (
          <LaunchPanel meta={meta} projectDir={projectDir} post={post} />
        ) : (
          <Card className="p-6 text-center text-xs text-[color:var(--fg-muted)]">Loading…</Card>
        )}

        <div className="min-w-0 space-y-4">
          {/* tabs */}
          <div className="inline-flex items-center bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-lg p-0.5 relative">
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)} className="relative px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 z-10">
                  {active && (
                    <motion.div
                      layoutId="orch-tab-pill"
                      className="absolute inset-0 bg-[color:var(--accent)] rounded-md"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className={cn("relative inline-flex items-center gap-1.5", active ? "text-black" : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]")}>
                    <Icon size={12} />
                    {label}
                  </span>
                </button>
              );
            })}
            {finishedCount > 0 && tab === "board" && (
              <button
                onClick={() => post({ action: "clearFinished" })}
                className="ml-2 text-[11px] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1 px-2 transition"
              >
                <Trash2 size={11} /> Clear finished
              </button>
            )}
          </div>

          {tab === "board" && (
            <div className="space-y-6">
              <LiveSessionsSection data={liveSessions} now={now} post={post} />

              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Rocket size={14} className="text-[color:var(--accent)]" />
                  <h3 className="text-sm font-medium">Launched from here</h3>
                  {runs.length > 0 && <Badge tone="accent">{runs.length}</Badge>}
                </div>
                {runs.length === 0 ? (
                  <Card className="p-10 text-center">
                    <Network size={28} className="mx-auto text-[color:var(--fg-faint)] mb-3" />
                    <h3 className="text-sm font-medium mb-1.5">No agents launched yet</h3>
                    <p className="text-xs text-[color:var(--fg-muted)] max-w-sm mx-auto leading-relaxed">
                      Use the panel on the left to launch an agent or a team. Unlike the observed
                      sessions above, these run as cards you can watch live, expand into a hierarchy,
                      and stop.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {groupRuns(runs).map((g) =>
                        g.teamId ? (
                          <motion.div
                            key={g.key}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="rounded-xl border border-violet-500/30 bg-violet-500/[0.04] p-2.5"
                          >
                            <div className="flex items-center gap-2 px-1 pb-2">
                              <Users size={14} className="text-violet-300" />
                              <span className="text-sm font-medium text-violet-200">{g.teamName}</span>
                              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md border border-violet-500/40 text-violet-300">
                                team · {g.teamMode === "parallel" ? "parallel" : "lead"}
                              </span>
                              <span className="text-[10px] text-[color:var(--fg-faint)]">
                                {g.runs.length} agent{g.runs.length === 1 ? "" : "s"}
                              </span>
                            </div>
                            <div className="space-y-2.5">
                              {g.runs.map((r) => (
                                <RunCard key={r.id} run={r} now={now} onStop={onStop} onRemove={onRemove} post={post} />
                              ))}
                            </div>
                          </motion.div>
                        ) : (
                          <RunCard key={g.runs[0].id} run={g.runs[0]} now={now} onStop={onStop} onRemove={onRemove} post={post} />
                        ),
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "activity" && <SkillActivityFeed runs={runs} />}

          {tab === "metrics" && (
            <MetricsView
              metrics={live.metrics}
              history={live.history}
              onClearHistory={() => post({ action: "clearHistory" })}
            />
          )}

          {tab === "campaigns" && meta && (
            <CampaignsView campaigns={live.campaigns} meta={meta} runs={runs} post={post} />
          )}
        </div>
      </div>
    </div>
  );
}
