// Shared types for the Agent Orchestrator. Everything here is JSON-serializable
// so a full Run (with its activity tree) can be streamed to the browser as-is.

export type RunStatus = "queued" | "running" | "completed" | "failed" | "stopped";

// The headless permission modes we expose. These map 1:1 to `claude -p
// --permission-mode <mode>`. We deliberately omit "default" (it prompts
// interactively, which a headless run can't answer → it would hang).
export type PermMode = "plan" | "acceptEdits" | "auto" | "bypassPermissions";

export type NodeKind = "subagent" | "tool" | "skill" | "mcp" | "todo" | "error";
export type NodeStatus = "running" | "done" | "error";

// One node in an agent's activity tree. A node is either a delegated sub-agent
// (which has its own children), or a single tool / skill / MCP call.
export interface ActivityNode {
  id: string; // the tool_use id from the stream (stable, used to attach results)
  kind: NodeKind;
  label: string; // "Bash", "deep-research", subagent type, etc.
  detail?: string; // command line, file path, skill args — short, truncated
  status: NodeStatus;
  startedAt: number;
  endedAt?: number;
  subagentType?: string; // for kind === "subagent"
  children: ActivityNode[];
}

export interface RunMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  numTurns: number;
  toolCounts: Record<string, number>;
  skillCounts: Record<string, number>;
  subagentCount: number;
}

export type TeamMode = "orchestrated" | "parallel";

export interface Run {
  id: string; // our orchestrator run id
  sessionId?: string; // claude session id (captured from the init event) → resumable
  agentName: string; // "general" or a subagent definition name
  agentLabel: string;
  model: string;
  task: string;
  cwd: string;
  permissionMode: PermMode;
  status: RunStatus;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  currentActivity?: string; // human label of what's happening right now
  tree: ActivityNode[]; // the main agent's top-level activities; sub-agents nest inside
  metrics: RunMetrics;
  resultText?: string; // the final assistant answer / result summary
  error?: string;
  exitCode?: number | null;
  maxTurns?: number;
  maxBudgetUsd?: number;
  resumedFrom?: string; // sessionId this run continued from (Continue / --resume)
  teamId?: string;
  teamName?: string;
  teamMode?: TeamMode;
  role?: string;
  campaignId?: string;
}

// A compact, persisted record of a finished run — feeds the measurement view
// and accumulates across app restarts.
export interface HistoryEntry {
  id: string;
  agentName: string;
  agentLabel: string;
  model: string;
  task: string; // truncated
  status: RunStatus;
  createdAt: number;
  endedAt: number;
  durationMs: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  numTurns: number;
  subagentCount: number;
  toolCounts: Record<string, number>;
  skillCounts: Record<string, number>;
}

export interface AggregateMetrics {
  active: number;
  queued: number;
  completed: number;
  failed: number;
  totalRuns: number; // finished runs in history
  successRate: number; // 0..1 over finished runs
  totalCostUsd: number;
  totalTokens: number;
  byAgent: { name: string; label: string; runs: number; costUsd: number; tokens: number }[];
  byModel: { model: string; runs: number; costUsd: number; tokens: number }[];
  topTools: { name: string; count: number }[];
  topSkills: { name: string; count: number }[];
}

export interface LaunchOptions {
  agentName: string;
  agentLabel?: string;
  model: string;
  task: string;
  cwd: string;
  permissionMode: PermMode;
  maxTurns?: number;
  maxBudgetUsd?: number;
  resumeSessionId?: string;
  teamId?: string;
  teamName?: string;
  teamMode?: TeamMode;
  role?: string;
  campaignId?: string;
}

// ─── Teams ──────────────────────────────────────────────────────────
export interface TeamRole {
  role: string;
  agentName: string; // "general" or a subagent definition name
  responsibility: string;
}

export interface TeamTemplate {
  id: string;
  name: string;
  description: string;
  mode: TeamMode;
  roles: TeamRole[];
}

// ─── Campaigns (multi-week, resumable work) ─────────────────────────
export interface CampaignSession {
  runId: string;
  sessionId?: string;
  startedAt: number;
  endedAt?: number;
  status: RunStatus;
  summary?: string;
  costUsd: number;
  instruction?: string;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  plan: string; // markdown checklist — the durable source of truth, updated each session
  cwd: string;
  agentName: string;
  model: string;
  permissionMode: PermMode;
  maxTurns?: number;
  status: "active" | "paused" | "done";
  createdAt: number;
  updatedAt: number;
  lastSessionId?: string;
  totalCostUsd: number;
  sessions: CampaignSession[];
}

// The live snapshot pushed over SSE and returned by the GET route.
export interface LiveSnapshot {
  runs: Run[];
  history: HistoryEntry[];
  metrics: AggregateMetrics;
  campaigns: Campaign[];
}

export interface AgentDef {
  name: string;
  label: string;
  description: string;
  model?: string;
  source: "user" | "project" | "builtin";
  tools?: string[];
  path?: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  source: "user" | "project" | "plugin" | "builtin";
}

// A claude session running on this machine that the orchestrator did NOT launch
// (e.g. a terminal session or another Claude Code window) — observed read-only by
// tailing its transcript in ~/.claude/projects.
export interface LiveSession {
  sessionId: string;
  title: string;
  cwd: string;
  project: string;
  model?: string;
  lastActivity: string;
  lastActivityKind: "tool" | "skill" | "subagent" | "mcp" | "text" | "idle";
  lastActiveAt: number;
  sizeBytes: number;
  subagentActive: boolean;
}

export interface LiveSessionsResponse {
  sessions: LiveSession[];
  processCount: number | null;
  scannedAt: number;
}
