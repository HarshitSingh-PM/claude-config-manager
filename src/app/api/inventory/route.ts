import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter } from "@/lib/frontmatter";
import { resolveTargets, type Scope } from "@/lib/paths";

export const dynamic = "force-dynamic";

type Item = {
  scope: Scope;
  type: "agent" | "command" | "skill" | "output-style";
  name: string;
  description: string;
  filePath: string;     // file to open when user clicks "Edit"
  dirPath: string;      // containing directory (used for DirEditor active selection)
  fileName: string;     // basename of the file
  targetId: string;     // matches paths.ts target id for the containing directory
  scopeLabel: string;
};

// Map from a directory target id → which type the items inside it are.
const DIR_TYPE_MAP: Record<string, Item["type"]> = {
  "user.agents": "agent",
  "user.commands": "command",
  "user.outputStyles": "output-style",
  "user.skills": "skill",
  "project.agents": "agent",
  "project.commands": "command",
  "project.outputStyles": "output-style",
  "project.skills": "skill",
};

const SCOPE_LABELS: Record<Scope, string> = {
  user: "User",
  "project-shared": "Project",
  "project-local": "Project (local)",
  enterprise: "Enterprise",
};

async function readDirSafe(dir: string) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readFrontmatterFile(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return parseFrontmatter(raw);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectDir = url.searchParams.get("projectDir");
  const targets = resolveTargets(projectDir);

  const items: Item[] = [];
  const errors: string[] = [];

  for (const [targetId, type] of Object.entries(DIR_TYPE_MAP)) {
    const target = targets[targetId];
    if (!target?.absolutePath) continue;
    const dir = target.absolutePath;
    const entries = await readDirSafe(dir);

    if (type === "skill") {
      // Skills are subdirectories — each contains SKILL.md
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillDir = path.join(dir, entry.name);
        const skillFile = path.join(skillDir, "SKILL.md");
        const doc = await readFrontmatterFile(skillFile);
        if (!doc) continue; // no SKILL.md → not a skill
        items.push({
          scope: target.scope,
          scopeLabel: SCOPE_LABELS[target.scope],
          type,
          name: (doc.fm.name as string | undefined) ?? entry.name,
          description: (doc.fm.description as string | undefined) ?? "",
          filePath: skillFile,
          dirPath: dir,
          fileName: `${entry.name}/SKILL.md`,
          targetId,
        });
      }
    } else {
      // Agents / commands / output-styles are flat .md files in the directory
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith(".md")) continue;
        const file = path.join(dir, entry.name);
        const doc = await readFrontmatterFile(file);
        if (!doc) continue;
        items.push({
          scope: target.scope,
          scopeLabel: SCOPE_LABELS[target.scope],
          type,
          name: (doc.fm.name as string | undefined) ?? entry.name.replace(/\.md$/, ""),
          description: (doc.fm.description as string | undefined) ?? "",
          filePath: file,
          dirPath: dir,
          fileName: entry.name,
          targetId,
        });
      }
    }
  }

  // Sort: type asc, then scope asc, then name asc
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
    return a.name.localeCompare(b.name);
  });

  const counts = {
    agent: items.filter((i) => i.type === "agent").length,
    command: items.filter((i) => i.type === "command").length,
    skill: items.filter((i) => i.type === "skill").length,
    "output-style": items.filter((i) => i.type === "output-style").length,
  };

  return NextResponse.json({ items, counts, errors });
}
