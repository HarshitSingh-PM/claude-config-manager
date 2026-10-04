"use client";
// The Crews tab: a CrewAI-style pipeline builder where EVERYTHING is authored
// in the UI — agents (role/goal/backstory personas), tasks, the execution
// sequence, and which task's output feeds which. Saved crews are reusable:
// "Run crew" asks only for the declared input values and executes the pipeline
// through the orchestrator, one headless claude run per step.
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Workflow,
  Bot,
  Plus,
  Play,
  Square,
  Trash2,
  Copy,
  PencilLine,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Loader2,
  Coins,
  Clock,
  ListOrdered,
  Variable,
  AlertTriangle,
  SkipForward,
  Save,
  Crown,
  CircleDashed,
} from "lucide-react";
import { Card, TextInput, Textarea, Select, Badge, Button, NumberInput } from "./primitives";
import { InfoIcon } from "./Tooltip";
import { cn } from "@/lib/utils";
import type {
  Crew,
  CrewAgent,
  CrewTask,
  CrewInputVar,
  CrewRun,
  CrewStepRun,
  AgentDef,
  PermMode,
} from "@/lib/orchestrator/types";

type Post = (body: Record<string, unknown>) => Promise<Record<string, unknown> & { error?: string }>;

const MODELS = [
  { value: "sonnet", label: "Sonnet 5.5 — fast, balanced (recommended)" },
  { value: "opus", label: "Opus 5.5 — most capable everyday model" },
  { value: "haiku", label: "Haiku 4.5 — cheapest, quick" },
  { value: "fable", label: "Fable 5.1 — highest capability, premium cost" },
];

const PERM_MODES: { value: PermMode; label: string }[] = [
  { value: "acceptEdits", label: "Accept edits — runs tools & writes files (recommended)" },
  { value: "plan", label: "Plan only — explores & proposes, no changes (safe)" },
  { value: "auto", label: "Auto — the model decides per tool call" },
  { value: "dontAsk", label: "Don't ask — never prompts, denies risky actions" },
  { value: "bypassPermissions", label: "Full auto — skips ALL permission checks" },
];

function fmtCost(n: number): string {
  if (!n) return "$0";
  return `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;
}
function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
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

const newLocalId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

// ─── draft model (editor state) ─────────────────────────────────────
interface Draft {
  id?: string;
  name: string;
  description: string;
  process: "sequential" | "hierarchical";
  cwd: string;
  maxBudgetUsd?: number;
  agents: CrewAgent[];
  tasks: CrewTask[];
  inputs: CrewInputVar[];
}

function emptyAgent(): CrewAgent {
  return {
    id: newLocalId("cagent"),
    role: "",
    goal: "",
    backstory: "",
    model: "sonnet",
    permissionMode: "acceptEdits",
  };
}
function emptyTask(agentId: string): CrewTask {
  return { id: newLocalId("ctask"), name: "", description: "", expectedOutput: "", agentId, contextTaskIds: [] };
}
function emptyDraft(cwd: string): Draft {
  const agent = emptyAgent();
  return {
    name: "",
    description: "",
    process: "sequential",
    cwd,
    agents: [agent],
    tasks: [emptyTask(agent.id)],
    inputs: [{ name: "topic", label: "Topic", placeholder: "What should the crew work on?" }],
  };
}

// A filled-in starter so first-time users see what goes where.
function exampleDraft(cwd: string): Draft {
  const researcher: CrewAgent = {
    id: newLocalId("cagent"),
    role: "Research Analyst",
    goal: "Find accurate, current information and organize it clearly.",
    backstory: "A meticulous analyst who always cites where facts come from and separates facts from opinions.",
    model: "sonnet",
    permissionMode: "acceptEdits",
  };
  const writer: CrewAgent = {
    id: newLocalId("cagent"),
    role: "Content Writer",
    goal: "Turn research into a clear, engaging piece of writing.",
    backstory: "A senior writer who explains complex topics simply, with strong structure and no fluff.",
    model: "sonnet",
    permissionMode: "acceptEdits",
  };
  const editor: CrewAgent = {
    id: newLocalId("cagent"),
    role: "Editor",
    goal: "Polish the draft: fix errors, tighten the writing, verify claims against the research.",
    backstory: "A demanding editor with an eye for accuracy, flow, and consistency.",
    model: "sonnet",
    permissionMode: "acceptEdits",
  };
  const t1: CrewTask = {
    id: newLocalId("ctask"),
    name: "Research the topic",
    description: "Research {topic} thoroughly. Gather the key facts, recent developments, and different viewpoints.",
    expectedOutput: "A structured research brief with 8-12 key findings, each with its source.",
    agentId: researcher.id,
    contextTaskIds: [],
  };
  const t2: CrewTask = {
    id: newLocalId("ctask"),
    name: "Write the article",
    description: "Using the research brief, write an article about {topic} for a general audience.",
    expectedOutput: "A complete ~800-word article with a title, intro, sections, and conclusion.",
    agentId: writer.id,
    contextTaskIds: [t1.id],
  };
  const t3: CrewTask = {
    id: newLocalId("ctask"),
    name: "Edit & finalize",
    description: "Edit the article for clarity and accuracy. Cross-check its claims against the research brief.",
    expectedOutput: "The final polished article, ready to publish.",
    agentId: editor.id,
    contextTaskIds: [t1.id, t2.id],
  };
  return {
    name: "Research & write pipeline",
    description: "Researcher gathers facts → writer drafts an article → editor polishes it.",
    process: "sequential",
    cwd,
    agents: [researcher, writer, editor],
    tasks: [t1, t2, t3],
    inputs: [{ name: "topic", label: "Topic", placeholder: "e.g. the state of on-device AI in 2026" }],
  };
}

// ─── small shared bits ──────────────────────────────────────────────
const FieldLabel = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--fg-muted)] mb-1.5">
    {children}
    {hint ? <InfoIcon content={hint} /> : null}
  </label>
);

function CrewStatusPill({ status }: { status: CrewRun["status"] }) {
  const map: Record<string, { cls: string; label: string; spin?: boolean }> = {
    running: { cls: "text-[color:var(--success)] border-[color:var(--success)]/40 bg-[color:var(--success)]/10", label: "Running", spin: true },
    queued: { cls: "text-[color:var(--fg-muted)] border-[color:var(--border-strong)]", label: "Queued" },
    completed: { cls: "text-[color:var(--success)] border-[color:var(--success)]/40 bg-[color:var(--success)]/10", label: "Completed" },
    failed: { cls: "text-[color:var(--danger)] border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10", label: "Failed" },
    stopped: { cls: "text-[color:var(--warning)] border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10", label: "Stopped" },
  };
  const m = map[status] ?? map.queued;
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-[3px] border", m.cls)}>
      {m.spin && <Loader2 size={10} className="animate-spin" />}
      {m.label}
    </span>
  );
}

function StepStatusIcon({ status }: { status: CrewStepRun["status"] }) {
  if (status === "running") return <Loader2 size={12} className="animate-spin text-[color:var(--success)]" />;
  if (status === "completed") return <Check size={12} className="text-[color:var(--success)]" />;
  if (status === "failed") return <X size={12} className="text-[color:var(--danger)]" />;
  if (status === "skipped") return <SkipForward size={12} className="text-[color:var(--fg-faint)]" />;
  return <CircleDashed size={12} className="text-[color:var(--fg-faint)]" />;
}

// ─── live flow diagram (updates as the pipeline is edited) ──────────
function truncStr(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function FlowDiagram({
  process,
  tasks,
  agents,
}: {
  process: "sequential" | "hierarchical";
  tasks: CrewTask[];
  agents: CrewAgent[];
}) {
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const hier = process === "hierarchical";
  const W = 560;
  const NODE_X = hier ? 56 : 20;
  const NODE_W = 340;
  const NODE_H = 54;
  const GAP = 38;
  const MGR_H = 50;
  const top = hier ? 16 + MGR_H + 44 : 16;
  const yOf = (i: number) => top + i * (NODE_H + GAP);
  const H = tasks.length ? yOf(tasks.length - 1) + NODE_H + 18 : 90;
  const midX = NODE_X + NODE_W / 2;
  const rightX = NODE_X + NODE_W;

  // data-feed arcs (sequential only): src step → consumer step, right side
  const feeds: { src: number; dst: number }[] = [];
  if (!hier) {
    tasks.forEach((t, i) => {
      t.contextTaskIds.forEach((cid) => {
        const j = tasks.findIndex((x) => x.id === cid);
        if (j >= 0 && j < i) feeds.push({ src: j, dst: i });
      });
    });
  }

  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)]/50 p-3 mt-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--fg-muted)] mb-2">
        Flow preview — updates as you edit
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[560px]" role="img" aria-label="Crew flow diagram">
        <defs>
          <marker id="cw-arr-exec" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--accent)" />
          </marker>
          <marker id="cw-arr-feed" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#7dd3fc" />
          </marker>
          <marker id="cw-arr-mgr" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#fcd34d" />
          </marker>
        </defs>

        {/* manager node (hierarchical) */}
        {hier && (
          <g>
            <rect x={NODE_X + 20} y={16} width={NODE_W - 40} height={MGR_H} rx={10} fill="rgba(252,211,77,0.07)" stroke="#fcd34d" strokeOpacity={0.5} />
            <text x={midX} y={36} textAnchor="middle" fontSize="12" fontWeight="600" fill="#fcd34d">
              ♛ Crew manager
            </text>
            <text x={midX} y={52} textAnchor="middle" fontSize="9.5" fill="var(--fg-muted)">
              delegates each task to its specialist, then integrates the results
            </text>
            {/* delegation edges, routed down the left rail */}
            {tasks.map((_, i) => (
              <path
                key={i}
                d={`M ${NODE_X + 40} ${16 + MGR_H} C 24 ${16 + MGR_H + 34}, 24 ${yOf(i) + NODE_H / 2 - 26}, ${NODE_X - 4} ${yOf(i) + NODE_H / 2}`}
                fill="none"
                stroke="#fcd34d"
                strokeOpacity={0.55}
                strokeWidth={1.3}
                strokeDasharray="4 4"
                markerEnd="url(#cw-arr-mgr)"
              />
            ))}
          </g>
        )}

        {/* execution arrows (sequential) */}
        {!hier &&
          tasks.slice(0, -1).map((_, i) => (
            <line
              key={i}
              x1={midX}
              y1={yOf(i) + NODE_H}
              x2={midX}
              y2={yOf(i + 1) - 7}
              stroke="var(--accent)"
              strokeWidth={1.6}
              markerEnd="url(#cw-arr-exec)"
            />
          ))}

        {/* data-feed arcs */}
        {feeds.map((f, k) => {
          const off = Math.min(24 + (f.dst - f.src - 1) * 20, W - rightX - 8);
          const ys = yOf(f.src) + NODE_H / 2;
          const ye = yOf(f.dst) + NODE_H / 2;
          return (
            <path
              key={k}
              d={`M ${rightX} ${ys} C ${rightX + off} ${ys}, ${rightX + off} ${ye}, ${rightX + 5} ${ye}`}
              fill="none"
              stroke="#7dd3fc"
              strokeOpacity={0.65}
              strokeWidth={1.3}
              strokeDasharray="4 4"
              markerEnd="url(#cw-arr-feed)"
            />
          );
        })}

        {/* task nodes */}
        {tasks.map((t, i) => {
          const y = yOf(i);
          const role = byId.get(t.agentId)?.role || "unassigned";
          return (
            <g key={t.id}>
              <rect x={NODE_X} y={y} width={NODE_W} height={NODE_H} rx={10} fill="var(--bg-elev-2)" stroke="var(--border-strong)" />
              <rect x={NODE_X + 12} y={y + 16} width={22} height={22} rx={5} fill="rgba(252,211,77,0.12)" stroke="#fcd34d" strokeOpacity={0.5} />
              <text x={NODE_X + 23} y={y + 31} textAnchor="middle" fontSize="11" fontFamily="monospace" fill="#fcd34d">
                {i + 1}
              </text>
              <text x={NODE_X + 44} y={y + 25} fontSize="11.5" fontWeight="600" fill="var(--fg)">
                {truncStr(t.name.trim() || `Step ${i + 1}`, 42)}
              </text>
              <text x={NODE_X + 44} y={y + 41} fontSize="10" fill="var(--fg-muted)">
                {truncStr(role, 48)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 flex-wrap mt-2 text-[10px] text-[color:var(--fg-muted)]">
        {!hier && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <svg width="22" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="var(--accent)" strokeWidth="1.6" /><path d="M16,0.5 L22,4 L16,7.5 Z" fill="var(--accent)" /></svg>
              runs next
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="22" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#7dd3fc" strokeWidth="1.3" strokeDasharray="3 3" /><path d="M16,0.5 L22,4 L16,7.5 Z" fill="#7dd3fc" /></svg>
              output feeds into
            </span>
          </>
        )}
        {hier && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <svg width="22" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#fcd34d" strokeWidth="1.3" strokeDasharray="3 3" /><path d="M16,0.5 L22,4 L16,7.5 Z" fill="#fcd34d" /></svg>
              manager delegates
            </span>
            <span>The manager works the tasks in whatever order it judges best — numbers are its briefing order.</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── the crew editor (the builder itself) ───────────────────────────
function CrewEditor({
  initial,
  installedAgents,
  onCancel,
  onSaved,
  post,
}: {
  initial: Draft;
  installedAgents: AgentDef[];
  onCancel: () => void;
  onSaved: () => void;
  post: Post;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));
  const patchAgent = (id: string, p: Partial<CrewAgent>) =>
    patch({ agents: d.agents.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const patchTask = (id: string, p: Partial<CrewTask>) =>
    patch({ tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)) });

  const removeAgent = (id: string) => {
    const agents = d.agents.filter((a) => a.id !== id);
    const fallback = agents[0]?.id || "";
    patch({
      agents,
      tasks: d.tasks.map((t) => (t.agentId === id ? { ...t, agentId: fallback } : t)),
    });
  };
  const removeTask = (id: string) =>
    patch({
      tasks: d.tasks.filter((t) => t.id !== id).map((t) => ({ ...t, contextTaskIds: t.contextTaskIds.filter((c) => c !== id) })),
    });
  const moveTask = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= d.tasks.length) return;
    const tasks = [...d.tasks];
    [tasks[idx], tasks[to]] = [tasks[to], tasks[idx]];
    // Deliberately KEEP contextTaskIds intact — an id pointing at a later task
    // is simply inert (the chips, diagram, and save-time normalization all
    // ignore non-earlier ids), so moving a task back restores its wiring
    // instead of silently deleting it.
    patch({ tasks });
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    const res = await post({ action: "crewSave", crew: d });
    setSaving(false);
    if (res.error) {
      setErr(String(res.error));
      return;
    }
    onSaved();
  };

  const agentOptions = d.agents.map((a, i) => ({ value: a.id, label: a.role.trim() || `Agent ${i + 1} (unnamed)` }));
  const subagentOptions = [
    { value: "", label: "None — plain Claude with this persona" },
    ...installedAgents.map((a) => ({ value: a.name, label: `${a.name} (${a.source})` })),
  ];

  return (
    <div className="space-y-5">
      {/* ── 1 · basics ── */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Workflow size={15} className="text-[color:var(--accent)]" />
          <h3 className="text-sm font-semibold">1 · Crew basics</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel hint="A short name for this pipeline — shown on its card and on the live board.">Crew name</FieldLabel>
            <TextInput value={d.name} onChange={(v) => patch({ name: v })} placeholder="e.g. Research & write pipeline" />
          </div>
          <div>
            <FieldLabel hint="Where the agents run — they can read and write files in this folder.">Working folder</FieldLabel>
            <TextInput value={d.cwd} onChange={(v) => patch({ cwd: v })} placeholder="/path/to/project" monospaced />
          </div>
          <div className="md:col-span-2">
            <FieldLabel hint="Optional — what this crew is for. Only shown in the crew list.">Description</FieldLabel>
            <TextInput value={d.description} onChange={(v) => patch({ description: v })} placeholder="What does this crew produce?" />
          </div>
          <div>
            <FieldLabel hint="Sequential runs your tasks one after another, handing outputs forward — you control the exact order below. Hierarchical launches ONE manager agent that delegates the tasks to the specialists itself.">
              How the crew runs
            </FieldLabel>
            <Select
              value={d.process}
              onChange={(v) => patch({ process: v as Draft["process"] })}
              options={[
                { value: "sequential", label: "Sequential pipeline — step by step, outputs feed forward (recommended)" },
                { value: "hierarchical", label: "Hierarchical — a manager agent delegates & coordinates" },
              ]}
            />
          </div>
          <div>
            <FieldLabel hint="Optional safety cap — each step run stops if it exceeds this budget.">Budget cap per step (USD)</FieldLabel>
            <NumberInput value={d.maxBudgetUsd} onChange={(v) => patch({ maxBudgetUsd: v })} placeholder="none" min={0.1} max={100} />
          </div>
        </div>
      </Card>

      {/* ── 2 · agents ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <Bot size={15} className="text-sky-300" />
            <h3 className="text-sm font-semibold">2 · Agents</h3>
            <Badge tone="accent">{d.agents.length}</Badge>
          </div>
          <Button size="sm" onClick={() => patch({ agents: [...d.agents, emptyAgent()] })} icon={<Plus size={13} />}>
            Add agent
          </Button>
        </div>
        <p className="text-xs text-[color:var(--fg-muted)] mb-3 leading-relaxed">
          Each agent is a persona: who they are, what they optimize for. In step 3 you assign tasks to them.
        </p>
        <div className="space-y-3">
          {d.agents.map((a, i) => (
            <div key={a.id} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elev-2)]/40 p-3.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono uppercase tracking-wide text-sky-300">Agent {i + 1}</span>
                {d.agents.length > 1 && (
                  <button onClick={() => removeAgent(a.id)} className="text-[color:var(--fg-faint)] hover:text-[color:var(--danger)] transition" title="Remove agent">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <FieldLabel hint="The job title of this agent — e.g. “Research Analyst”, “Senior Developer”, “QA Tester”. It shapes how the agent behaves.">Role</FieldLabel>
                  <TextInput value={a.role} onChange={(v) => patchAgent(a.id, { role: v })} placeholder="e.g. Research Analyst" />
                </div>
                <div>
                  <FieldLabel hint="One sentence: what this agent tries to achieve in everything it does.">Goal</FieldLabel>
                  <TextInput value={a.goal} onChange={(v) => patchAgent(a.id, { goal: v })} placeholder="e.g. Find accurate, well-sourced information" />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel hint="Optional persona/expertise framing — background, standards, quirks. Improves output quality noticeably.">Backstory</FieldLabel>
                  <Textarea value={a.backstory} onChange={(v) => patchAgent(a.id, { backstory: v })} rows={2} monospaced={false} placeholder="e.g. A meticulous analyst who always cites sources…" />
                </div>
                <div>
                  <FieldLabel hint="The Claude model this agent runs on.">Model</FieldLabel>
                  <Select value={a.model} onChange={(v) => patchAgent(a.id, { model: v })} options={MODELS} />
                </div>
                <div>
                  <FieldLabel hint="What the agent is allowed to do without asking.">Permissions</FieldLabel>
                  <Select value={a.permissionMode} onChange={(v) => patchAgent(a.id, { permissionMode: v as PermMode })} options={PERM_MODES} />
                </div>
                <div>
                  <FieldLabel hint="Optional — hand this role to one of your installed Claude Code subagent definitions (from ~/.claude/agents) instead of plain Claude.">Use installed subagent</FieldLabel>
                  <Select value={a.subagentName || ""} onChange={(v) => patchAgent(a.id, { subagentName: v || undefined })} options={subagentOptions} />
                </div>
                <div>
                  <FieldLabel hint="Optional cap on how many conversation turns this agent's step may take.">Max turns</FieldLabel>
                  <NumberInput value={a.maxTurns} onChange={(v) => patchAgent(a.id, { maxTurns: v })} placeholder="unlimited" min={1} max={200} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── 3 · tasks / sequence ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <ListOrdered size={15} className="text-amber-300" />
            <h3 className="text-sm font-semibold">3 · Tasks & sequence</h3>
            <Badge tone="accent">{d.tasks.length}</Badge>
          </div>
          <Button size="sm" onClick={() => patch({ tasks: [...d.tasks, emptyTask(d.agents[0]?.id || "")] })} icon={<Plus size={13} />}>
            Add task
          </Button>
        </div>
        <p className="text-xs text-[color:var(--fg-muted)] mb-3 leading-relaxed">
          Tasks run top to bottom — use the arrows to reorder. For each task, pick who does it and which earlier
          outputs it receives. Reference run inputs anywhere as <code className="font-mono text-[11px]">{"{input_name}"}</code>.
        </p>
        <div className="space-y-2.5">
          {d.tasks.map((t, i) => {
            const earlier = d.tasks.slice(0, i);
            return (
              <div key={t.id}>
                {i > 0 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowDown size={13} className="text-[color:var(--fg-faint)]" />
                  </div>
                )}
                <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elev-2)]/40 p-3.5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-[4px] bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-mono">
                        {i + 1}
                      </span>
                      <span className="text-[11px] font-mono uppercase tracking-wide text-[color:var(--fg-muted)]">Step {i + 1}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <button onClick={() => moveTask(i, -1)} disabled={i === 0} className="p-1 text-[color:var(--fg-faint)] hover:text-[color:var(--fg)] disabled:opacity-25 transition" title="Move earlier">
                        <ArrowUp size={13} />
                      </button>
                      <button onClick={() => moveTask(i, 1)} disabled={i === d.tasks.length - 1} className="p-1 text-[color:var(--fg-faint)] hover:text-[color:var(--fg)] disabled:opacity-25 transition" title="Move later">
                        <ArrowDown size={13} />
                      </button>
                      {d.tasks.length > 1 && (
                        <button onClick={() => removeTask(t.id)} className="p-1 text-[color:var(--fg-faint)] hover:text-[color:var(--danger)] transition" title="Remove task">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div>
                      <FieldLabel hint="A short label for this step — shown in the pipeline and while running.">Task name</FieldLabel>
                      <TextInput value={t.name} onChange={(v) => patchTask(t.id, { name: v })} placeholder="e.g. Research the topic" />
                    </div>
                    <div>
                      <FieldLabel hint="Which of your agents performs this task.">Done by</FieldLabel>
                      <Select value={t.agentId} onChange={(v) => patchTask(t.id, { agentId: v })} options={agentOptions} />
                    </div>
                    <div className="md:col-span-2">
                      <FieldLabel hint="Tell the agent exactly what to do. You can reference run inputs like {topic}.">What to do</FieldLabel>
                      <Textarea value={t.description} onChange={(v) => patchTask(t.id, { description: v })} rows={3} monospaced={false} placeholder="Describe the task in plain language…" />
                    </div>
                    <div className="md:col-span-2">
                      <FieldLabel hint="Describe what a finished result looks like — format, length, must-haves. This is what gets handed to the next step.">Expected output</FieldLabel>
                      <Textarea value={t.expectedOutput} onChange={(v) => patchTask(t.id, { expectedOutput: v })} rows={2} monospaced={false} placeholder="e.g. A structured brief with 8-12 findings, each with a source" />
                    </div>
                    {d.process === "sequential" && earlier.length > 0 && (
                      <div className="md:col-span-2">
                        <FieldLabel hint="The full output of each checked step is pasted into this task's prompt as context.">Receives output from</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          {earlier.map((et, ei) => {
                            const on = t.contextTaskIds.includes(et.id);
                            return (
                              <button
                                key={et.id}
                                onClick={() =>
                                  patchTask(t.id, {
                                    contextTaskIds: on ? t.contextTaskIds.filter((c) => c !== et.id) : [...t.contextTaskIds, et.id],
                                  })
                                }
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition",
                                  on
                                    ? "border-[color:var(--accent)]/60 bg-[color:var(--accent-soft)] text-[color:var(--fg)]"
                                    : "border-[color:var(--border-strong)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)]/40",
                                )}
                              >
                                {on ? <Check size={12} className="text-[color:var(--accent)]" /> : <Plus size={12} />}
                                Step {ei + 1} · {et.name.trim() || "(unnamed)"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <FlowDiagram process={d.process} tasks={d.tasks} agents={d.agents} />
      </Card>

      {/* ── 4 · run inputs ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <Variable size={15} className="text-violet-300" />
            <h3 className="text-sm font-semibold">4 · Run inputs</h3>
            <Badge tone="accent">{d.inputs.length}</Badge>
          </div>
          <Button size="sm" onClick={() => patch({ inputs: [...d.inputs, { name: "", label: "" }] })} icon={<Plus size={13} />}>
            Add input
          </Button>
        </div>
        <p className="text-xs text-[color:var(--fg-muted)] mb-3 leading-relaxed">
          Inputs are the blanks you fill in each time you run the crew. Reference them in task text as{" "}
          <code className="font-mono text-[11px]">{"{name}"}</code>. No inputs = the crew runs as-is.
        </p>
        <div className="space-y-2">
          {d.inputs.map((v, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-center">
              <TextInput
                value={v.name}
                onChange={(nv) => patch({ inputs: d.inputs.map((x, xi) => (xi === i ? { ...x, name: nv.replace(/[^a-zA-Z0-9_]/g, "_") } : x)) })}
                placeholder="name (e.g. topic)"
                monospaced
              />
              <TextInput
                value={v.label}
                onChange={(nv) => patch({ inputs: d.inputs.map((x, xi) => (xi === i ? { ...x, label: nv } : x)) })}
                placeholder="Label shown in the run form"
              />
              <TextInput
                value={v.placeholder || ""}
                onChange={(nv) => patch({ inputs: d.inputs.map((x, xi) => (xi === i ? { ...x, placeholder: nv } : x)) })}
                placeholder="Placeholder / example value (optional)"
              />
              <button onClick={() => patch({ inputs: d.inputs.filter((_, xi) => xi !== i) })} className="p-1.5 text-[color:var(--fg-faint)] hover:text-[color:var(--danger)] transition" title="Remove input">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {d.inputs.length === 0 && <p className="text-xs text-[color:var(--fg-faint)]">No inputs — this crew asks nothing at run time.</p>}
        </div>
      </Card>

      {err && (
        <div className="flex items-center gap-2 text-xs text-[color:var(--danger)]">
          <AlertTriangle size={13} /> {err}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={save} disabled={saving} icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}>
          {d.id ? "Save changes" : "Save crew"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── run dialog (inline) ────────────────────────────────────────────
function RunCrewForm({ crew, post, onClose }: { crew: Crew; post: Post; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [cwd, setCwd] = useState(crew.cwd);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const launch = async () => {
    setBusy(true);
    setErr(null);
    const res = await post({ action: "crewLaunch", id: crew.id, inputValues: values, cwd });
    setBusy(false);
    if (res.error) {
      setErr(String(res.error));
      return;
    }
    onClose();
  };

  return (
    <div className="mt-3 rounded-lg border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)] p-3.5 space-y-3">
      {crew.inputs.map((v) => (
        <div key={v.name}>
          <FieldLabel hint={`Inserted wherever a task says {${v.name}}.`}>{v.label || v.name}</FieldLabel>
          <Textarea value={values[v.name] || ""} onChange={(nv) => setValues((p) => ({ ...p, [v.name]: nv }))} rows={2} monospaced={false} placeholder={v.placeholder || `Value for {${v.name}}`} />
        </div>
      ))}
      <div>
        <FieldLabel hint="Where this run executes — agents read/write files here.">Working folder</FieldLabel>
        <TextInput value={cwd} onChange={setCwd} monospaced />
      </div>
      {err && (
        <div className="flex items-center gap-2 text-xs text-[color:var(--danger)]">
          <AlertTriangle size={13} /> {err}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={launch} disabled={busy} icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}>
          Launch crew
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── crew definition card ───────────────────────────────────────────
function CrewCard({
  crew,
  onEdit,
  post,
}: {
  crew: Crew;
  onEdit: () => void;
  post: Post;
}) {
  const [runOpen, setRunOpen] = useState(false);
  const byId = useMemo(() => new Map(crew.agents.map((a) => [a.id, a])), [crew.agents]);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Workflow size={14} className="text-[color:var(--accent)] shrink-0" />
            <span className="text-sm font-semibold truncate">{crew.name}</span>
            <Badge tone={crew.process === "hierarchical" ? "warning" : "accent"}>
              {crew.process === "hierarchical" ? "manager-led" : "sequential"}
            </Badge>
            {crew.runCount > 0 && (
              <span className="text-[10px] text-[color:var(--fg-faint)]">
                {crew.runCount} run{crew.runCount === 1 ? "" : "s"}
                {crew.lastRunAt ? ` · last ${relTime(crew.lastRunAt)}` : ""}
              </span>
            )}
          </div>
          {crew.description && <p className="text-xs text-[color:var(--fg-muted)] mt-1 leading-relaxed">{crew.description}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="primary" onClick={() => setRunOpen((v) => !v)} icon={<Play size={13} />}>
            Run
          </Button>
          <button onClick={onEdit} className="p-1.5 text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition" title="Edit crew">
            <PencilLine size={14} />
          </button>
          <button onClick={() => post({ action: "crewDuplicate", id: crew.id })} className="p-1.5 text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition" title="Duplicate crew">
            <Copy size={14} />
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete crew “${crew.name}”? Past runs are kept.`)) post({ action: "crewDelete", id: crew.id });
            }}
            className="p-1.5 text-[color:var(--fg-muted)] hover:text-[color:var(--danger)] transition"
            title="Delete crew"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* pipeline preview: the sequence as role chips */}
      <div className="flex items-center gap-1.5 flex-wrap mt-3">
        {crew.process === "hierarchical" && (
          <>
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300">
              <Crown size={11} /> Manager
            </span>
            <ArrowRight size={12} className="text-[color:var(--fg-faint)]" />
          </>
        )}
        {crew.tasks.map((t, i) => (
          <span key={t.id} className="inline-flex items-center gap-1.5">
            {i > 0 && <ArrowRight size={12} className="text-[color:var(--fg-faint)]" />}
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[color:var(--border-strong)] bg-[color:var(--bg-elev-2)]" title={`${t.name} — ${byId.get(t.agentId)?.role || "?"}`}>
              <Bot size={11} className="text-sky-300" />
              <span className="max-w-[160px] truncate">{t.name || `Step ${i + 1}`}</span>
              <span className="text-[color:var(--fg-faint)]">· {byId.get(t.agentId)?.role || "?"}</span>
            </span>
          </span>
        ))}
      </div>

      <AnimatePresence>
        {runOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <RunCrewForm crew={crew} post={post} onClose={() => setRunOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── crew run card (live + finished pipelines) ──────────────────────
function CrewRunCard({ run, now, post }: { run: CrewRun; now: number; post: Post }) {
  const [open, setOpen] = useState(run.status === "running");
  const [openStep, setOpenStep] = useState<string | null>(null);
  const live = run.status === "running" || run.status === "queued";
  const dur = (run.endedAt ?? now) - run.createdAt;
  const doneSteps = run.steps.filter((s) => s.status === "completed").length;

  return (
    <Card className={cn("p-3.5", live && "border-[color:var(--success)]/35")}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <button onClick={() => setOpen((v) => !v)} className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Workflow size={14} className="text-[color:var(--accent)]" />
        <span className="text-sm font-medium">{run.crewName}</span>
        <CrewStatusPill status={run.status} />
        <span className="text-[11px] text-[color:var(--fg-faint)]">
          {doneSteps}/{run.steps.length} steps
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--fg-faint)]">
          <Clock size={11} /> {fmtDuration(dur)}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--fg-faint)]">
          <Coins size={11} /> {fmtCost(run.totalCostUsd)}
        </span>
        <span className="flex-1" />
        {live ? (
          <Button size="sm" variant="danger" onClick={() => post({ action: "crewRunStop", id: run.id })} icon={<Square size={12} />}>
            Stop
          </Button>
        ) : (
          <button onClick={() => post({ action: "crewRunRemove", id: run.id })} className="p-1.5 text-[color:var(--fg-muted)] hover:text-[color:var(--danger)] transition" title="Remove from list">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* step progress strip — always visible */}
      <div className="flex items-center gap-1.5 flex-wrap mt-2.5 ml-6">
        {run.steps.map((s, i) => (
          <span key={s.taskId + i} className="inline-flex items-center gap-1.5">
            {i > 0 && <ArrowRight size={11} className="text-[color:var(--fg-faint)]" />}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border",
                s.status === "running" && "border-[color:var(--success)]/50 bg-[color:var(--success)]/10",
                s.status === "completed" && "border-[color:var(--border-strong)] bg-[color:var(--bg-elev-2)]",
                s.status === "failed" && "border-[color:var(--danger)]/50 bg-[color:var(--danger)]/10",
                (s.status === "pending" || s.status === "skipped") && "border-[color:var(--border)] opacity-60",
              )}
            >
              <StepStatusIcon status={s.status} />
              <span className="max-w-[180px] truncate">{s.taskName}</span>
            </span>
          </span>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 ml-6 space-y-2">
              {Object.keys(run.inputValues).length > 0 && (
                <div className="text-[11px] text-[color:var(--fg-muted)]">
                  {Object.entries(run.inputValues).map(([k, v]) => (
                    <div key={k} className="truncate">
                      <span className="font-mono text-[color:var(--fg-faint)]">{"{" + k + "}"}</span> = {v}
                    </div>
                  ))}
                </div>
              )}
              {run.steps.map((s, i) => (
                <div key={s.taskId + i} className="rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev-2)]/40">
                  <button onClick={() => setOpenStep(openStep === s.taskId ? null : s.taskId)} className="w-full flex items-center gap-2 px-2.5 py-2 text-left">
                    <StepStatusIcon status={s.status} />
                    <span className="text-xs font-medium">
                      {i + 1}. {s.taskName}
                    </span>
                    <span className="text-[10px] text-[color:var(--fg-faint)]">by {s.agentRole}</span>
                    {s.startedAt && (
                      <span className="text-[10px] text-[color:var(--fg-faint)] tabular-nums">
                        {fmtDuration((s.endedAt ?? now) - s.startedAt)} · {fmtCost(s.costUsd)}
                      </span>
                    )}
                    <span className="flex-1" />
                    {(s.output || s.error) && (openStep === s.taskId ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                  </button>
                  {openStep === s.taskId && (s.output || s.error) && (
                    <div className="px-2.5 pb-2.5">
                      {s.error && <div className="text-[11px] text-[color:var(--danger)] mb-1.5">{s.error}</div>}
                      {s.output && (
                        <pre className="text-[11px] leading-relaxed text-[color:var(--fg-muted)] whitespace-pre-wrap max-h-72 overflow-y-auto rounded-md bg-[color:var(--bg)] border border-[color:var(--border)] p-2.5">
                          {s.output}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {run.error && !run.steps.some((s) => s.error) && (
                <div className="flex items-center gap-2 text-[11px] text-[color:var(--danger)]">
                  <AlertTriangle size={12} /> {run.error}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── the tab ────────────────────────────────────────────────────────
export function CrewsView({
  crews,
  crewRuns,
  installedAgents,
  defaultCwd,
  now,
  post,
}: {
  crews: Crew[];
  crewRuns: CrewRun[];
  installedAgents: AgentDef[];
  defaultCwd: string;
  now: number;
  post: Post;
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const finishedRuns = crewRuns.filter((r) => r.status !== "running" && r.status !== "queued");

  if (editing) {
    return (
      <CrewEditor
        initial={editing}
        installedAgents={installedAgents}
        onCancel={() => setEditing(null)}
        onSaved={() => setEditing(null)}
        post={post}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* crew definitions */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Workflow size={14} className="text-[color:var(--accent)]" />
            <h3 className="text-sm font-medium">Your crews</h3>
            {crews.length > 0 && <Badge tone="accent">{crews.length}</Badge>}
          </div>
          {crews.length > 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(exampleDraft(defaultCwd))}>
                Start from example
              </Button>
              <Button size="sm" variant="primary" onClick={() => setEditing(emptyDraft(defaultCwd))} icon={<Plus size={13} />}>
                New crew
              </Button>
            </div>
          )}
        </div>

        {crews.length === 0 ? (
          <Card className="p-10 text-center">
            <Workflow size={28} className="mx-auto text-[color:var(--fg-faint)] mb-3" />
            <h3 className="text-sm font-medium mb-1.5">Build your first crew</h3>
            <p className="text-xs text-[color:var(--fg-muted)] max-w-md mx-auto leading-relaxed mb-4">
              A crew is a reusable multi-agent pipeline — like CrewAI, but with zero code. Define your agents
              (role, goal, backstory), give them tasks in sequence, choose which task&apos;s output feeds which,
              then run it with one click whenever you need it.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="primary" onClick={() => setEditing(emptyDraft(defaultCwd))} icon={<Plus size={14} />}>
                New crew
              </Button>
              <Button onClick={() => setEditing(exampleDraft(defaultCwd))}>Start from example</Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {crews.map((c) => (
              <CrewCard key={c.id} crew={c} onEdit={() => setEditing(JSON.parse(JSON.stringify(c)) as Draft)} post={post} />
            ))}
          </div>
        )}
      </div>

      {/* crew runs */}
      {crewRuns.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Play size={14} className="text-[color:var(--success)]" />
              <h3 className="text-sm font-medium">Crew runs</h3>
              <Badge tone="default">{crewRuns.length}</Badge>
            </div>
            {finishedRuns.length > 0 && (
              <button onClick={() => post({ action: "crewRunsClear" })} className="text-[11px] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1 transition">
                <Trash2 size={11} /> Clear finished
              </button>
            )}
          </div>
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {crewRuns.map((r) => (
                <motion.div key={r.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <CrewRunCard run={r} now={now} post={post} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
