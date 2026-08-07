// Shared types for the Agent Orchestrator. Everything here is JSON-serializable
// so a full Run (with its activity tree) can be streamed to the browser as-is.

export type RunStatus = "queued" | "running" | "completed" | "failed" | "stopped";

// The headless permission modes we expose. These map 1:1 to `claude -p
// --permission-mode <mode>`. We deliberately omit "default" (it prompts
// interactively, which a headless run can't answer → it would hang).
export type PermMode = "plan" | "acceptEdits" | "auto" | "dontAsk" | "bypassPermissions";

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

// ─── Crews (CrewAI-style pipelines, fully UI-authored) ──────────────
// A Crew is a saved, reusable pipeline: a set of agents (role/goal/backstory
// personas) plus an ordered list of tasks. Each task is performed by one agent
// and can consume the outputs of earlier tasks. Everything is authored in the
// UI — no code — and a crew can be run ("deployed") any number of times with
// different input values.

export type CrewProcess = "sequential" | "hierarchical";

export interface CrewAgent {
  id: string;
  role: string; // "Senior Research Analyst"
  goal: string; // what this agent optimizes for
  backstory: string; // persona/expertise framing
  model: string; // sonnet | opus | haiku | full model id
  subagentName?: string; // optionally bind to an installed subagent definition
  permissionMode: PermMode;
  maxTurns?: number;
}

export interface CrewTask {
  id: string;
  name: string; // short label shown in the pipeline
  description: string; // what to do — may reference {input} variables
  expectedOutput: string; // what "done" looks like
  agentId: string; // which CrewAgent performs it
  contextTaskIds: string[]; // earlier tasks whose outputs feed into this one
}

// A runtime input the run dialog asks the user for; referenced in task
// descriptions as {name}.
export interface CrewInputVar {
  name: string;
  label: string;
  placeholder?: string;
}

export interface Crew {
  id: string;
  name: string;
  description: string;
  process: CrewProcess;
  agents: CrewAgent[];
  tasks: CrewTask[]; // array order IS the execution sequence
  inputs: CrewInputVar[];
  cwd: string;
  maxBudgetUsd?: number;
  createdAt: number;
  updatedAt: number;
  runCount: number;
  lastRunAt?: number;
}

export type CrewStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface CrewStepRun {
  taskId: string;
  taskName: string;
  agentId: string;
  agentRole: string;
  runId?: string; // the underlying orchestrator Run id (links to the board)
  status: CrewStepStatus;
  startedAt?: number;
  endedAt?: number;
  output?: string; // the step's final result text, fed to downstream steps
  error?: string;
  costUsd: number;
}

export interface CrewRun {
  id: string;
  crewId: string;
  crewName: string;
  process: CrewProcess;
  status: RunStatus;
  inputValues: Record<string, string>;
  cwd: string;
  steps: CrewStepRun[];
  createdAt: number;
  endedAt?: number;
  totalCostUsd: number;
  finalOutput?: string;
  error?: string;
}

// The live snapshot pushed over SSE and returned by the GET route.
export interface LiveSnapshot {
  runs: Run[];
  history: HistoryEntry[];
  metrics: AggregateMetrics;
  campaigns: Campaign[];
  crews: Crew[];
  crewRuns: CrewRun[];
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
