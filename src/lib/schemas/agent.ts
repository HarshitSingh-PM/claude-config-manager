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
        { value: "sonnet", label: "sonnet" },
        { value: "haiku", label: "haiku" },
        { value: "opus", label: "opus" },
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
