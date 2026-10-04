import type { Schema } from "./types";

export const commandSchema: Schema = {
  id: "command",
  title: "Slash command",
  description:
    "A user-invocable command. Becomes /name. Use $ARGUMENTS to receive user-supplied text.",
  format: "markdown",
  fields: [
    {
      type: "string",
      key: "name",
      label: "Name",
      tooltip: "Command name. Will be available as /name. Use kebab-case.",
      placeholder: "review",
    },
    {
      type: "string",
      key: "description",
      label: "Description",
      tooltip: "Shown in the / menu and used to decide when to auto-invoke.",
      placeholder: "Review the current diff and surface issues.",
      multiline: true,
      rows: 2,
    },
    {
      type: "string",
      key: "argument-hint",
      label: "Argument hint",
      tooltip: "Placeholder shown in the / menu after the command.",
      placeholder: "[focus-area]",
    },
    {
      type: "list",
      key: "allowed-tools",
      label: "Pre-approved tools",
      tooltip:
        "These tools won't prompt while this command is running.",
      itemPlaceholder: "Bash(git diff *)",
    },
    {
      type: "select",
      key: "model",
      label: "Model override",
      tooltip: "Use a specific model for just this command.",
      options: [
        { value: "", label: "(inherit)" },
        { value: "inherit", label: "inherit — keep the active model" },
        { value: "sonnet", label: "sonnet" },
        { value: "haiku", label: "haiku" },
        { value: "opus", label: "opus" },
        { value: "fable", label: "fable" },
      ],
    },
    {
      type: "select",
      key: "effort",
      label: "Effort override",
      tooltip: "Reasoning level while this command is active.",
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
      type: "list",
      key: "disallowed-tools",
      label: "Disallowed tools",
      tooltip: "Tools removed from Claude's pool while this command is active.",
      itemPlaceholder: "AskUserQuestion",
    },
    {
      type: "select",
      key: "context",
      label: "Execution context",
      tooltip: "`fork` runs the command in an isolated subagent with its own context window.",
      options: [
        { value: "", label: "(same context)" },
        { value: "fork", label: "fork (isolated subagent)" },
      ],
    },
    {
      type: "string",
      key: "agent",
      label: "Subagent to use (with context: fork)",
      tooltip: "Which subagent type to spawn — a built-in (Explore, Plan) or one of your own.",
      placeholder: "Explore",
    },
    {
      type: "list",
      key: "arguments",
      label: "Named arguments",
      tooltip: "Names for positional arguments, used as $name in the body.",
      itemPlaceholder: "branch",
    },
    {
      type: "boolean",
      key: "disable-model-invocation",
      label: "Manual only (Claude cannot auto-invoke)",
      tooltip:
        "Prevent Claude from auto-invoking. Use for side-effectful commands like /deploy.",
    },
    {
      type: "string",
      key: "_body",
      label: "Command body",
      tooltip:
        "Markdown body. Use $ARGUMENTS for user-supplied args. Use ! prefix lines to run bash.",
      multiline: true,
      rows: 14,
      placeholder:
        "Review the current diff:\n\n!`git diff --staged`\n\nFocus area: $ARGUMENTS\n\nSurface bugs, security issues, and unclear naming.",
    },
  ],
};
