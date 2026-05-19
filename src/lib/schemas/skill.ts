import type { Schema } from "./types";

// Skill SKILL.md frontmatter fields, per the Claude Code docs.
// https://code.claude.com/docs/en/skills
//
// Skills live under a directory (one folder per skill, with a SKILL.md inside).
// Folder name = skill name = how Claude invokes it (e.g. /code-review).

export const skillSchema: Schema = {
  id: "skill",
  title: "Skill",
  description:
    "SKILL.md frontmatter + body. Each skill lives in its own subdirectory under skills/. Optional sibling files (template.md, examples.md, reference.md, scripts/) extend the skill.",
  format: "markdown",
  fields: [
    {
      type: "string",
      key: "name",
      label: "Name",
      tooltip: "Skill identifier. Matches the directory name. Becomes /name in the slash-command menu.",
      placeholder: "code-review",
    },
    {
      type: "string",
      key: "description",
      label: "Description",
      tooltip:
        "Used by Claude to decide when to auto-invoke this skill. Combined with `when_to_use` and capped at ~1,536 chars total.",
      placeholder: "Reviews code for quality, security, and performance.",
      multiline: true,
      rows: 2,
    },
    {
      type: "string",
      key: "when_to_use",
      label: "When to use (extra hints)",
      tooltip:
        "Appended to `description`. Helps Claude pick the right skill when several are eligible.",
      placeholder: "When reviewing a PR diff or checking new code before commit.",
      multiline: true,
      rows: 2,
    },
    {
      type: "boolean",
      key: "disable-model-invocation",
      label: "Manual only (Claude cannot auto-invoke)",
      tooltip:
        "If true, Claude will never auto-invoke this skill — only the user can fire it via the / menu.",
      significance:
        "Set on side-effectful skills like /deploy where you really want a human decision.",
    },
    {
      type: "boolean",
      key: "user-invocable",
      label: "Show in / menu",
      tooltip:
        "If false, the skill is hidden from the / menu but Claude can still auto-invoke it.",
      default: true,
    },
    {
      type: "list",
      key: "allowed-tools",
      label: "Pre-approved tools (don't prompt while active)",
      tooltip:
        "These tools won't trigger a permission prompt while this skill is running.",
      itemPlaceholder: "Read",
      suggestions: ["Read", "Grep", "Glob", "WebFetch", "WebSearch", "Edit", "Write", "Bash"],
    },
    {
      type: "select",
      key: "model",
      label: "Model override",
      tooltip: "Use a different Claude model for this skill (otherwise inherits the session).",
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
      label: "Effort override",
      tooltip: "Reasoning level for this skill. Higher = slower, more thorough.",
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
      key: "context",
      label: "Execution context",
      tooltip:
        "`fork` runs the skill in an isolated subagent with its own context window — protects the main context from being polluted.",
      options: [
        { value: "", label: "(same context)" },
        { value: "fork", label: "fork (isolated subagent)" },
      ],
    },
    {
      type: "string",
      key: "agent",
      label: "Subagent to use (with context: fork)",
      tooltip:
        "Which subagent type to spawn. Can be a built-in (Explore, Plan) or one of your own agents/ entries.",
      placeholder: "Explore",
    },
    {
      type: "list",
      key: "paths",
      label: "Conditional loading: paths",
      tooltip:
        "Glob patterns. Skill only loads when Claude is working with matching files. Saves context budget.",
      itemPlaceholder: "src/**/*.ts",
    },
    {
      type: "list",
      key: "arguments",
      label: "Named arguments",
      tooltip:
        "Define placeholders ($name, $target, etc.) the user fills in when invoking the skill.",
      itemPlaceholder: "branch",
    },
    {
      type: "string",
      key: "argument-hint",
      label: "Argument hint (for / menu)",
      tooltip: "Shown in the slash-command autocomplete after the name.",
      placeholder: "[branch] [environment]",
    },
    {
      type: "select",
      key: "shell",
      label: "Shell (for inline `!cmd` blocks)",
      tooltip: "Which shell to use for inline command execution. bash is the default.",
      options: [
        { value: "", label: "bash (default)" },
        { value: "powershell", label: "powershell" },
      ],
    },
    {
      type: "string",
      key: "_body",
      label: "Body",
      tooltip:
        "The prompt Claude executes when this skill runs. Use $ARGUMENTS / named args. Use !cmd lines to run shell. @path/to/file to include other files.",
      multiline: true,
      rows: 16,
      placeholder:
        "Review the staged diff. Focus area: $ARGUMENTS\n\n!`git diff --staged`\n\nFor each issue, output:\n- Severity (blocker / major / nit)\n- file:line\n- one-sentence why\n- concrete fix",
    },
  ],
};
