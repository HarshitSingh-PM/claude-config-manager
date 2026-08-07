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
        { value: "", label: "(inherit)" },
        { value: "sonnet", label: "sonnet — Sonnet 5, balanced" },
        { value: "haiku", label: "haiku — Haiku 4.5, fast & cheap" },
        { value: "opus", label: "opus — Opus 5, most capable" },
        { value: "fable", label: "fable — Fable 5, premium" },
        { value: "inherit", label: "inherit — same model as the main conversation" },
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
        "Restrict to these tools only. Overrides global permissions for this agent.",
      itemPlaceholder: "Read",
      suggestions: ["Read", "Grep", "Glob", "WebFetch", "WebSearch", "Edit", "Write", "Bash"],
    },
    {
      type: "list",
      key: "disallowedTools",
      label: "Disallowed tools",
      tooltip: "Tools this agent cannot use even if globally allowed.",
      itemPlaceholder: "Edit",
    },
    {
      type: "number",
      key: "maxTurns",
      label: "Max turns",
      tooltip: "Cap conversation turns to prevent runaway agents.",
      placeholder: "20",
      min: 1,
    },
    {
      type: "select",
      key: "isolation",
      label: "Isolation",
      tooltip:
        "`worktree` runs the agent in a separate git worktree — best for code-writing agents.",
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
      tooltip: "Run this agent as a background task by default (on by default in Claude Code 2.1.198+).",
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
