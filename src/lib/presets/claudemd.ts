export type Preset = {
  id: string;
  title: string;
  source: string;
  description: string;
  body: string;
};

export const claudeMdPresets: Preset[] = [
  {
    id: "karpathy-4-rules",
    title: "Karpathy — 4 rules",
    source: "Andrej Karpathy CLAUDE.md (trending GitHub gist)",
    description: "Four blunt slogans. Short and high-signal.",
    body: `# Working rules

- Don't assume. Don't hide confusion. Surface tradeoffs.
- Minimum code that solves the problem. Nothing speculative.
- Touch only what you must. Clean up only your own mess.
- Define success criteria. Loop until verified.
`,
  },
  {
    id: "humanlayer-skeleton",
    title: "HumanLayer — ≤60 line skeleton",
    source: "humanlayer.dev/blog/writing-a-good-claude-md",
    description: "WHY / WHAT / HOW. Pruned. Delegate detail to agent_docs/.",
    body: `# Project

## WHY
<one-paragraph: what this project exists to do, who uses it, what success looks like>

## WHAT
- Stack: <languages, frameworks, package manager>
- Entry points: <main script / endpoints>
- Structure overview: <top-level dirs>

## HOW
- Read @agent_docs/building_the_project.md before changing build setup
- Read @agent_docs/code_conventions.md before writing new code
- Read @agent_docs/running_tests.md before adding tests
- Read @agent_docs/service_architecture.md for system overview

## Hard rules
- Never push to main directly. Open a PR.
- Never commit secrets. Use env vars.
- Don't use this file as a linter — hooks do that.
`,
  },
  {
    id: "trail-of-bits-config",
    title: "Trail of Bits — security defaults",
    source: "github.com/trailofbits/claude-code-config",
    description: "Security-first opinions: pinned toolchain, anti-rationalization, replace-don't-deprecate.",
    body: `# Engineering rules

## No speculation
- No speculative features.
- No premature abstraction. Three similar lines beats a wrong abstraction.
- Replace, don't deprecate. If something is unused, delete it.

## Toolchain (pinned)
- Python: uv + ruff + ty (or mypy)
- Node: oxlint + vitest
- Rust: clippy + cargo-deny

## Anti-rationalization
- If a test fails, fix the code or fix the test — never silently disable.
- If a type error appears, fix the underlying issue — never add \`any\` or \`# type: ignore\`.
- If you can't reproduce a bug locally, say so and ask, do not guess.

## Surgical edits
- Touch only what the task requires.
- One concern per commit.
- No drive-by refactors unless explicitly asked.
`,
  },
  {
    id: "minimal-personal",
    title: "Minimal — personal defaults",
    source: "Built-in",
    description: "Tiny personal CLAUDE.md to drop in fresh.",
    body: `# Personal preferences

- Be concise. Skip filler.
- When unsure, say so. Don't guess.
- Prefer editing existing files over creating new ones.
- Match the file's existing style. Don't reformat unrelated code.
- Run tests after meaningful changes when a test command exists.
`,
  },
];
