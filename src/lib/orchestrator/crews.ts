// The Crew engine: CrewAI-style multi-agent pipelines authored entirely in the
// UI. A Crew is a saved definition (agents + ordered tasks + input variables);
// launching it creates a CrewRun that executes tasks one at a time through the
// existing Orchestrator (one headless `claude -p` per step), feeding each
// step's final output into the prompts of the steps that declared it as
// context. Hierarchical crews instead launch a single manager agent that
// delegates the tasks via the Task tool.
//
// Pinned to globalThis (same as the Orchestrator) so dev HMR / route
// re-evaluation doesn't orphan an in-flight pipeline.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getOrchestrator } from "./runtime";
import {
  type Crew,
  type CrewAgent,
  type CrewTask,
  type CrewInputVar,
  type CrewRun,
  type CrewStepRun,
  type CrewProcess,
  type LiveSnapshot,
  type PermMode,
  type Run,
} from "./types";

const CREWS_PATH = path.join(os.homedir(), ".claude-config-ui", "crews.json");
const CREW_RUNS_PATH = path.join(os.homedir(), ".claude-config-ui", "crew-runs.json");
const CREW_RUNS_CAP = 100;
// A step's output is handed to downstream prompts; cap it so a verbose step
// can't blow up the next step's context.
const CONTEXT_MAX_CHARS = 12000;

const PERM_MODES: PermMode[] = ["plan", "acceptEdits", "auto", "dontAsk", "bypassPermissions"];

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + `\n… [truncated — full output was ${s.length} chars]` : s;
}

// Replace {var} placeholders with the run's input values. Unknown placeholders
// are left as-is so the agent still sees what was intended.
function interpolate(text: string, values: Record<string, string>): string {
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, k) => (k in values ? values[k] : m));
}

// ─── crew definition validation / normalization ─────────────────────
export function normalizeCrew(input: Record<string, unknown>, existing?: Crew): { crew?: Crew; error?: string } {
  const name = String(input.name || "").trim();
  if (!name) return { error: "Crew name is required." };
  const process: CrewProcess = input.process === "hierarchical" ? "hierarchical" : "sequential";

  const rawAgents = Array.isArray(input.agents) ? (input.agents as Record<string, unknown>[]) : [];
  const agents: CrewAgent[] = [];
  for (const a of rawAgents) {
    const role = String(a.role || "").trim();
    if (!role) return { error: "Every agent needs a role (e.g. “Research Analyst”)." };
    agents.push({
      id: String(a.id || newId("cagent")),
      role,
      goal: String(a.goal || "").trim(),
      backstory: String(a.backstory || "").trim(),
      model: String(a.model || "sonnet"),
      subagentName: a.subagentName ? String(a.subagentName) : undefined,
      permissionMode: PERM_MODES.includes(a.permissionMode as PermMode) ? (a.permissionMode as PermMode) : "acceptEdits",
      maxTurns: typeof a.maxTurns === "number" && a.maxTurns > 0 ? Math.min(200, a.maxTurns) : undefined,
    });
  }
  if (agents.length === 0) return { error: "A crew needs at least one agent." };

  const agentIds = new Set(agents.map((a) => a.id));
  const rawTasks = Array.isArray(input.tasks) ? (input.tasks as Record<string, unknown>[]) : [];
  const tasks: CrewTask[] = [];
  for (const t of rawTasks) {
    const description = String(t.description || "").trim();
    if (!description) return { error: "Every task needs a description of what to do." };
    const agentId = String(t.agentId || "");
    if (!agentIds.has(agentId)) return { error: `Task “${t.name || description.slice(0, 40)}” has no agent assigned.` };
    tasks.push({
      id: String(t.id || newId("ctask")),
      name: String(t.name || "").trim() || description.slice(0, 40),
      description,
      expectedOutput: String(t.expectedOutput || "").trim(),
      agentId,
      contextTaskIds: Array.isArray(t.contextTaskIds) ? (t.contextTaskIds as string[]).map(String) : [],
    });
  }
  if (tasks.length === 0) return { error: "A crew needs at least one task." };
  // context can only reference EARLIER tasks (it's a forward pipeline)
  const seen = new Set<string>();
  for (const t of tasks) {
    t.contextTaskIds = t.contextTaskIds.filter((id) => seen.has(id));
    seen.add(t.id);
  }

  const seenInputNames = new Set<string>();
  const inputs: CrewInputVar[] = (Array.isArray(input.inputs) ? (input.inputs as Record<string, unknown>[]) : [])
    .map((v) => ({
      name: String(v.name || "").trim().replace(/[^a-zA-Z0-9_]/g, "_"),
      label: String(v.label || v.name || "").trim(),
      placeholder: v.placeholder ? String(v.placeholder) : undefined,
    }))
    .filter((v) => {
      if (!v.name || seenInputNames.has(v.name)) return false; // drop dupes — one {name} = one value
      seenInputNames.add(v.name);
      return true;
    });

  const cwd = String(input.cwd || "").trim() || os.homedir();
  const maxBudgetUsd =
    typeof input.maxBudgetUsd === "number" && input.maxBudgetUsd > 0
      ? Math.min(100, input.maxBudgetUsd)
      : undefined;

  const now = Date.now();
  return {
    crew: {
      id: existing?.id || String(input.id || "") || newId("crew"),
      name,
      description: String(input.description || "").trim(),
      process,
      agents,
      tasks,
      inputs,
      cwd,
      maxBudgetUsd,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      runCount: existing?.runCount || 0,
      lastRunAt: existing?.lastRunAt,
    },
  };
}

// ─── step prompt builders ───────────────────────────────────────────
function personaBlock(agent: CrewAgent): string {
  return [
    `You are ${agent.role}.`,
    agent.goal ? `Your goal: ${agent.goal}` : "",
    agent.backstory ? `Background: ${agent.backstory}` : "",
    agent.subagentName ? `Use the "${agent.subagentName}" subagent's expertise and tools where helpful.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildStepPrompt(
  crew: Crew,
  task: CrewTask,
  agent: CrewAgent,
  values: Record<string, string>,
  contextOutputs: { name: string; role: string; output: string }[],
  stepNo: number,
  totalSteps: number,
): string {
  const parts = [
    personaBlock(agent),
    `You are performing step ${stepNo} of ${totalSteps} in the multi-agent pipeline “${crew.name}”. Focus ONLY on your task — earlier steps are done and later steps will build on your output.`,
    `Your task:\n${interpolate(task.description, values)}`,
  ];
  if (task.expectedOutput) parts.push(`Expected output:\n${interpolate(task.expectedOutput, values)}`);
  if (contextOutputs.length) {
    parts.push(
      `Context — outputs handed to you from earlier pipeline steps:\n` +
        contextOutputs
          .map((c) => `### Output of “${c.name}” (by ${c.role}):\n${clip(c.output, CONTEXT_MAX_CHARS)}`)
          .join("\n\n"),
    );
  }
  parts.push(
    `Finish with the deliverable itself — complete and self-contained — because it will be handed verbatim to the next agent in the pipeline (or to the user, if you are the last step).`,
  );
  return parts.join("\n\n");
}

function buildManagerPrompt(crew: Crew, values: Record<string, string>): string {
  const agentLines = crew.agents.map((a) => `- ${a.role}: ${a.goal || a.backstory || "generalist"}`).join("\n");
  const byId = new Map(crew.agents.map((a) => [a.id, a]));
  const taskLines = crew.tasks
    .map((t, i) => {
      const who = byId.get(t.agentId)?.role || "any specialist";
      const expected = t.expectedOutput ? ` Expected output: ${interpolate(t.expectedOutput, values)}` : "";
      return `${i + 1}. [${who}] ${interpolate(t.description, values)}${expected}`;
    })
    .join("\n");
  return [
    `You are the manager of the agent crew “${crew.name}”. Coordinate your specialists to complete the mission below.`,
    `Your specialists:\n${agentLines}`,
    `The tasks, in order:\n${taskLines}`,
    `Delegate each task to the matching specialist using the Task tool (adopt their role in the delegation prompt), pass along the outputs earlier tasks produced where relevant, resolve conflicts, and integrate everything. Finish with the final deliverable of the last task, complete and self-contained.`,
  ].join("\n\n");
}

// ─── the engine ─────────────────────────────────────────────────────
class CrewEngine {
  crews: Crew[] = [];
  crewRuns: CrewRun[] = []; // newest first; finished ones are persisted
  // underlying orchestrator runId → position in a live crew run
  private stepIndex = new Map<string, { crewRunId: string; stepIdx: number }>();

  constructor() {
    this.loadCrews();
    this.loadRuns();
    getOrchestrator().onRunFinished((run) => this.onRunFinished(run));
  }

  // ── persistence ──
  private loadCrews() {
    try {
      this.crews = JSON.parse(fs.readFileSync(CREWS_PATH, "utf8"));
      if (!Array.isArray(this.crews)) this.crews = [];
    } catch {
      this.crews = [];
    }
  }
  private saveCrews() {
    try {
      fs.mkdirSync(path.dirname(CREWS_PATH), { recursive: true });
      fs.writeFileSync(CREWS_PATH, JSON.stringify(this.crews, null, 2));
    } catch {
      /* best effort */
    }
  }
  private loadRuns() {
    try {
      const arr = JSON.parse(fs.readFileSync(CREW_RUNS_PATH, "utf8"));
      // anything persisted was finished; runs in flight when the app died stay
      // as they were last saved (running steps are marked failed below)
      this.crewRuns = Array.isArray(arr) ? arr : [];
      for (const cr of this.crewRuns) {
        if (cr.status === "running" || cr.status === "queued") {
          cr.status = "failed";
          cr.error = "App restarted while this crew was running.";
          for (const s of cr.steps) if (s.status === "running" || s.status === "pending") s.status = "skipped";
        }
      }
    } catch {
      this.crewRuns = [];
    }
  }
  private saveRuns() {
    try {
      fs.mkdirSync(path.dirname(CREW_RUNS_PATH), { recursive: true });
      fs.writeFileSync(CREW_RUNS_PATH, JSON.stringify(this.crewRuns.slice(0, CREW_RUNS_CAP), null, 2));
    } catch {
      /* best effort */
    }
  }
  private notify() {
    getOrchestrator().notify();
  }

  // ── crew CRUD ──
  saveCrew(input: Record<string, unknown>): { crew?: Crew; error?: string } {
    const existing = input.id ? this.crews.find((c) => c.id === input.id) : undefined;
    const res = normalizeCrew(input, existing);
    if (!res.crew) return res;
    if (existing) {
      const i = this.crews.indexOf(existing);
      this.crews[i] = res.crew;
    } else {
      this.crews.unshift(res.crew);
    }
    this.saveCrews();
    this.notify();
    return res;
  }
  deleteCrew(id: string): boolean {
    const i = this.crews.findIndex((c) => c.id === id);
    if (i < 0) return false;
    this.crews.splice(i, 1);
    this.saveCrews();
    this.notify();
    return true;
  }
  duplicateCrew(id: string): Crew | null {
    const src = this.crews.find((c) => c.id === id);
    if (!src) return null;
    const copy: Crew = JSON.parse(JSON.stringify(src));
    copy.id = newId("crew");
    copy.name = `${src.name} (copy)`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.runCount = 0;
    copy.lastRunAt = undefined;
    this.crews.unshift(copy);
    this.saveCrews();
    this.notify();
    return copy;
  }

  // ── launching ("deploy & use") ──
  launchCrew(crewId: string, inputValues: Record<string, string>, cwdOverride?: string): { crewRun?: CrewRun; error?: string } {
    const crew = this.crews.find((c) => c.id === crewId);
    if (!crew) return { error: "Crew not found." };
    const missing = crew.inputs.filter((v) => !(inputValues[v.name] || "").trim());
    if (missing.length) return { error: `Missing input: ${missing.map((m) => m.label || m.name).join(", ")}` };

    const cwd = (cwdOverride || crew.cwd || os.homedir()).trim();
    const values: Record<string, string> = {};
    for (const v of crew.inputs) values[v.name] = String(inputValues[v.name] ?? "");

    const cr: CrewRun = {
      id: newId("crun"),
      crewId: crew.id,
      crewName: crew.name,
      process: crew.process,
      status: "running",
      inputValues: values,
      cwd,
      steps:
        crew.process === "hierarchical"
          ? [
              {
                taskId: "manager",
                taskName: `Manager — coordinates all ${crew.tasks.length} tasks`,
                agentId: "manager",
                agentRole: "Crew manager",
                status: "pending",
                costUsd: 0,
              },
            ]
          : crew.tasks.map((t) => {
              const agent = crew.agents.find((a) => a.id === t.agentId);
              return {
                taskId: t.id,
                taskName: t.name,
                agentId: t.agentId,
                agentRole: agent?.role || "?",
                status: "pending",
                costUsd: 0,
              } as CrewStepRun;
            }),
      createdAt: Date.now(),
      totalCostUsd: 0,
    };
    this.crewRuns.unshift(cr);
    crew.runCount = (crew.runCount || 0) + 1;
    crew.lastRunAt = Date.now();
    this.saveCrews();

    const err = this.startStep(cr, 0);
    if (err) {
      cr.status = "failed";
      cr.error = err;
      cr.endedAt = Date.now();
      this.saveRuns();
      this.notify();
      return { error: err };
    }
    // Persist the live run too — otherwise an app restart mid-pipeline loses
    // the run entirely and the load-time "app restarted" recovery can't run.
    this.saveRuns();
    this.notify();
    return { crewRun: cr };
  }

  // Launch the underlying run for step `idx`. Returns an error string on failure.
  private startStep(cr: CrewRun, idx: number): string | null {
    const crew = this.crews.find((c) => c.id === cr.crewId);
    if (!crew) return "Crew definition was deleted.";
    const orch = getOrchestrator();
    const step = cr.steps[idx];
    if (!step) return "No steps to run.";

    let prompt: string;
    let agent: CrewAgent | undefined;
    if (cr.process === "hierarchical") {
      agent = crew.agents[0];
      prompt = buildManagerPrompt(crew, cr.inputValues);
    } else {
      const task = crew.tasks.find((t) => t.id === step.taskId);
      agent = crew.agents.find((a) => a.id === step.agentId);
      if (!task || !agent) return `Step “${step.taskName}” no longer matches the crew definition.`;
      const contextOutputs = task.contextTaskIds
        .map((cid) => {
          const done = cr.steps.find((s) => s.taskId === cid && s.status === "completed" && s.output !== undefined);
          const ctask = crew.tasks.find((t) => t.id === cid);
          const cagent = done ? crew.agents.find((a) => a.id === done.agentId) : undefined;
          return done && ctask ? { name: ctask.name, role: cagent?.role || "?", output: done.output! } : null;
        })
        .filter((x): x is { name: string; role: string; output: string } => x !== null);
      prompt = buildStepPrompt(crew, task, agent, cr.inputValues, contextOutputs, idx + 1, cr.steps.length);
    }

    const run = orch.launch({
      agentName: agent?.subagentName || "general",
      agentLabel: `${crew.name} · ${step.agentRole}`,
      model: agent?.model || "sonnet",
      task: prompt,
      cwd: cr.cwd,
      permissionMode: agent?.permissionMode || "acceptEdits",
      maxTurns: agent?.maxTurns,
      maxBudgetUsd: crew.maxBudgetUsd,
      teamId: cr.id,
      teamName: `Crew · ${crew.name}`,
      teamMode: "orchestrated",
      role: step.agentRole,
    });
    if (run.status === "failed") return run.error || "Could not start the step.";
    step.status = "running";
    step.startedAt = Date.now();
    step.runId = run.id;
    this.stepIndex.set(run.id, { crewRunId: cr.id, stepIdx: idx });
    return null;
  }

  // Called by the orchestrator whenever ANY run finishes; we only act on ours.
  private onRunFinished(run: Run) {
    const loc = this.stepIndex.get(run.id);
    if (!loc) return;
    this.stepIndex.delete(run.id);
    const cr = this.crewRuns.find((x) => x.id === loc.crewRunId);
    if (!cr) return;
    const step = cr.steps[loc.stepIdx];
    if (!step) return;

    step.endedAt = Date.now();
    step.costUsd = run.metrics.costUsd || 0;
    cr.totalCostUsd += step.costUsd;

    if (run.status === "completed") {
      step.status = "completed";
      step.output = run.resultText || "";
      const nextIdx = loc.stepIdx + 1;
      if (nextIdx < cr.steps.length && cr.status === "running") {
        const err = this.startStep(cr, nextIdx);
        if (err) {
          cr.steps[nextIdx].status = "failed";
          cr.steps[nextIdx].error = err;
          for (let i = nextIdx + 1; i < cr.steps.length; i++) cr.steps[i].status = "skipped";
          cr.status = "failed";
          cr.error = err;
          cr.endedAt = Date.now();
        }
      } else if (cr.status === "running") {
        cr.status = "completed";
        cr.finalOutput = step.output;
        cr.endedAt = Date.now();
      }
    } else {
      step.status = "failed";
      step.error = run.error || `Step ended: ${run.status}`;
      for (let i = loc.stepIdx + 1; i < cr.steps.length; i++) cr.steps[i].status = "skipped";
      cr.status = run.status === "stopped" ? "stopped" : "failed";
      cr.error = step.error;
      cr.endedAt = Date.now();
    }
    this.saveRuns();
    this.notify();
  }

  stopCrewRun(id: string): boolean {
    const cr = this.crewRuns.find((x) => x.id === id);
    if (!cr || (cr.status !== "running" && cr.status !== "queued")) return false;
    cr.status = "stopped";
    cr.endedAt = Date.now();
    const orch = getOrchestrator();
    for (const s of cr.steps) {
      if (s.status === "running" && s.runId) orch.stop(s.runId); // its finish event records cost
      if (s.status === "pending") s.status = "skipped";
    }
    this.saveRuns();
    this.notify();
    return true;
  }

  removeCrewRun(id: string): boolean {
    const i = this.crewRuns.findIndex((x) => x.id === id);
    if (i < 0) return false;
    if (this.crewRuns[i].status === "running") this.stopCrewRun(id);
    this.crewRuns.splice(i, 1);
    this.saveRuns();
    this.notify();
    return true;
  }

  clearFinishedCrewRuns(): number {
    const before = this.crewRuns.length;
    this.crewRuns = this.crewRuns.filter((x) => x.status === "running" || x.status === "queued");
    const removed = before - this.crewRuns.length;
    if (removed) {
      this.saveRuns();
      this.notify();
    }
    return removed;
  }

  snapshot(): Pick<LiveSnapshot, "crews" | "crewRuns"> {
    return {
      crews: [...this.crews].sort((a, b) => b.updatedAt - a.updatedAt),
      crewRuns: this.crewRuns.slice(0, CREW_RUNS_CAP),
    };
  }
}

const g = globalThis as unknown as { __ccmCrewEngine?: CrewEngine };
export function getCrewEngine(): CrewEngine {
  if (!g.__ccmCrewEngine) g.__ccmCrewEngine = new CrewEngine();
  return g.__ccmCrewEngine;
}

// The combined snapshot the routes/SSE send to the browser.
export function fullSnapshot(): LiveSnapshot {
  return { ...getOrchestrator().snapshot(), ...getCrewEngine().snapshot() };
}
