// Discovery of available subagent definitions and skills, used to populate the
// launch panel and the skill registry. Read-only.

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";
import { type AgentDef, type SkillInfo } from "./types";

function claudeDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

// Minimal frontmatter split — the config editor uses the same `---\n…\n---`
// convention for agent .md files.
function parseFrontmatter(raw: string): { fm: Record<string, unknown>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  let fm: Record<string, unknown> = {};
  try {
    fm = (yaml.load(m[1]) as Record<string, unknown>) || {};
  } catch {
    fm = {};
  }
  return { fm, body: m[2] };
}

async function readAgentsFrom(dir: string, source: "user" | "project"): Promise<AgentDef[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: AgentDef[] = [];
  for (const file of entries) {
    if (!file.endsWith(".md")) continue;
    const full = path.join(dir, file);
    try {
      const raw = await fs.readFile(full, "utf8");
      const { fm } = parseFrontmatter(raw);
      const name = String(fm.name || file.replace(/\.md$/, ""));
      const toolsField = fm.tools;
      const tools = Array.isArray(toolsField)
        ? (toolsField as string[])
        : typeof toolsField === "string"
          ? (toolsField as string).split(",").map((s) => s.trim()).filter(Boolean)
          : undefined;
      out.push({
        name,
        label: name,
        description: String(fm.description || "").trim(),
        model: fm.model ? String(fm.model) : undefined,
        source,
        tools,
        path: full,
      });
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

export async function listAgents(projectDir?: string): Promise<AgentDef[]> {
  const userAgents = await readAgentsFrom(path.join(claudeDir(), "agents"), "user");
  const projectAgents = projectDir
    ? await readAgentsFrom(path.join(projectDir, ".claude", "agents"), "project")
    : [];
  // de-dupe by name (project shadows user)
  const byName = new Map<string, AgentDef>();
  for (const a of userAgents) byName.set(a.name, a);
  for (const a of projectAgents) byName.set(a.name, a);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function readSkillsFrom(dir: string, source: SkillInfo["source"]): Promise<SkillInfo[]> {
  let entries: { name: string; isDirectory: () => boolean }[] = [];
  try {
    entries = (await fs.readdir(dir, { withFileTypes: true })) as unknown as {
      name: string;
      isDirectory: () => boolean;
    }[];
  } catch {
    return [];
  }
  const out: SkillInfo[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillFile = path.join(dir, e.name, "SKILL.md");
    let description = "";
    try {
      const raw = await fs.readFile(skillFile, "utf8");
      const { fm } = parseFrontmatter(raw);
      description = String(fm.description || "").trim();
    } catch {
      continue; // not a real skill dir
    }
    out.push({ name: e.name, description, source });
  }
  return out;
}

export async function listSkills(projectDir?: string): Promise<SkillInfo[]> {
  const user = await readSkillsFrom(path.join(claudeDir(), "skills"), "user");
  const project = projectDir ? await readSkillsFrom(path.join(projectDir, ".claude", "skills"), "project") : [];
  const byName = new Map<string, SkillInfo>();
  for (const s of [...user, ...project]) byName.set(s.name, s);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
