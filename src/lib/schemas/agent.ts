import type { Schema } from "./types";

export const agentSchema: Schema = {
  id: "agent",
  title: "Subagent",
  description:
    "One file under agents/. Frontmatter defines the agent; body is the system prompt.",
  format: "markdown",
  fields: [
    {
      type: "string",
      key: "name",
      label: "Name",
      tooltip: "Unique identifier. Use kebab-case. This becomes the agent invocation name.",
      placeholder: "code-reviewer",
    },
    {
      type: "string",
      key: "description",
      label: "Description",
      tooltip:
        "When should this agent be invoked? Claude reads this to decide auto-delegation.",
      placeholder: "Reviews code for quality, security, and performance issues.",
      multiline: true,
      rows: 2,
    },
    {
      type: "select",
      key: "model",
      label: "Model",
      tooltip: "Override which Claude model this agent runs on.",
      options: [
        { value: "", label: "(default subagent model)" },
        { value: "inherit", label: "inherit — same model as the main conversation" },
        { value: "sonnet", label: "sonnet — Sonnet 5.5, balanced" },
        { value: "haiku", label: "haiku — Haiku 4.5, fast & cheap" },
        { value: "opus", label: "opus — Opus 5.5, most capable everyday model" },
        { value: "fable", label: "fable — Fable 5.1, premium" },
        { value: "claude-opus-5-5", label: "claude-opus-5-5 (pinned)" },
        { value: "claude-sonnet-5-5", label: "claude-sonnet-5-5 (pinned)" },
      ],
    },
    {
      type: "select",
      key: "effort",
      label: "Effort",
      tooltip: "Reasoning effort. Higher = slower & more thorough.",
      options: [
        { value: "", label: "(inherit)" },
        { value: "low", label: "low" },
        { value: "medium", label: "medium" },
        { value: "high", label: "high" },
        { value: "xhigh", label: "xhigh" },
        { value: "max", label: "max" },
      ],
    },
    {
      type: "select",
      key: "permissionMode",
      label: "Permission mode",
      tooltip: "How this agent handles tool permissions when it runs.",
      options: [
        { value: "", label: "(inherit)" },
        { value: "default", label: "default — ask each time" },
        { value: "manual", label: "manual — alias for default" },
        { value: "acceptEdits", label: "acceptEdits — auto-approve edits" },
        { value: "plan", label: "plan — read-only planning" },
        { value: "auto", label: "auto — ML-classified" },
        { value: "dontAsk", label: "dontAsk — never prompt, deny instead" },
        { value: "bypassPermissions", label: "bypassPermissions — skip all (dangerous)" },
      ],
    },
    {
      type: "list",
      key: "tools",
      label: "Allowed tools",
      tooltip:
        "Restrict to these tools only. Leave empty to inherit every tool available to subagents. Agent(name) entries limit which subagents it may spawn.",
      itemPlaceholder: "Read",
      suggestions: ["Read", "Grep", "Glob", "WebFetch", "WebSearch", "Edit", "Write", "Bash"],
    },
    {
      type: "list",
      key: "disallowedTools",
      label: "Disallowed tools",
      tooltip: "Tools removed from the inherited or specified list. A specifier such as Bash(git push *) still removes the whole tool.",
      itemPlaceholder: "Edit",
    },
    {
      type: "number",
      key: "maxTurns",
      label: "Max turns",
      tooltip: "Cap agentic turns. At the limit the output is returned marked as partial and Claude can resume the agent.",
      placeholder: "20",
      min: 1,
    },
    {
      type: "select",
      key: "isolation",
      label: "Isolation",
      tooltip:
        "`worktree` runs the agent in a temporary git worktree branched from your default branch — best for code-writing agents.",
      options: [
        { value: "", label: "(none — same workspace)" },
        { value: "worktree", label: "worktree" },
      ],
    },
    {
      type: "list",
      key: "skills",
      label: "Preloaded skills",
      tooltip: "Skill names loaded into this agent's context when it starts.",
      itemPlaceholder: "code-review",
    },
    {
      type: "select",
      key: "memory",
      label: "Persistent memory",
      tooltip: "Give the agent a persistent memory scope that survives across runs.",
      options: [
        { value: "", label: "(none)" },
        { value: "user", label: "user — shared across all projects" },
        { value: "project", label: "project — shared in this repo" },
        { value: "local", label: "local — this machine + repo only" },
      ],
    },
    {
      type: "boolean",
      key: "background",
      label: "Run in background",
      tooltip: "Keep this agent in the background even when Claude asks to run it in the foreground.",
    },
    {
      type: "boolean",
      key: "omitClaudeMd",
      label: "Launch without CLAUDE.md",
      tooltip:
        "Start the agent without the user, project and local CLAUDE.md files. Use for agents that get everything they need from the delegation prompt.",
      significance: "Saves context on every spawn. Managed policy files still load.",
    },
    {
      type: "json",
      key: "mcpServers",
      label: "MCP servers",
      tooltip:
        "MCP servers available to this agent: names of already-configured servers, or inline definitions keyed by server name.",
      placeholder: '["slack", { "db": { "type": "stdio", "command": "npx", "args": ["-y", "@acme/db-mcp"] } }]',
      rows: 3,
    },
    {
      type: "json",
      key: "hooks",
      label: "Hooks (scoped to this agent)",
      tooltip:
        "Lifecycle hooks that run only while this agent is active — same format as settings.json hooks. A Stop hook here becomes SubagentStop.",
      placeholder:
        '{ "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "./scripts/validate.sh" }] }] }',
      rows: 4,
    },
    {
      type: "string",
      key: "initialPrompt",
      label: "Initial prompt (when run as the main agent)",
      tooltip:
        "Auto-submitted as the first user turn when this agent runs as the main session agent (--agent or the `agent` setting).",
      multiline: true,
      rows: 2,
      placeholder: "/status then summarise what changed since yesterday",
    },
    {
      type: "select",
      key: "experimental.cacheTtl",
      label: "Prompt cache lifetime (experimental)",
      tooltip: "Prompt cache lifetime for this agent's requests.",
      options: [
        { value: "", label: "(default)" },
        { value: "5m", label: "5m" },
        { value: "1h", label: "1h" },
      ],
    },
    {
      type: "select",
      key: "color",
      label: "Color",
      tooltip: "Accent color for this agent in the UI.",
      options: [
        { value: "", label: "(auto)" },
        { value: "red", label: "red" },
        { value: "blue", label: "blue" },
        { value: "green", label: "green" },
        { value: "yellow", label: "yellow" },
        { value: "purple", label: "purple" },
        { value: "orange", label: "orange" },
        { value: "pink", label: "pink" },
        { value: "cyan", label: "cyan" },
      ],
    },
    {
      type: "string",
      key: "_body",
      label: "System prompt (body)",
      tooltip:
        "Everything below the frontmatter. The agent's persona and instructions.",
      multiline: true,
      rows: 14,
      placeholder:
        "You are an expert code reviewer. Analyze the diff for:\n- Bugs and edge cases\n- Security issues\n- Performance concerns\n- Style and readability",
    },
  ],
};
