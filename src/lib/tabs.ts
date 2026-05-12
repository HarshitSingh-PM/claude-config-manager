import type { Scope } from "./paths";

export type TabFileType =
  | "settings"
  | "credentials"
  | "statusline"
  | "claudemd"
  | "mcp"
  | "keybindings"
  | "agents-dir"
  | "commands-dir"
  | "output-styles-dir";

export type TabFile = {
  id: string; // sidebar-unique id
  type: TabFileType;
  label: string;
  // When set, this entry shares its on-disk file (and FileState) with another
  // entry. Used by "Credentials" which is a focused view onto user.settings.
  fileTargetId?: string;
};

export type TabDef = {
  id: Scope;
  label: string;
  description: string;
  files: TabFile[];
  hint: string;
};

export const tabs: TabDef[] = [
  {
    id: "user",
    label: "Global Claude",
    description: "Your personal Claude Code config. Applies to every project on this machine.",
    hint: "Stored under ~/.claude/ (or %APPDATA%\\Claude on Windows).",
    files: [
      { id: "user.settings", type: "settings", label: "settings.json" },
      {
        id: "user.credentials",
        type: "credentials",
        label: "Credentials",
        fileTargetId: "user.settings",
      },
      { id: "user.statusline", type: "statusline", label: "Status line" },
      { id: "user.claudemd", type: "claudemd", label: "CLAUDE.md" },
      { id: "user.keybindings", type: "keybindings", label: "keybindings.json" },
      { id: "user.agents", type: "agents-dir", label: "agents/" },
      { id: "user.commands", type: "commands-dir", label: "commands/" },
      { id: "user.outputStyles", type: "output-styles-dir", label: "output-styles/" },
    ],
  },
  {
    id: "project-shared",
    label: "Global Project",
    description:
      "Team-shared settings for the selected project. Commit these to git so the whole team gets them.",
    hint: "Stored under <project>/.claude/ and <project>/CLAUDE.md.",
    files: [
      { id: "project.settings", type: "settings", label: ".claude/settings.json" },
      { id: "project.claudemd", type: "claudemd", label: "CLAUDE.md" },
      { id: "project.mcp", type: "mcp", label: ".mcp.json" },
      { id: "project.agents", type: "agents-dir", label: ".claude/agents/" },
      { id: "project.commands", type: "commands-dir", label: ".claude/commands/" },
      { id: "project.outputStyles", type: "output-styles-dir", label: ".claude/output-styles/" },
    ],
  },
  {
    id: "project-local",
    label: "Local Claude",
    description:
      "Personal overrides for the selected project. Gitignored — never committed.",
    hint:
      "Stored as <project>/.claude/settings.local.json and <project>/CLAUDE.local.md.",
    files: [
      { id: "projectLocal.settings", type: "settings", label: ".claude/settings.local.json" },
      { id: "projectLocal.claudemd", type: "claudemd", label: "CLAUDE.local.md" },
    ],
  },
  {
    id: "enterprise",
    label: "Project Local (Enterprise)",
    description:
      "Organization-wide policy deployed by IT. Highest precedence — cannot be overridden by users or projects.",
    hint:
      "macOS: /Library/Application Support/ClaudeCode/. Windows: C:\\Program Files\\ClaudeCode\\. Linux: /etc/claude-code/.",
    files: [
      { id: "enterprise.managedSettings", type: "settings", label: "managed-settings.json" },
      { id: "enterprise.managedClaudemd", type: "claudemd", label: "CLAUDE.md" },
    ],
  },
];
