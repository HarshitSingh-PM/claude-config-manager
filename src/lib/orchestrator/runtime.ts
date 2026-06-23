// The orchestrator runtime: a single long-lived object (pinned to globalThis so
// it survives module re-evaluation / dev HMR) that spawns headless `claude -p`
// processes, parses their stream-json output into a live activity tree, and
// notifies SSE subscribers on every change.
//
// Why the CLI and not the Agent SDK: the user already has an authenticated
// `claude` binary, and shelling out adds ZERO dependencies to a bundle we work
// hard to keep small. Each launched agent is one child process (a board root);
// any sub-agents it delegates to (Task tool) surface in that same stream via
// `parent_tool_use_id`, which is exactly the hierarchy we render.

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  type Run,
  type ActivityNode,
  type HistoryEntry,
  type AggregateMetrics,
  type LaunchOptions,
  type LiveSnapshot,
  type NodeKind,
  type Campaign,
  type PermMode,
} from "./types";

const HISTORY_PATH = path.join(os.homedir(), ".claude-config-ui", "orchestrator-history.json");
const CAMPAIGNS_PATH = path.join(os.homedir(), ".claude-config-ui", "orchestrator-campaigns.json");
const HISTORY_CAP = 200;
const MAX_NODES_PER_RUN = 2500; // runaway guard
const DETAIL_MAX = 160;

// ─── claude binary resolution ───────────────────────────────────────
// Under Electron's utilityProcess the PATH can be minimal (/usr/bin:/bin…),
// so we both (a) try to resolve an absolute path and (b) always spawn with an
// augmented PATH covering the common install locations.
const EXTRA_PATHS = [
  path.join(os.homedir(), ".claude", "local"),
  path.join(os.homedir(), ".local", "bin"),
  path.join(os.homedir(), ".bun", "bin"),
  path.join(os.homedir(), ".npm-global", "bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
];

function augmentedPath(): string {
  const existing = (process.env.PATH || "").split(path.delimiter);
  const merged = [...EXTRA_PATHS, ...existing].filter((p, i, a) => p && a.indexOf(p) === i);
  return merged.join(path.delimiter);
}

export function resolveClaudeBin(): string | null {
  if (process.env.CLAUDE_BIN && fs.existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  const names = ["claude"];
  for (const dir of EXTRA_PATHS) {
    for (const n of names) {
      const p = path.join(dir, n);
      try {
        if (fs.existsSync(p)) return p;
      } catch {
        /* ignore */
      }
    }
  }
  return null; // fall back to PATH lookup of "claude" at spawn time
}

export function claudeAvailable(): boolean {
  return resolveClaudeBin() !== null;
}

// ─── helpers ────────────────────────────────────────────────────────
function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function truncate(s: string, n = DETAIL_MAX): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1) + "…" : one;
}

// Pull a short, human label + detail out of a tool_use block.
function summarizeTool(name: string, input: Record<string, unknown>): { label: string; detail?: string } {
  const s = (k: string) => (typeof input?.[k] === "string" ? (input[k] as string) : undefined);
  switch (name) {
    case "Bash":
      return { label: "Bash", detail: truncate(s("command") || "") };
    case "Read":
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return { label: name, detail: s("file_path") || s("notebook_path") };
    case "Grep":
      return { label: "Grep", detail: s("pattern") };
    case "Glob":
      return { label: "Glob", detail: s("pattern") };
    case "WebFetch":
      return { label: "WebFetch", detail: s("url") };
    case "WebSearch":
      return { label: "WebSearch", detail: s("query") };
    case "Skill":
      return { label: s("command") || s("skill") || "Skill", detail: s("args") };
    case "TodoWrite":
      return { label: "Plan", detail: "updated task list" };
    default:
      if (name.startsWith("mcp__")) {
        const parts = name.split("__");
        return { label: name, detail: parts.length >= 3 ? `${parts[1]} · ${parts.slice(2).join("__")}` : undefined };
      }
      return { label: name, detail: truncate(JSON.stringify(input ?? {})) };
  }
}

function classify(name: string): NodeKind {
  if (name === "Task" || name === "Agent") return "subagent";
  if (name === "Skill") return "skill";
  if (name === "TodoWrite") return "todo";
  if (name.startsWith("mcp__")) return "mcp";
  return "tool";
}

function emptyMetrics() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
    numTurns: 0,
    toolCounts: {} as Record<string, number>,
    skillCounts: {} as Record<string, number>,
    subagentCount: 0,
  };
}

// ─── the orchestrator ───────────────────────────────────────────────
class Orchestrator {
  runs = new Map<string, Run>();
  private procs = new Map<string, ChildProcess>();
  private buffers = new Map<string, string>();
  private nodeIndex = new Map<string, Map<string, ActivityNode>>(); // runId → (toolUseId → node)
  private nodeCount = new Map<string, number>();
  // The CLI emits one assistant line per content block, all sharing a message
  // id and repeating that message's usage — so we tally usage once per id.
  private usageSeen = new Map<string, Set<string>>();
  private listeners = new Set<() => void>();
  history: HistoryEntry[] = [];
  campaigns: Campaign[] = [];
  private emitTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.loadHistory();
    this.loadCampaigns();
  }

  // ── subscriptions (SSE) ──
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      for (const fn of this.listeners) {
        try {
          fn();
        } catch {
          /* ignore listener errors */
        }
      }
    }, 180);
  }

  // ── history persistence ──
  private loadHistory() {
    try {
      this.history = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
      if (!Array.isArray(this.history)) this.history = [];
    } catch {
      this.history = [];
    }
  }
  private saveHistory() {
    try {
      fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
      fs.writeFileSync(HISTORY_PATH, JSON.stringify(this.history.slice(-HISTORY_CAP), null, 2));
    } catch {
      /* best effort */
    }
  }
  clearHistory() {
    this.history = [];
    this.saveHistory();
    this.emit();
  }

  // ── campaigns (multi-week, resumable work) ──
  private loadCampaigns() {
    try {
      this.campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_PATH, "utf8"));
      if (!Array.isArray(this.campaigns)) this.campaigns = [];
    } catch {
      this.campaigns = [];
    }
  }
  private saveCampaigns() {
    try {
      fs.mkdirSync(path.dirname(CAMPAIGNS_PATH), { recursive: true });
      fs.writeFileSync(CAMPAIGNS_PATH, JSON.stringify(this.campaigns, null, 2));
    } catch {
      /* best effort */
    }
  }
  createCampaign(data: {
    name: string;
    objective: string;
    plan?: string;
    cwd: string;
    agentName?: string;
    model?: string;
    permissionMode?: PermMode;
    maxTurns?: number;
  }): Campaign {
    const c: Campaign = {
      id: newId("camp"),
      name: data.name,
      objective: data.objective,
      plan: data.plan || "",
      cwd: data.cwd,
      agentName: data.agentName || "general",
      model: data.model || "sonnet",
      permissionMode: data.permissionMode || "acceptEdits",
      maxTurns: data.maxTurns,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalCostUsd: 0,
      sessions: [],
    };
    this.campaigns.unshift(c);
    this.saveCampaigns();
    this.emit();
    return c;
  }
  updateCampaign(id: string, patch: Record<string, unknown>): Campaign | null {
    const c = this.campaigns.find((x) => x.id === id);
    if (!c) return null;
    // only allow safe fields to be patched
    const allowed = ["name", "objective", "plan", "cwd", "agentName", "model", "permissionMode", "maxTurns", "status"];
    const rec = c as unknown as Record<string, unknown>;
    for (const k of allowed) if (k in patch) rec[k] = patch[k];
    c.updatedAt = Date.now();
    this.saveCampaigns();
    this.emit();
    return c;
  }
  deleteCampaign(id: string): boolean {
    const i = this.campaigns.findIndex((x) => x.id === id);
    if (i < 0) return false;
    this.campaigns.splice(i, 1);
    this.saveCampaigns();
    this.emit();
    return true;
  }
  // Launch the next work session for a campaign. We seed a FRESH agent with the
  // persisted objective + plan + recent progress (durable across weeks / app
  // restarts) rather than relying on a possibly-compacted session transcript.
  runCampaignSession(id: string, instruction?: string): Run | null {
    const c = this.campaigns.find((x) => x.id === id);
    if (!c) return null;
    const recent = c.sessions
      .slice(-3)
      .map((s, i) => `${i + 1}. ${(s.summary || s.status || "").toString().slice(0, 280)}`)
      .join("\n");
    const prompt = [
      `You are continuing a long-running campaign called "${c.name}".`,
      `Objective:\n${c.objective}`,
      `Current plan / checklist:\n${c.plan || "(no plan yet — create one as you go)"}`,
      recent ? `Recent progress from prior sessions:\n${recent}` : "",
      instruction
        ? `Focus for this session:\n${instruction}`
        : `Work on the next unchecked item(s) in the plan for this session — a meaningful chunk, not the whole thing.`,
      `When you finish this session: (1) write a short progress summary of what you completed and what is next, then (2) output the FULL updated plan/checklist between the markers ===PLAN START=== and ===PLAN END=== — check off completed items, keep pending ones, and add any new follow-ups. Always include both markers.`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const run = this.launch({
      agentName: c.agentName,
      agentLabel: `Campaign · ${c.name}`,
      model: c.model,
      task: prompt,
      cwd: c.cwd,
      permissionMode: c.permissionMode,
      maxTurns: c.maxTurns,
      campaignId: c.id,
    });
    c.sessions.push({ runId: run.id, startedAt: Date.now(), status: run.status, costUsd: 0, instruction });
    c.status = "active";
    c.updatedAt = Date.now();
    this.saveCampaigns();
    this.emit();
    return run;
  }
  private onCampaignRunFinished(run: Run) {
    const c = this.campaigns.find((x) => x.id === run.campaignId);
    if (!c) return;
    const sess = c.sessions.find((s) => s.runId === run.id);
    if (!sess) return;
    sess.endedAt = run.endedAt;
    sess.status = run.status;
    sess.sessionId = run.sessionId;
    sess.costUsd = run.metrics.costUsd;
    if (run.sessionId) c.lastSessionId = run.sessionId;
    const text = run.resultText || "";
    const m = text.match(/===PLAN START===\s*([\s\S]*?)\s*===PLAN END===/);
    if (m && m[1].trim()) c.plan = m[1].trim();
    const summary = (m ? text.replace(m[0], "") : text).replace(/\s+/g, " ").trim();
    sess.summary = summary.slice(0, 400) || run.error || "(no summary returned)";
    c.totalCostUsd = (c.totalCostUsd || 0) + run.metrics.costUsd;
    c.updatedAt = Date.now();
    this.saveCampaigns();
  }

  // ── launch ──
  launch(opts: LaunchOptions): Run {
    const id = newId("run");
    const run: Run = {
      id,
      agentName: opts.agentName,
      agentLabel: opts.agentLabel || opts.agentName,
      model: opts.model,
      task: opts.task,
      cwd: opts.cwd,
      permissionMode: opts.permissionMode,
      status: "queued",
      createdAt: Date.now(),
      tree: [],
      metrics: emptyMetrics(),
      maxTurns: opts.maxTurns,
      maxBudgetUsd: opts.maxBudgetUsd,
      resumedFrom: opts.resumeSessionId,
      teamId: opts.teamId,
      teamName: opts.teamName,
      teamMode: opts.teamMode,
      role: opts.role,
      campaignId: opts.campaignId,
    };
    this.runs.set(id, run);
    this.nodeIndex.set(id, new Map());
    this.nodeCount.set(id, 0);
    this.usageSeen.set(id, new Set());

    // When a specific subagent is chosen for a plain single launch, instruct the
    // top-level agent to delegate to it — that produces a Task node and shows the
    // hierarchy. For resumes / teams / campaigns the prompt is already fully
    // composed by the caller, so use it verbatim.
    const useDelegationPrefix =
      opts.agentName !== "general" && !opts.resumeSessionId && !opts.teamId && !opts.campaignId;
    const prompt = useDelegationPrefix
      ? `Use the "${opts.agentName}" subagent to complete the following task. Report its result.\n\n${opts.task}`
      : opts.task;

    const args = [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--model",
      opts.model,
      "--permission-mode",
      opts.permissionMode,
    ];
    if (opts.resumeSessionId) args.push("--resume", opts.resumeSessionId);
    if (opts.maxTurns && opts.maxTurns > 0) args.push("--max-turns", String(opts.maxTurns));
    if (opts.maxBudgetUsd && opts.maxBudgetUsd > 0) args.push("--max-budget-usd", String(opts.maxBudgetUsd));

    const bin = resolveClaudeBin() || "claude";
    let child: ChildProcess;
    try {
      child = spawn(bin, args, {
        cwd: opts.cwd,
        env: { ...process.env, PATH: augmentedPath() },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      run.status = "failed";
      run.error = `Could not start claude: ${String(err)}`;
      run.endedAt = Date.now();
      this.emit();
      return run;
    }

    this.procs.set(id, child);
    this.buffers.set(id, "");
    run.status = "running";
    run.startedAt = Date.now();

    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => this.onStdout(id, chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on("error", (err) => {
      const r = this.runs.get(id);
      if (!r) return;
      const enoent = (err as NodeJS.ErrnoException).code === "ENOENT";
      r.error = enoent
        ? "`claude` binary not found. Install Claude Code, or set CLAUDE_BIN to its path."
        : String(err);
      this.finalize(id, "failed");
    });
    child.on("exit", (code, signal) => {
      const r = this.runs.get(id);
      if (!r) return;
      r.exitCode = code;
      if (r.status === "running" || r.status === "queued") {
        if (signal === "SIGTERM" || signal === "SIGKILL") {
          this.finalize(id, "stopped");
        } else if (code === 0) {
          this.finalize(id, "completed");
        } else {
          if (!r.error) r.error = stderr ? truncate(stderr, 600) : `claude exited with code ${code}`;
          this.finalize(id, "failed");
        }
      }
    });

    this.emit();
    return run;
  }

  stop(id: string): boolean {
    const child = this.procs.get(id);
    const run = this.runs.get(id);
    if (run && (run.status === "running" || run.status === "queued")) {
      if (child) {
        try {
          child.kill("SIGTERM");
          // hard kill if it doesn't go quietly
          setTimeout(() => {
            if (this.procs.has(id)) {
              try {
                child.kill("SIGKILL");
              } catch {
                /* ignore */
              }
            }
          }, 2500);
        } catch {
          /* ignore */
        }
      } else {
        this.finalize(id, "stopped");
      }
      return true;
    }
    return false;
  }

  // Remove finished runs from the live board (history is unaffected).
  clearFinished(): number {
    let n = 0;
    for (const [id, r] of this.runs) {
      if (r.status !== "running" && r.status !== "queued") {
        this.runs.delete(id);
        this.nodeIndex.delete(id);
        this.nodeCount.delete(id);
        this.buffers.delete(id);
        this.usageSeen.delete(id);
        n++;
      }
    }
    if (n) this.emit();
    return n;
  }
  removeRun(id: string): boolean {
    const r = this.runs.get(id);
    if (!r) return false;
    if (r.status === "running" || r.status === "queued") this.stop(id);
    this.runs.delete(id);
    this.nodeIndex.delete(id);
    this.nodeCount.delete(id);
    this.buffers.delete(id);
    this.usageSeen.delete(id);
    this.emit();
    return true;
  }

  // ── stream parsing ──
  private onStdout(id: string, text: string) {
    let buf = (this.buffers.get(id) || "") + text;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) this.handleLine(id, line);
    }
    this.buffers.set(id, buf);
    this.emit();
  }

  private ownerChildren(run: Run, parentToolUseId: string | null | undefined): ActivityNode[] {
    if (!parentToolUseId) return run.tree;
    const node = this.nodeIndex.get(run.id)?.get(parentToolUseId);
    return node ? node.children : run.tree;
  }

  private addNode(run: Run, parentToolUseId: string | null | undefined, node: ActivityNode) {
    const count = this.nodeCount.get(run.id) || 0;
    if (count >= MAX_NODES_PER_RUN) return;
    this.nodeCount.set(run.id, count + 1);
    this.ownerChildren(run, parentToolUseId).push(node);
    this.nodeIndex.get(run.id)?.set(node.id, node);
  }

  private handleLine(id: string, line: string) {
    const run = this.runs.get(id);
    if (!run) return;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch {
      return; // non-JSON verbose noise
    }
    const type = obj.type as string;
    const parent = (obj.parent_tool_use_id as string | null) ?? null;

    if (type === "system") {
      if (obj.subtype === "init" && typeof obj.session_id === "string") run.sessionId = obj.session_id;
      return;
    }

    if (type === "assistant") {
      const msg = obj.message as { id?: string; content?: unknown[]; usage?: Record<string, number> } | undefined;
      const seen = this.usageSeen.get(id);
      const mid = msg?.id;
      // count each message's usage once (blocks of one message repeat it)
      if (msg?.usage && (!mid || !seen || !seen.has(mid))) {
        if (mid && seen) seen.add(mid);
        run.metrics.inputTokens += msg.usage.input_tokens || 0;
        run.metrics.outputTokens += msg.usage.output_tokens || 0;
        run.metrics.cacheReadTokens += msg.usage.cache_read_input_tokens || 0;
        run.metrics.cacheCreationTokens += msg.usage.cache_creation_input_tokens || 0;
      }
      const blocks = Array.isArray(msg?.content) ? msg!.content : [];
      let sawTool = false;
      let sawText = false;
      let sawThinking = false;
      for (const b of blocks as Record<string, unknown>[]) {
        if (b.type === "thinking") sawThinking = true;
        if (b.type === "text" && typeof b.text === "string" && (b.text as string).trim()) sawText = true;
        if (b.type === "tool_use") {
          sawTool = true;
          const name = String(b.name || "");
          const input = (b.input as Record<string, unknown>) || {};
          const kind = classify(name);
          const { label, detail } = summarizeTool(name, input);
          const node: ActivityNode = {
            id: String(b.id || newId("node")),
            kind,
            label: kind === "subagent" ? String(input.subagent_type || label || "subagent") : label,
            detail: kind === "subagent" ? truncate(String(input.description || input.prompt || "")) : detail,
            status: "running",
            startedAt: Date.now(),
            subagentType: kind === "subagent" ? String(input.subagent_type || "") : undefined,
            children: [],
          };
          this.addNode(run, parent, node);
          // tally
          if (kind === "subagent") run.metrics.subagentCount++;
          else if (kind === "skill") run.metrics.skillCounts[node.label] = (run.metrics.skillCounts[node.label] || 0) + 1;
          else run.metrics.toolCounts[name] = (run.metrics.toolCounts[name] || 0) + 1;
          run.currentActivity =
            kind === "subagent"
              ? `Delegating → ${node.label}`
              : kind === "skill"
                ? `Skill: ${node.label}`
                : `${label}${detail ? " · " + truncate(detail, 60) : ""}`;
        }
      }
      if (!sawTool && run.status === "running") {
        if (sawText) run.currentActivity = "Writing response…";
        else if (sawThinking) run.currentActivity = "Thinking…";
      }
      return;
    }

    if (type === "user") {
      // tool results — mark the matching node done / error
      const msg = obj.message as { content?: unknown[] } | undefined;
      const blocks = Array.isArray(msg?.content) ? msg!.content : [];
      for (const b of blocks as Record<string, unknown>[]) {
        if (b.type === "tool_result") {
          const tid = String(b.tool_use_id || "");
          const node = this.nodeIndex.get(id)?.get(tid);
          if (node && node.status === "running") {
            node.status = b.is_error ? "error" : "done";
            node.endedAt = Date.now();
          }
        }
      }
      return;
    }

    if (type === "result") {
      if (typeof obj.total_cost_usd === "number") run.metrics.costUsd = obj.total_cost_usd;
      if (typeof obj.num_turns === "number") run.metrics.numTurns = obj.num_turns;
      const usage = obj.usage as Record<string, number> | undefined;
      if (usage) {
        // result usage is authoritative for the final totals
        run.metrics.inputTokens = usage.input_tokens || run.metrics.inputTokens;
        run.metrics.outputTokens = usage.output_tokens || run.metrics.outputTokens;
      }
      if (typeof obj.result === "string") run.resultText = obj.result;
      const subtype = String(obj.subtype || "");
      // set the error reason BEFORE finalize — finalize() → onCampaignRunFinished()
      // reads run.error to build the session summary, so it must be populated first.
      if (subtype && subtype !== "success" && !run.error) run.error = `Run ended: ${subtype}`;
      this.finalize(id, subtype === "success" ? "completed" : "failed");
      return;
    }
  }

  private finalize(id: string, status: Run["status"]) {
    const run = this.runs.get(id);
    if (!run) return;
    // close any still-running nodes
    const closeAll = (nodes: ActivityNode[]) => {
      for (const n of nodes) {
        if (n.status === "running") {
          n.status = status === "completed" ? "done" : "error";
          n.endedAt = Date.now();
        }
        closeAll(n.children);
      }
    };
    closeAll(run.tree);
    run.status = status;
    run.endedAt = run.endedAt || Date.now();
    run.currentActivity = undefined;
    this.procs.delete(id);
    this.buffers.delete(id);
    this.usageSeen.delete(id);

    // record to history (one entry per finished run)
    if (!this.history.find((h) => h.id === id)) {
      this.history.push({
        id,
        agentName: run.agentName,
        agentLabel: run.agentLabel,
        model: run.model,
        task: truncate(run.task, 200),
        status,
        createdAt: run.createdAt,
        endedAt: run.endedAt,
        durationMs: run.endedAt - (run.startedAt || run.createdAt),
        costUsd: run.metrics.costUsd,
        inputTokens: run.metrics.inputTokens,
        outputTokens: run.metrics.outputTokens,
        numTurns: run.metrics.numTurns,
        subagentCount: run.metrics.subagentCount,
        toolCounts: run.metrics.toolCounts,
        skillCounts: run.metrics.skillCounts,
      });
      this.saveHistory();
    }
    if (run.campaignId) this.onCampaignRunFinished(run);
    this.emit();
  }

  // ── snapshots ──
  private aggregate(): AggregateMetrics {
    const live = [...this.runs.values()];
    const active = live.filter((r) => r.status === "running").length;
    const queued = live.filter((r) => r.status === "queued").length;
    const completed = this.history.filter((h) => h.status === "completed").length;
    const failed = this.history.filter((h) => h.status === "failed").length;
    const totalRuns = this.history.length;

    const byAgent = new Map<string, { name: string; label: string; runs: number; costUsd: number; tokens: number }>();
    const byModel = new Map<string, { model: string; runs: number; costUsd: number; tokens: number }>();
    const tools = new Map<string, number>();
    const skills = new Map<string, number>();
    let totalCostUsd = 0;
    let totalTokens = 0;

    for (const h of this.history) {
      totalCostUsd += h.costUsd || 0;
      const tk = (h.inputTokens || 0) + (h.outputTokens || 0);
      totalTokens += tk;
      const a = byAgent.get(h.agentName) || { name: h.agentName, label: h.agentLabel, runs: 0, costUsd: 0, tokens: 0 };
      a.runs++;
      a.costUsd += h.costUsd || 0;
      a.tokens += tk;
      byAgent.set(h.agentName, a);
      const m = byModel.get(h.model) || { model: h.model, runs: 0, costUsd: 0, tokens: 0 };
      m.runs++;
      m.costUsd += h.costUsd || 0;
      m.tokens += tk;
      byModel.set(h.model, m);
      for (const [t, c] of Object.entries(h.toolCounts || {})) tools.set(t, (tools.get(t) || 0) + c);
      for (const [s, c] of Object.entries(h.skillCounts || {})) skills.set(s, (skills.get(s) || 0) + c);
    }
    // add ONLY in-flight runs to the headline totals — finished runs are
    // already counted in history (and may still sit on the board), so adding
    // them here would double-count.
    for (const r of live) {
      if (r.status === "running" || r.status === "queued") {
        totalCostUsd += r.metrics.costUsd || 0;
        totalTokens += r.metrics.inputTokens + r.metrics.outputTokens;
      }
    }

    const top = (m: Map<string, number>) =>
      [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12);

    return {
      active,
      queued,
      completed,
      failed,
      totalRuns,
      successRate: totalRuns ? completed / totalRuns : 0,
      totalCostUsd,
      totalTokens,
      byAgent: [...byAgent.values()].sort((a, b) => b.runs - a.runs),
      byModel: [...byModel.values()].sort((a, b) => b.runs - a.runs),
      topTools: top(tools),
      topSkills: top(skills),
    };
  }

  snapshot(): LiveSnapshot {
    const runs = [...this.runs.values()].sort((a, b) => b.createdAt - a.createdAt);
    return {
      runs,
      history: this.history.slice(-HISTORY_CAP).reverse(),
      metrics: this.aggregate(),
      campaigns: [...this.campaigns].sort((a, b) => b.updatedAt - a.updatedAt),
    };
  }
}

// Pin to globalThis so route re-evaluation / HMR doesn't create duplicates and
// orphan running child processes.
const g = globalThis as unknown as { __ccmOrchestrator?: Orchestrator };
export function getOrchestrator(): Orchestrator {
  if (!g.__ccmOrchestrator) g.__ccmOrchestrator = new Orchestrator();
  return g.__ccmOrchestrator;
}
