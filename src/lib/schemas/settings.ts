import type { Schema } from "./types";

export const settingsSchema: Schema = {
  id: "settings",
  title: "settings.json",
  description:
    "Claude Code settings. Permissions, hooks, model, status line, environment — all live here.",
  format: "json",
  fields: [
    {
      type: "group",
      key: "model_group",
      label: "Model & Reasoning",
      tooltip: "Which Claude model to use and how hard it should think.",
      fields: [
        {
          type: "select",
          key: "model",
          label: "Model",
          tooltip: "The Claude model used for this scope. Project settings override user settings.",
          significance:
            "Opus = most capable, expensive. Sonnet = balanced default. Haiku = fast, cheap.",
          options: [
            { value: "", label: "(inherit / default)" },
            { value: "sonnet", label: "sonnet", description: "Balanced — recommended default" },
            { value: "haiku", label: "haiku", description: "Fast & cheap, good for routine tasks" },
            { value: "opus", label: "opus", description: "Most capable (now Opus 4.8)" },
            { value: "opusplan", label: "opusplan", description: "Opus while planning, Sonnet to execute" },
            { value: "claude-opus-4-8", label: "claude-opus-4-8 (pinned — newest)" },
            { value: "claude-sonnet-4-6", label: "claude-sonnet-4-6 (pinned)" },
            { value: "claude-opus-4-7", label: "claude-opus-4-7 (pinned)" },
            { value: "claude-haiku-4-5", label: "claude-haiku-4-5 (pinned)" },
          ],
        },
        {
          type: "select",
          key: "effortLevel",
          label: "Effort level",
          tooltip: "How much extended-thinking budget to use.",
          significance: "Higher = better reasoning but more tokens and slower.",
          options: [
            { value: "", label: "(default)" },
            { value: "low", label: "low" },
            { value: "medium", label: "medium" },
            { value: "high", label: "high" },
            { value: "xhigh", label: "xhigh" },
            { value: "max", label: "max" },
          ],
        },
        {
          type: "boolean",
          key: "alwaysThinkingEnabled",
          label: "Always-on extended thinking",
          tooltip: "Enable extended thinking on every prompt.",
          significance: "Better reasoning at the cost of more tokens. Off by default.",
        },
        {
          type: "boolean",
          key: "includeCoAuthoredBy",
          label: "Add `Co-Authored-By: Claude` to git commits",
          tooltip: "Append the Claude co-author footer to git commits Claude creates.",
          significance: "Turn off if you don't want commits attributed to Claude.",
        },
      ],
    },
    {
      type: "group",
      key: "permissions",
      label: "Permissions",
      tooltip:
        "Auto-approve, block, or always-ask patterns. Deny rules win over allow rules.",
      fields: [
        {
          type: "select",
          key: "permissions.defaultMode",
          label: "Default permission mode",
          tooltip: "How Claude handles tool requests by default.",
          significance:
            "`plan` is read-only; `acceptEdits` auto-approves edits but still asks for risky tools; `bypassPermissions` skips all prompts (only safe inside a sandbox).",
          options: [
            { value: "", label: "(default)" },
            { value: "default", label: "default — ask each time" },
            { value: "acceptEdits", label: "acceptEdits — auto-approve edits" },
            { value: "plan", label: "plan — read-only planning" },
            { value: "auto", label: "auto — ML-classified" },
            { value: "bypassPermissions", label: "bypassPermissions — skip all (dangerous)" },
          ],
        },
        {
          type: "list",
          key: "permissions.allow",
          label: "Allow (auto-approve)",
          tooltip:
            "Tools/patterns auto-approved without prompt. Format: Tool(pattern). E.g. Bash(npm run test *), Read(./src/**), WebFetch(domain:github.com).",
          significance:
            "Cuts permission prompts dramatically. Be precise — wildcards on Bash can be dangerous.",
          itemPlaceholder: "Bash(npm run *)",
          suggestions: [
            "Bash(npm run lint)",
            "Bash(npm run test *)",
            "Bash(git status)",
            "Bash(git diff *)",
            "Bash(git log *)",
            "Read(./src/**)",
            "WebFetch(domain:github.com)",
            "WebFetch(domain:docs.claude.com)",
          ],
        },
        {
          type: "list",
          key: "permissions.deny",
          label: "Deny (block)",
          tooltip:
            "Tools/patterns blocked completely. Deny takes precedence over allow. Use for credentials and destructive commands.",
          significance:
            "Strongest guardrail. Pair with sandbox — without sandbox, deny only blocks Claude's built-in tools, not arbitrary Bash.",
          itemPlaceholder: "Read(./.env)",
          suggestions: [
            "Read(./.env)",
            "Read(./.env.*)",
            "Read(./secrets/**)",
            "Read(~/.ssh/**)",
            "Read(~/.aws/**)",
            "Read(~/.gnupg/**)",
            "Read(~/.kube/**)",
            "Read(~/.docker/config.json)",
            "Read(~/.npmrc)",
            "Read(~/.git-credentials)",
            "Read(~/Library/Keychains/**)",
            "Bash(rm -rf *)",
            "Bash(curl *)",
            "Bash(wget *)",
            "Bash(git push --force *)",
            "Edit(~/.zshrc)",
            "Edit(~/.bashrc)",
          ],
        },
        {
          type: "list",
          key: "permissions.ask",
          label: "Ask (always confirm)",
          tooltip: "Tools/patterns that always prompt for confirmation.",
          significance: "Good middle ground for things you want oversight on but not blocked.",
          itemPlaceholder: "Bash(git push *)",
          suggestions: [
            "Bash(git push *)",
            "Bash(npm publish *)",
            "Bash(docker push *)",
            "Edit(/etc/**)",
          ],
        },
      ],
    },
    {
      type: "group",
      key: "env",
      label: "Environment variables",
      tooltip: "Env vars exported into every bash command and MCP server in this scope.",
      fields: [
        {
          type: "kv",
          key: "env",
          label: "Variables",
          tooltip: "Key/value pairs. Avoid putting secrets in committed scopes.",
          significance: "Useful for API keys, debug flags, project paths.",
          keyPlaceholder: "NODE_ENV",
          valuePlaceholder: "development",
        },
      ],
    },
    {
      type: "group",
      key: "statusLine_g",
      label: "Status line",
      tooltip: "Bottom-of-terminal widget that runs a shell command and renders its output.",
      fields: [
        {
          type: "select",
          key: "statusLine.type",
          label: "Type",
          tooltip: "`command` runs a shell command and renders stdout. Leave blank to disable.",
          options: [
            { value: "", label: "(disabled)" },
            { value: "command", label: "command" },
          ],
        },
        {
          type: "string",
          key: "statusLine.command",
          label: "Command",
          tooltip: "Absolute path to the script. Will be executed every refresh.",
          significance:
            "Popular pattern: show model, context %, cost, and 5-hour-quota bar. See ccstatusline / claude-code-statusline.",
          placeholder: "~/.claude/statusline.sh",
        },
        {
          type: "number",
          key: "statusLine.padding",
          label: "Padding",
          tooltip: "Left/right padding in characters.",
          default: 0,
        },
      ],
    },
    {
      type: "group",
      key: "session",
      label: "Session & memory",
      tooltip: "Lifecycle settings for sessions and persistent auto-memory.",
      fields: [
        {
          type: "number",
          key: "cleanupPeriodDays",
          label: "Cleanup period (days)",
          tooltip: "Delete session transcripts older than this many days. 0 to disable cleanup.",
          placeholder: "30",
          min: 0,
        },
        {
          type: "boolean",
          key: "autoMemoryEnabled",
          label: "Enable auto-memory",
          tooltip: "Let Claude write its own memory file as it learns about your project.",
          significance:
            "On by default. Turn off if you prefer to maintain CLAUDE.md by hand only.",
        },
        {
          type: "string",
          key: "outputStyle",
          label: "Output style",
          tooltip: "Name of an output style under ~/.claude/output-styles/ or .claude/output-styles/.",
          placeholder: "Default",
        },
        {
          type: "string",
          key: "theme",
          label: "Theme",
          tooltip: "Terminal color theme.",
          placeholder: "dark",
        },
      ],
    },
    {
      type: "group",
      key: "sandbox",
      label: "Sandbox",
      tooltip:
        "Filesystem & network isolation for Bash. Strongly recommended — pair with deny rules.",
      fields: [
        {
          type: "boolean",
          key: "sandbox.enabled",
          label: "Enable sandbox",
          tooltip: "Restrict Bash to specific paths and domains.",
          significance:
            "Without sandbox, deny rules don't block arbitrary Bash commands — only Claude's built-in tools.",
        },
        {
          type: "list",
          key: "sandbox.filesystem.allowWrite",
          label: "Filesystem · write-allowed paths",
          tooltip: "Bash can write to these paths only. Outside paths are read-only or denied.",
          itemPlaceholder: "/tmp/build",
        },
        {
          type: "list",
          key: "sandbox.filesystem.denyRead",
          label: "Filesystem · read-blocked paths",
          tooltip: "Bash cannot read these paths. Use for credentials.",
          itemPlaceholder: "~/.aws/credentials",
        },
        {
          type: "list",
          key: "sandbox.network.allowedDomains",
          label: "Network · allowed domains",
          tooltip: "Bash can only reach these domains. Blocks exfiltration.",
          itemPlaceholder: "github.com",
        },
      ],
    },
    {
      type: "group",
      key: "hooks_group",
      label: "Hooks",
      tooltip:
        "Run shell commands on lifecycle events. See the dedicated Hooks tool inside this editor (below) for a guided form.",
      fields: [
        {
          type: "string",
          key: "_hooksNote",
          label: "Note",
          tooltip: "Hooks are managed via the Hooks panel below.",
          multiline: true,
          rows: 2,
          placeholder:
            "Hooks: edit using the Hooks builder. Always use absolute paths or $CLAUDE_PROJECT_DIR; exit code 2 = block; pipe errors to stderr.",
        },
      ],
    },
    {
      type: "group",
      key: "telemetry_misc",
      label: "Telemetry & misc",
      tooltip: "Smaller knobs.",
      fields: [
        {
          type: "boolean",
          key: "telemetry.disableTelemetry",
          label: "Disable anonymous telemetry",
          tooltip: "Opt out of usage analytics sent to Anthropic. Does not affect API usage.",
        },
        {
          type: "boolean",
          key: "awsAuthRefresh",
          label: "Auto-refresh AWS credentials",
          tooltip: "For long sessions using AWS SigV4.",
        },
        {
          type: "list",
          key: "additionalDirectories",
          label: "Additional working directories",
          tooltip: "Extra paths Claude can read outside the current cwd.",
          itemPlaceholder: "~/shared-config",
        },
        {
          type: "list",
          key: "claudeMdExcludes",
          label: "CLAUDE.md excludes",
          tooltip: "Glob patterns of CLAUDE.md files to ignore from ancestor directories.",
          itemPlaceholder: "**/monorepo/CLAUDE.md",
        },
      ],
    },
  ],
};

export type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "UserPromptSubmit"
  | "SessionStart"
  | "Stop"
  | "Notification"
  | "PreCompact"
  | "SubagentStop";

export const hookEvents: { value: HookEvent; label: string; tooltip: string }[] = [
  {
    value: "PreToolUse",
    label: "PreToolUse",
    tooltip: "Before any tool runs. Use to block, validate, or audit.",
  },
  {
    value: "PostToolUse",
    label: "PostToolUse",
    tooltip: "After a tool runs successfully. Use to lint, format, log.",
  },
  {
    value: "UserPromptSubmit",
    label: "UserPromptSubmit",
    tooltip: "When the user submits a prompt. Use to validate or enrich.",
  },
  {
    value: "SessionStart",
    label: "SessionStart",
    tooltip: "Session begins or resumes. Load context, set env.",
  },
  {
    value: "Stop",
    label: "Stop",
    tooltip: "Claude finishes a turn. Post-process or notify.",
  },
  {
    value: "Notification",
    label: "Notification",
    tooltip: "Claude sends a notification. Filter, log, forward.",
  },
  {
    value: "PreCompact",
    label: "PreCompact",
    tooltip: "Before context compaction. Save state.",
  },
  {
    value: "SubagentStop",
    label: "SubagentStop",
    tooltip: "Subagent finishes. Aggregate results.",
  },
];
