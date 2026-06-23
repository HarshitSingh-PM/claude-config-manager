import { NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import { getOrchestrator, claudeAvailable, resolveClaudeBin } from "@/lib/orchestrator/runtime";
import { listAgents, listSkills } from "@/lib/orchestrator/agents";
import { TEAM_TEMPLATES, buildOrchestratedPrompt, buildParallelPrompt } from "@/lib/orchestrator/teams";
import { type PermMode, type TeamMode, type TeamRole, type Run } from "@/lib/orchestrator/types";

export const dynamic = "force-dynamic";

const PERM_MODES: PermMode[] = ["plan", "acceptEdits", "auto", "bypassPermissions"];
const normPerm = (p: unknown): PermMode => (PERM_MODES.includes(p as PermMode) ? (p as PermMode) : "acceptEdits");

// GET → full snapshot: live runs + history + aggregate metrics, plus the
// agent/skill catalogs and environment info used by the launch panel.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectDir = url.searchParams.get("projectDir") || "";
  const orch = getOrchestrator();
  const [agents, skills] = await Promise.all([listAgents(projectDir || undefined), listSkills(projectDir || undefined)]);
  return NextResponse.json({
    ...orch.snapshot(),
    agents,
    skills,
    teamTemplates: TEAM_TEMPLATES,
    claudeAvailable: claudeAvailable(),
    claudeBin: resolveClaudeBin(),
    defaults: { cwd: projectDir || os.homedir(), permissionMode: "acceptEdits", model: "sonnet" },
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action:
      | "launch"
      | "launchTeam"
      | "continue"
      | "stop"
      | "clearFinished"
      | "removeRun"
      | "clearHistory"
      | "campaignCreate"
      | "campaignRunSession"
      | "campaignUpdate"
      | "campaignDelete";
    id?: string;
    agentName?: string;
    agentLabel?: string;
    model?: string;
    task?: string;
    cwd?: string;
    permissionMode?: PermMode;
    maxTurns?: number;
    maxBudgetUsd?: number;
    // continue / resume
    sessionId?: string;
    // teams
    teamName?: string;
    teamMode?: TeamMode;
    objective?: string;
    roles?: TeamRole[];
    // campaigns
    name?: string;
    plan?: string;
    instruction?: string;
    patch?: Record<string, unknown>;
  };
  const orch = getOrchestrator();

  try {
    switch (body.action) {
      case "launch": {
        const task = (body.task || "").trim();
        if (!task) return NextResponse.json({ error: "task is required" }, { status: 400 });
        if (!claudeAvailable())
          return NextResponse.json(
            { error: "The `claude` CLI was not found. Install Claude Code (npm i -g @anthropic-ai/claude-code) or set CLAUDE_BIN." },
            { status: 400 },
          );
        const cwd = body.cwd || os.homedir();
        if (!path_isDir(cwd)) return NextResponse.json({ error: `cwd is not a directory: ${cwd}` }, { status: 400 });
        const permissionMode = PERM_MODES.includes(body.permissionMode as PermMode)
          ? (body.permissionMode as PermMode)
          : "acceptEdits";
        const run = orch.launch({
          agentName: body.agentName || "general",
          agentLabel: body.agentLabel,
          model: body.model || "sonnet",
          task,
          cwd,
          permissionMode,
          maxTurns: clampNum(body.maxTurns, 1, 200),
          maxBudgetUsd: clampNum(body.maxBudgetUsd, 0.1, 100),
        });
        return NextResponse.json({ ok: true, run });
      }
      case "launchTeam": {
        const objective = (body.objective || "").trim();
        const roles = (body.roles || []).filter((r) => r && r.responsibility?.trim());
        if (!objective) return NextResponse.json({ error: "objective is required" }, { status: 400 });
        if (roles.length === 0) return NextResponse.json({ error: "at least one role is required" }, { status: 400 });
        if (!claudeAvailable()) return NextResponse.json({ error: "the `claude` CLI was not found." }, { status: 400 });
        const cwd = body.cwd || os.homedir();
        if (!path_isDir(cwd)) return NextResponse.json({ error: `cwd is not a directory: ${cwd}` }, { status: 400 });
        const mode: TeamMode = body.teamMode === "parallel" ? "parallel" : "orchestrated";
        const teamId = `team_${Date.now().toString(36)}`;
        const teamName = (body.teamName || "Team").trim();
        const model = body.model || "sonnet";
        const permissionMode = normPerm(body.permissionMode);
        const maxTurns = clampNum(body.maxTurns, 1, 200);
        const launched: Run[] = [];
        if (mode === "orchestrated") {
          launched.push(
            orch.launch({
              agentName: "general",
              agentLabel: `${teamName} · lead`,
              model,
              task: buildOrchestratedPrompt(objective, roles),
              cwd,
              permissionMode,
              maxTurns,
              teamId,
              teamName,
              teamMode: mode,
              role: "Lead / orchestrator",
            }),
          );
        } else {
          for (const r of roles) {
            launched.push(
              orch.launch({
                agentName: r.agentName || "general",
                agentLabel: `${teamName} · ${r.role}`,
                model,
                task: buildParallelPrompt(objective, r),
                cwd,
                permissionMode,
                maxTurns,
                teamId,
                teamName,
                teamMode: mode,
                role: r.role,
              }),
            );
          }
        }
        return NextResponse.json({ ok: true, teamId, runs: launched });
      }
      case "continue": {
        const task = (body.task || "").trim();
        if (!body.sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
        if (!task) return NextResponse.json({ error: "task (next instruction) required" }, { status: 400 });
        if (!claudeAvailable()) return NextResponse.json({ error: "the `claude` CLI was not found." }, { status: 400 });
        const cwd = body.cwd || os.homedir();
        if (!path_isDir(cwd)) return NextResponse.json({ error: `cwd is not a directory: ${cwd}` }, { status: 400 });
        const run = orch.launch({
          agentName: "general",
          agentLabel: body.agentLabel || "Continued session",
          model: body.model || "sonnet",
          task,
          cwd,
          permissionMode: normPerm(body.permissionMode),
          maxTurns: clampNum(body.maxTurns, 1, 200),
          resumeSessionId: body.sessionId,
        });
        return NextResponse.json({ ok: true, run });
      }
      case "campaignCreate": {
        const name = (body.name || "").trim();
        const objective = (body.objective || "").trim();
        if (!name || !objective) return NextResponse.json({ error: "name and objective are required" }, { status: 400 });
        const cwd = body.cwd || os.homedir();
        if (!path_isDir(cwd)) return NextResponse.json({ error: `cwd is not a directory: ${cwd}` }, { status: 400 });
        const c = orch.createCampaign({
          name,
          objective,
          plan: body.plan,
          cwd,
          agentName: body.agentName || "general",
          model: body.model || "sonnet",
          permissionMode: normPerm(body.permissionMode),
          maxTurns: clampNum(body.maxTurns, 1, 200),
        });
        return NextResponse.json({ ok: true, campaign: c });
      }
      case "campaignRunSession": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        if (!claudeAvailable()) return NextResponse.json({ error: "the `claude` CLI was not found." }, { status: 400 });
        const run = orch.runCampaignSession(body.id, body.instruction?.trim() || undefined);
        if (!run) return NextResponse.json({ error: "campaign not found" }, { status: 404 });
        return NextResponse.json({ ok: true, run });
      }
      case "campaignUpdate": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const c = orch.updateCampaign(body.id, (body.patch || {}) as Record<string, unknown>);
        if (!c) return NextResponse.json({ error: "campaign not found" }, { status: 404 });
        return NextResponse.json({ ok: true, campaign: c });
      }
      case "campaignDelete": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json({ ok: orch.deleteCampaign(body.id) });
      }
      case "stop": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json({ ok: orch.stop(body.id) });
      }
      case "removeRun": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json({ ok: orch.removeRun(body.id) });
      }
      case "clearFinished":
        return NextResponse.json({ ok: true, removed: orch.clearFinished() });
      case "clearHistory":
        orch.clearHistory();
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function path_isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function clampNum(v: number | undefined, min: number, max: number): number | undefined {
  if (typeof v !== "number" || Number.isNaN(v)) return undefined;
  return Math.max(min, Math.min(max, v));
}
