// Curated agent-team templates + the prompt builders that turn a team launch
// into either one orchestrated lead run (delegates to specialists) or several
// parallel role runs. Inspired by Claude-Agent-Team-Manager, agent-teams-ai,
// and AI-Agents-Orchestrator role sets.

import { type TeamTemplate, type TeamRole } from "./types";

export const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    id: "build-squad",
    name: "Build squad",
    description: "Architect plans it, a developer implements, a reviewer checks. Good for a feature end-to-end.",
    mode: "orchestrated",
    roles: [
      { role: "Architect", agentName: "general", responsibility: "Break the objective into a concrete technical plan and file-level steps." },
      { role: "Developer", agentName: "general", responsibility: "Implement the plan — write and edit the code." },
      { role: "Reviewer", agentName: "general", responsibility: "Review the changes for correctness, bugs, and simplifications; list fixes." },
    ],
  },
  {
    id: "ship-crew",
    name: "Ship crew",
    description: "PM lead coordinates a developer, QA, and DevOps to take work all the way to shippable.",
    mode: "orchestrated",
    roles: [
      { role: "Developer", agentName: "general", responsibility: "Build the feature per the objective." },
      { role: "QA", agentName: "general", responsibility: "Write/run tests and verify behavior; report defects." },
      { role: "DevOps", agentName: "general", responsibility: "Handle build, config, and deployment readiness." },
    ],
  },
  {
    id: "research-pod",
    name: "Research pod",
    description: "Three researchers attack the question from different angles in parallel.",
    mode: "parallel",
    roles: [
      { role: "Researcher · primary sources", agentName: "general", responsibility: "Gather facts from primary/official sources; cite them." },
      { role: "Researcher · community", agentName: "general", responsibility: "Gather signal from community/forums/reviews; note sentiment." },
      { role: "Researcher · competitors", agentName: "general", responsibility: "Map competitors/alternatives and how they compare." },
    ],
  },
  {
    id: "bug-hunt",
    name: "Bug hunt",
    description: "Multiple finders sweep the codebase in parallel for issues.",
    mode: "parallel",
    roles: [
      { role: "Finder · correctness", agentName: "general", responsibility: "Hunt for correctness/logic bugs; report file:line + why." },
      { role: "Finder · security", agentName: "general", responsibility: "Hunt for security/auth/input issues; report file:line + impact." },
      { role: "Finder · performance", agentName: "general", responsibility: "Hunt for performance/efficiency problems; report file:line + cost." },
    ],
  },
];

function roleLine(r: TeamRole): string {
  const who = r.agentName && r.agentName !== "general" ? ` (use the "${r.agentName}" subagent)` : "";
  return `- ${r.role}${who}: ${r.responsibility}`;
}

// One lead agent that delegates to the roles via the Task tool and integrates.
export function buildOrchestratedPrompt(objective: string, roles: TeamRole[]): string {
  return [
    `You are the orchestrator and lead of an agent team. Coordinate the team to achieve this objective:`,
    objective,
    `Your specialists and their responsibilities:`,
    roles.map(roleLine).join("\n"),
    `Plan the work, then delegate each part to the appropriate specialist using the Task tool (run independent parts in parallel where you can). Track what each returns, resolve conflicts, and integrate everything into a single coherent result. Finish with a concise summary of what the team produced.`,
  ].join("\n\n");
}

// One agent per role, each focused on its slice, run concurrently.
export function buildParallelPrompt(objective: string, role: TeamRole): string {
  return [
    `You are part of an agent team working toward this shared objective:`,
    objective,
    `Your role: ${role.role}`,
    `Your responsibility: ${role.responsibility}`,
    `Focus only on your role. Do your part thoroughly and finish with a clear, self-contained report of your findings/changes so the rest of the team can build on it.`,
  ].join("\n\n");
}
