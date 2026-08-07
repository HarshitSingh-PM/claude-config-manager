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
            { value: "default", label: "default", description: "Your account's default (Opus 5 on Max/Enterprise, Sonnet 5 on Pro)" },
            { value: "best", label: "best", description: "The most capable model available to you (Fable 5, else Opus 5)" },
            { value: "sonnet", label: "sonnet", description: "Balanced — recommended default (now Sonnet 5)" },
            { value: "haiku", label: "haiku", description: "Fast & cheap, good for routine tasks (Haiku 4.5)" },
            { value: "opus", label: "opus", description: "Most capable everyday model (now Opus 5)" },
            { value: "opusplan", label: "opusplan", description: "Opus while planning, Sonnet to execute" },
            { value: "fable", label: "fable", description: "Highest capability, premium cost (Fable 5)" },
            { value: "sonnet[1m]", label: "sonnet[1m]", description: "Sonnet 5 with a 1M-token context window" },
            { value: "opus[1m]", label: "opus[1m]", description: "Opus 5 with a 1M-token context window" },
            { value: "claude-fable-5", label: "claude-fable-5 (pinned — most capable)" },
            { value: "claude-opus-5", label: "claude-opus-5 (pinned)" },
            { value: "claude-sonnet-5", label: "claude-sonnet-5 (pinned)" },
            { value: "claude-haiku-4-5", label: "claude-haiku-4-5 (pinned)" },
            { value: "claude-opus-4-8", label: "claude-opus-4-8 (pinned — previous gen)" },
            { value: "claude-opus-4-7", label: "claude-opus-4-7 (pinned — previous gen)" },
            { value: "claude-sonnet-4-6", label: "claude-sonnet-4-6 (pinned — previous gen)" },
          ],
        },
        {
          type: "select",
          key: "effortLevel",
          label: "Effort level",
          tooltip: "Persisted reasoning effort. `xhigh` is the recommended setting for hard coding work.",
          significance: "Higher = better reasoning but more tokens and slower. Adjust live with /effort.",
          options: [
            { value: "", label: "(default)" },
            { value: "low", label: "low" },
            { value: "medium", label: "medium" },
            { value: "high", label: "high" },
            { value: "xhigh", label: "xhigh" },
            { value: "max", label: "max — deepest reasoning, most tokens" },
          ],
        },
        {
          type: "select",
          key: "advisorModel",
          label: "Advisor model",
          tooltip: "A stronger model the main model can consult mid-task for strategic guidance.",
          significance: "Pairs a fast executor with a smarter advisor — quality boost without running everything on the big model.",
          options: [
            { value: "", label: "(off)" },
            { value: "fable", label: "fable — Fable 5" },
            { value: "opus", label: "opus — Opus 5" },
          ],
        },
        {
          type: "list",
          key: "availableModels",
          label: "Available models",
          tooltip: "Restrict which models appear in the model picker (aliases or full IDs).",
          significance: "Useful for teams standardizing on specific models or controlling cost.",
          itemPlaceholder: "sonnet",
        },
        {
          type: "list",
          key: "fallbackModel",
          label: "Fallback models",
          tooltip: "Models tried in order when the primary is unavailable (up to 3).",
          significance: "Keeps sessions going through rate limits or provider outages.",
          itemPlaceholder: "claude-sonnet-5",
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
          significance:
            "Turn off if you don't want commits attributed to Claude. Note: newer Claude Code prefers the `attribution` object for finer control; this key still works.",
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
      key: "mcp_group",
      label: "MCP servers",
      tooltip: "Control which Model Context Protocol servers from .mcp.json are approved.",
      fields: [
        {
          type: "boolean",
          key: "enableAllProjectMcpServers",
          label: "Auto-approve all project MCP servers",
          tooltip: "Approve every server in this project's .mcp.json without prompting.",
          significance: "Convenient for trusted repos; leave off if you vet servers individually.",
        },
        {
          type: "list",
          key: "enabledMcpjsonServers",
          label: "Approved .mcp.json servers",
          tooltip: "Names of specific .mcp.json servers to approve.",
          itemPlaceholder: "playwright",
        },
        {
          type: "list",
          key: "disabledMcpjsonServers",
          label: "Rejected .mcp.json servers",
          tooltip: "Names of specific .mcp.json servers to reject.",
          itemPlaceholder: "some-untrusted-server",
        },
        {
          type: "list",
          key: "allowedMcpServers",
          label: "Allowed MCP servers (allowlist)",
          tooltip: "If set, only these MCP servers may be used at all — from any source.",
          itemPlaceholder: "github",
        },
        {
          type: "list",
          key: "deniedMcpServers",
          label: "Denied MCP servers (blocklist)",
          tooltip: "MCP servers that may never be used, regardless of other settings.",
          itemPlaceholder: "some-untrusted-server",
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
          key: "autoMemoryDirectory",
          label: "Auto-memory directory",
          tooltip: "Custom directory for auto-memory storage. Leave blank for the default.",
          placeholder: "~/.claude/memory",
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
        {
          type: "boolean",
          key: "tui",
          label: "New TUI renderer",
          tooltip: "Use the newer terminal UI renderer (v2.1.188+).",
        },
        {
          type: "boolean",
          key: "spinnerTipsEnabled",
          label: "Spinner tips",
          tooltip: "Show rotating tips in the working spinner.",
        },
        {
          type: "boolean",
          key: "disableBundledSkills",
          label: "Disable bundled skills",
          tooltip: "Hide the skills that ship with Claude Code (/code-review, /doctor, …).",
        },
        {
          type: "boolean",
          key: "disableSkillShellExecution",
          label: "Disable skill shell execution",
          tooltip: "Prevent skills from running shell commands during expansion.",
          significance: "A hardening option when using third-party skills you haven't audited.",
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
        "Run shell commands on lifecycle events. Use the Hooks builder below for a guided form — always use absolute paths or $CLAUDE_PROJECT_DIR; exit code 2 = block; pipe errors to stderr.",
      fields: [
        {
          type: "boolean",
          key: "disableAllHooks",
          label: "Disable all hooks",
          tooltip: "Kill switch — ignore every configured hook in this scope.",
        },
        {
          type: "list",
          key: "allowedHttpHookUrls",
          label: "Allowed HTTP hook URLs",
          tooltip: "URL patterns that http-type hook handlers are allowed to call.",
          itemPlaceholder: "https://hooks.internal.example.com/*",
        },
      ],
    },
    {
      type: "group",
      key: "autonomy_group",
      label: "Autonomy & agents",
      tooltip:
        "Settings behind Claude Code's autonomous features. /goal (work until a condition holds) and /loop (recurring/scheduled runs) are interactive commands, not settings — these toggles govern the machinery around them.",
      fields: [
        {
          type: "boolean",
          key: "autoCompactEnabled",
          label: "Auto-compact at context limit",
          tooltip: "Automatically summarize/compact the conversation when it approaches the context limit.",
          significance: "On by default. Keeps long /goal and /loop runs going without manual /compact.",
        },
        {
          type: "number",
          key: "autoCompactWindow",
          label: "Auto-compact window (tokens)",
          tooltip: "Context size at which auto-compact triggers (100k–1M).",
          placeholder: "200000",
          min: 100000,
        },
        {
          type: "boolean",
          key: "awaySummaryEnabled",
          label: "Away summaries",
          tooltip: "Summarize what happened while you were away from a long-running session.",
        },
        {
          type: "select",
          key: "crossSessionInbound",
          label: "Cross-session messages",
          tooltip: "What to do when another Claude session sends this one a message.",
          significance: "`hold` queues messages for your review; `refuse` isolates the session.",
          options: [
            { value: "", label: "(default)" },
            { value: "accept", label: "accept — deliver immediately" },
            { value: "hold", label: "hold — queue for review" },
            { value: "refuse", label: "refuse — block inbound messages" },
          ],
        },
        {
          type: "select",
          key: "dialogExpiry",
          label: "Dialog expiry",
          tooltip: "How long permission dialogs wait before expiring.",
          options: [
            { value: "", label: "(default)" },
            { value: "60s", label: "60s" },
            { value: "5m", label: "5m" },
            { value: "10m", label: "10m" },
            { value: "never", label: "never" },
          ],
        },
        {
          type: "boolean",
          key: "fileCheckpointingEnabled",
          label: "File checkpointing (/rewind)",
          tooltip: "Snapshot files before edits so you can /rewind to an earlier state.",
          significance: "On by default. A safety net for autonomous, multi-edit runs.",
        },
        {
          type: "boolean",
          key: "disableAgentView",
          label: "Disable agent view & background agents",
          tooltip: "Turn off background agents and the `claude agents` view that shows running/blocked/done sessions.",
          significance: "Leave off (i.e. keep agent view enabled) unless you don't use background sessions.",
        },
        {
          type: "boolean",
          key: "disableWorkflows",
          label: "Disable dynamic workflows",
          tooltip: "Disable Claude-authored workflow scripts that orchestrate many subagents.",
        },
        {
          type: "boolean",
          key: "disableRemoteControl",
          label: "Disable Remote Control",
          tooltip: "Turn off driving this session from the mobile/remote app.",
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
          type: "select",
          key: "editorMode",
          label: "Editor mode",
          tooltip: "Key bindings for the input box.",
          options: [
            { value: "", label: "(default)" },
            { value: "normal", label: "normal" },
            { value: "vim", label: "vim" },
          ],
        },
        {
          type: "select",
          key: "defaultShell",
          label: "Default shell",
          tooltip: "Shell used for input-box commands.",
          options: [
            { value: "", label: "(default)" },
            { value: "bash", label: "bash" },
            { value: "powershell", label: "powershell" },
          ],
        },
        {
          type: "select",
          key: "autoUpdatesChannel",
          label: "Auto-updates channel",
          tooltip: "Which release channel Claude Code updates from.",
          options: [
            { value: "", label: "(default)" },
            { value: "stable", label: "stable" },
            { value: "latest", label: "latest" },
          ],
        },
        {
          type: "string",
          key: "language",
          label: "Response language",
          tooltip: "Claude's preferred response language (e.g. en, es, ja).",
          placeholder: "en",
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
  | "PostToolUseFailure"
  | "PostToolBatch"
  | "PermissionRequest"
  | "PermissionDenied"
  | "UserPromptSubmit"
  | "UserPromptExpansion"
  | "SessionStart"
  | "SessionEnd"
  | "Setup"
  | "Stop"
  | "StopFailure"
  | "Notification"
  | "PreCompact"
  | "PostCompact"
  | "SubagentStart"
  | "SubagentStop"
  | "TeammateIdle"
  | "TaskCreated"
  | "TaskCompleted"
  | "FileChanged"
  | "CwdChanged"
  | "DirectoryAdded"
  | "WorktreeCreate"
  | "WorktreeRemove"
  | "ConfigChange"
  | "InstructionsLoaded"
  | "MessageDisplay"
  | "Elicitation"
  | "ElicitationResult";

export const hookEvents: { value: HookEvent; label: string; tooltip: string }[] = [
  {
    value: "PreToolUse",
    label: "PreToolUse",
    tooltip: "Before any tool runs. Can allow, deny, ask, or defer the call.",
  },
  {
    value: "PostToolUse",
    label: "PostToolUse",
    tooltip: "After a tool runs successfully. Use to lint, format, log.",
  },
  {
    value: "PostToolUseFailure",
    label: "PostToolUseFailure",
    tooltip: "After a tool call fails. React to or block on errors.",
  },
  {
    value: "PostToolBatch",
    label: "PostToolBatch",
    tooltip: "After a batch of parallel tool calls completes.",
  },
  {
    value: "PermissionRequest",
    label: "PermissionRequest",
    tooltip: "When a permission dialog would show. Auto-allow or deny it.",
  },
  {
    value: "PermissionDenied",
    label: "PermissionDenied",
    tooltip: "After a permission was denied. Can request a retry.",
  },
  {
    value: "UserPromptSubmit",
    label: "UserPromptSubmit",
    tooltip: "When the user submits a prompt. Use to validate or enrich.",
  },
  {
    value: "UserPromptExpansion",
    label: "UserPromptExpansion",
    tooltip: "When a slash command expands. Matcher is the command name.",
  },
  {
    value: "SessionStart",
    label: "SessionStart",
    tooltip: "Session begins/resumes/clears/forks. Load context, set env.",
  },
  {
    value: "SessionEnd",
    label: "SessionEnd",
    tooltip: "Session ends. Clean up, flush logs, persist state.",
  },
  {
    value: "Setup",
    label: "Setup",
    tooltip: "Repo setup/maintenance entry points (init | maintenance).",
  },
  {
    value: "Stop",
    label: "Stop",
    tooltip: "Claude finishes a turn. Post-process, notify, or block to continue.",
  },
  {
    value: "StopFailure",
    label: "StopFailure",
    tooltip: "A turn ended with an error. Matcher is the error type.",
  },
  {
    value: "Notification",
    label: "Notification",
    tooltip: "Claude sends a notification (permission_prompt, idle_prompt, …).",
  },
  {
    value: "PreCompact",
    label: "PreCompact",
    tooltip: "Before context compaction (manual | auto). Save state.",
  },
  {
    value: "PostCompact",
    label: "PostCompact",
    tooltip: "After context compaction (manual | auto). Re-inject context.",
  },
  {
    value: "SubagentStart",
    label: "SubagentStart",
    tooltip: "A subagent starts. Matcher is the agent type name.",
  },
  {
    value: "SubagentStop",
    label: "SubagentStop",
    tooltip: "Subagent finishes. Aggregate results.",
  },
  {
    value: "TeammateIdle",
    label: "TeammateIdle",
    tooltip: "An agent-team teammate goes idle. Keep it working or let it rest.",
  },
  {
    value: "TaskCreated",
    label: "TaskCreated",
    tooltip: "A task is created on the task list.",
  },
  {
    value: "TaskCompleted",
    label: "TaskCompleted",
    tooltip: "A task is marked completed. Verify or block completion.",
  },
  {
    value: "FileChanged",
    label: "FileChanged",
    tooltip: "A watched file changed. Matcher is the filename pattern.",
  },
  {
    value: "CwdChanged",
    label: "CwdChanged",
    tooltip: "The working directory changed.",
  },
  {
    value: "DirectoryAdded",
    label: "DirectoryAdded",
    tooltip: "A directory was added to the session (slash command or repo root).",
  },
  {
    value: "WorktreeCreate",
    label: "WorktreeCreate",
    tooltip: "A worktree is being created. Return a path to control placement.",
  },
  {
    value: "WorktreeRemove",
    label: "WorktreeRemove",
    tooltip: "A worktree is being removed. Clean up.",
  },
  {
    value: "ConfigChange",
    label: "ConfigChange",
    tooltip: "Settings/skills changed mid-session. Audit or block.",
  },
  {
    value: "InstructionsLoaded",
    label: "InstructionsLoaded",
    tooltip: "CLAUDE.md / instructions were loaded. Matcher is the load reason.",
  },
  {
    value: "MessageDisplay",
    label: "MessageDisplay",
    tooltip: "Before a message renders. Can replace the displayed content.",
  },
  {
    value: "Elicitation",
    label: "Elicitation",
    tooltip: "An MCP server asks the user for input. Accept, decline, or cancel.",
  },
  {
    value: "ElicitationResult",
    label: "ElicitationResult",
    tooltip: "After the user answers an MCP elicitation.",
  },
];
