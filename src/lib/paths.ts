import os from "node:os";
import path from "node:path";

export type Scope = "user" | "project-shared" | "project-local" | "enterprise";

export function userClaudeDir(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Claude");
  }
  return path.join(os.homedir(), ".claude");
}

export function enterpriseManagedDir(): string {
  if (process.platform === "darwin") {
    return "/Library/Application Support/ClaudeCode";
  }
  if (process.platform === "win32") {
    return "C:\\Program Files\\ClaudeCode";
  }
  return "/etc/claude-code";
}

export function defaultProjectDir(): string {
  // Best-effort guess: cwd if it looks like a project, else home.
  return process.cwd();
}

export type FileTarget = {
  id: string;
  scope: Scope;
  label: string;
  absolutePath: string;
  format: "json" | "markdown" | "directory" | "shell";
  gitTracked: boolean;
  description: string;
};

export function resolveTargets(projectDir: string | null): Record<string, FileTarget> {
  const u = userClaudeDir();
  const e = enterpriseManagedDir();
  const p = projectDir ?? "";
  const pj = p ? path.join(p, ".claude") : "";

  const targets: FileTarget[] = [
    // ───── User scope (Tab 1: Global Claude) ─────
    {
      id: "user.settings",
      scope: "user",
      label: "settings.json",
      absolutePath: path.join(u, "settings.json"),
      format: "json",
      gitTracked: false,
      description: "Your personal Claude Code settings: model, permissions, hooks, statusLine, env.",
    },
    {
      id: "user.claudemd",
      scope: "user",
      label: "CLAUDE.md",
      absolutePath: path.join(u, "CLAUDE.md"),
      format: "markdown",
      gitTracked: false,
      description: "User-level memory: coding preferences, tools, conventions Claude should follow everywhere.",
    },
    {
      id: "user.keybindings",
      scope: "user",
      label: "keybindings.json",
      absolutePath: path.join(u, "keybindings.json"),
      format: "json",
      gitTracked: false,
      description: "Custom keyboard shortcuts inside Claude Code.",
    },
    {
      id: "user.statusline",
      scope: "user",
      label: "statusline.sh",
      absolutePath: path.join(u, "statusline.sh"),
      format: "shell",
      gitTracked: false,
      description:
        "Shell script rendered at the bottom of every prompt. Built from widgets in the UI; saving also wires settings.json statusLine.command to point here.",
    },
    {
      id: "user.agents",
      scope: "user",
      label: "agents/",
      absolutePath: path.join(u, "agents"),
      format: "directory",
      gitTracked: false,
      description: "Reusable subagents available across all projects.",
    },
    {
      id: "user.commands",
      scope: "user",
      label: "commands/",
      absolutePath: path.join(u, "commands"),
      format: "directory",
      gitTracked: false,
      description: "Personal slash commands (legacy; prefer skills/).",
    },
    {
      id: "user.outputStyles",
      scope: "user",
      label: "output-styles/",
      absolutePath: path.join(u, "output-styles"),
      format: "directory",
      gitTracked: false,
      description: "Custom output styles to change Claude's tone or response format.",
    },
    {
      id: "user.skills",
      scope: "user",
      label: "skills/",
      absolutePath: path.join(u, "skills"),
      format: "directory",
      gitTracked: false,
      description: "User-level skills (each is a directory with a SKILL.md inside). Newer pattern; preferred over commands/.",
    },

    // ───── Project shared (Tab 2: Global Project, committed) ─────
    {
      id: "project.settings",
      scope: "project-shared",
      label: ".claude/settings.json",
      absolutePath: pj && path.join(pj, "settings.json"),
      format: "json",
      gitTracked: true,
      description: "Team-shared project settings. Commit this. Overrides user settings.",
    },
    {
      id: "project.claudemd",
      scope: "project-shared",
      label: "CLAUDE.md",
      absolutePath: p && path.join(p, "CLAUDE.md"),
      format: "markdown",
      gitTracked: true,
      description: "Team-shared project memory: stack, conventions, build commands, architecture notes.",
    },
    {
      id: "project.mcp",
      scope: "project-shared",
      label: ".mcp.json",
      absolutePath: p && path.join(p, ".mcp.json"),
      format: "json",
      gitTracked: true,
      description: "MCP servers shared with the team for this project.",
    },
    {
      id: "project.agents",
      scope: "project-shared",
      label: ".claude/agents/",
      absolutePath: pj && path.join(pj, "agents"),
      format: "directory",
      gitTracked: true,
      description: "Project-specific subagents, shared with the team.",
    },
    {
      id: "project.commands",
      scope: "project-shared",
      label: ".claude/commands/",
      absolutePath: pj && path.join(pj, "commands"),
      format: "directory",
      gitTracked: true,
      description: "Project slash commands, shared with the team.",
    },
    {
      id: "project.outputStyles",
      scope: "project-shared",
      label: ".claude/output-styles/",
      absolutePath: pj && path.join(pj, "output-styles"),
      format: "directory",
      gitTracked: true,
      description: "Project output styles, shared with the team.",
    },
    {
      id: "project.skills",
      scope: "project-shared",
      label: ".claude/skills/",
      absolutePath: pj && path.join(pj, "skills"),
      format: "directory",
      gitTracked: true,
      description: "Project skills (each is a directory with a SKILL.md inside), shared with the team.",
    },

    // ───── Project local (Tab 3: Project Local, gitignored) ─────
    {
      id: "projectLocal.settings",
      scope: "project-local",
      label: ".claude/settings.local.json",
      absolutePath: pj && path.join(pj, "settings.local.json"),
      format: "json",
      gitTracked: false,
      description: "Your personal overrides for this project. NOT committed to git.",
    },
    {
      id: "projectLocal.claudemd",
      scope: "project-local",
      label: "CLAUDE.local.md",
      absolutePath: p && path.join(p, "CLAUDE.local.md"),
      format: "markdown",
      gitTracked: false,
      description: "Personal project notes (debugging tricks, local URLs). NOT committed.",
    },
    // ───── Enterprise (Tab 4: Enterprise, IT-managed) ─────
    {
      id: "enterprise.managedSettings",
      scope: "enterprise",
      label: "managed-settings.json",
      absolutePath: path.join(e, "managed-settings.json"),
      format: "json",
      gitTracked: false,
      description: "Organization-wide policy (highest precedence). Requires admin rights to deploy.",
    },
    {
      id: "enterprise.managedClaudemd",
      scope: "enterprise",
      label: "CLAUDE.md (managed)",
      absolutePath: path.join(e, "CLAUDE.md"),
      format: "markdown",
      gitTracked: false,
      description: "Organization-wide CLAUDE.md applied to every session.",
    },
  ];

  const map: Record<string, FileTarget> = {};
  for (const t of targets) map[t.id] = t;
  return map;
}

export function osLabel(): { platform: NodeJS.Platform; pretty: string } {
  const p = process.platform;
  const pretty =
    p === "darwin" ? "macOS" : p === "win32" ? "Windows" : p === "linux" ? "Linux" : p;
  return { platform: p, pretty };
}
