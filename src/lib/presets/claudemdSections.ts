export type Section = {
  id: string;
  title: string;
  description: string;
  body: string;
};

// Each section is a self-contained markdown snippet with realistic example content
// the user can keep, edit, or delete. Sections are designed to compose: you can
// append several of them in any order. Lead each one with a `## Heading` so the
// final document reads as a normal nested markdown doc.

export const claudeMdSections: Section[] = [
  {
    id: "project-overview",
    title: "Project overview (WHY)",
    description: "One paragraph: what this project does, who uses it, success criteria.",
    body: `## Project overview

This is the internal pricing engine for the KSA used-car business. It ingests
daily scrapes of competitor listings, maps them to our inventory, and produces
per-car repricing recommendations.

- **Who uses it**: pricing analysts (daily), sales managers (weekly review).
- **Success looks like**: every car in inventory has a recommendation within 24h
  of the latest scrape, with a transparent rationale traceable to comparable
  listings.
- **Out of scope**: the scraper itself (separate repo: \`rintel-scraper\`).
`,
  },
  {
    id: "stack",
    title: "Tech stack (WHAT)",
    description: "Languages, frameworks, package manager, runtime versions.",
    body: `## Tech stack

- **Language**: TypeScript 5.6 (strict mode on)
- **Runtime**: Node.js 20.9+ (LTS)
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: Postgres 16 via Drizzle ORM
- **Package manager**: pnpm (never npm — lockfile is pnpm)
- **Hosting**: Fly.io, prod region \`fra\`
`,
  },
  {
    id: "commands",
    title: "Build & run commands",
    description: "Exact commands Claude should use to build, test, lint.",
    body: `## Commands

- **Install**: \`pnpm install\`
- **Dev server**: \`pnpm dev\` (port 3000, hot reload)
- **Type-check**: \`pnpm tsc --noEmit\`
- **Lint**: \`pnpm lint\` (oxlint)
- **Test (unit)**: \`pnpm vitest run\`
- **Test (e2e)**: \`pnpm playwright test\`
- **DB migrate (dev)**: \`pnpm drizzle:push\`
- **Build (prod)**: \`pnpm build\`

> Always run \`pnpm lint\` and \`pnpm tsc --noEmit\` before claiming a task done.
`,
  },
  {
    id: "structure",
    title: "Code structure",
    description: "Top-level directories and what lives in each.",
    body: `## Structure

\`\`\`
src/
  app/                  Next.js routes (App Router)
    api/                Route handlers
  components/           Shared React components
  lib/                  Pure functions, no React
    db/                 Drizzle schema + queries
    pricing/            Core pricing logic
  server/               Server-only utilities (env, auth)
tests/
  unit/                 Vitest specs (live next to src files when small)
  e2e/                  Playwright specs
scripts/                One-off CLI scripts
\`\`\`
`,
  },
  {
    id: "conventions",
    title: "Code conventions",
    description: "Naming, style, what to avoid.",
    body: `## Conventions

- **Imports**: absolute via \`@/*\` alias. No \`../../\` more than one level.
- **Naming**: \`camelCase\` for vars/functions, \`PascalCase\` for components/types,
  \`kebab-case\` for filenames except React components (\`UserCard.tsx\`).
- **Errors**: throw \`Error\` subclasses with a stable \`code\` property. Never
  swallow errors silently.
- **Async**: prefer \`async/await\`, no \`.then()\` chains.
- **Comments**: only the WHY — never the WHAT. If the code is unclear, rename
  the variable instead of explaining it.
- **Files**: one default export per file. Co-locate small tests next to the
  file they test (\`pricing.ts\` + \`pricing.test.ts\`).
`,
  },
  {
    id: "testing",
    title: "Testing rules",
    description: "What to test, how to test, what NOT to mock.",
    body: `## Testing

- **Unit tests**: live next to the file they test. Run with \`pnpm vitest\`.
- **Integration tests**: hit a real Postgres in CI (never mock the DB —
  mocked migrations passed in 2024 while prod broke).
- **e2e**: Playwright against the dev server. Tag flaky ones \`@flaky\` and
  exclude from required-check.
- **Snapshots**: only for stable HTML/markdown output. Never for objects with
  timestamps.
- **Coverage**: aim for 70% on \`lib/\`, no minimum on \`components/\`.
- **Before declaring done**: run \`pnpm vitest run\` (not watch mode).
`,
  },
  {
    id: "architecture",
    title: "Architecture notes",
    description: "How the main pieces fit together.",
    body: `## Architecture

The flow is unidirectional:

\`\`\`
scrape ingest → normalize → match-to-inventory → price-engine → recommend
        │           │              │                  │            │
   raw HTML    canonical car   our_car_id        rule pipeline  Postgres
\`\`\`

- The **price engine** is pure: \`(competitors, car, rules) → recommendation\`.
  No I/O. All side effects live in the surrounding pipeline.
- **Rules** are configured via \`config/rules.yml\`, never hard-coded.
- **Recommendations** are written to \`pricing_recommendations\` with a full
  rationale JSONB column — never overwrite, always insert a new row.
`,
  },
  {
    id: "hard-rules",
    title: "Hard rules / Don'ts",
    description: "Things to never do, with rationale.",
    body: `## Hard rules

- **Never force-push to main**. Rewrites shared history; unrecoverable for
  collaborators.
- **Never commit secrets**. Use \`.env\` (gitignored) or 1Password CLI.
- **Never disable a failing test silently**. Fix the code or fix the test;
  if neither is fast, mark \`@flaky\` with an issue link.
- **Never run migrations directly on prod**. Use the migration job in CI.
- **Never add \`any\` or \`@ts-ignore\` to silence a type error**. Fix the
  underlying type.
- **Never use \`CLAUDE.md\` as a linter**. Auto-format and lint via hooks.
`,
  },
  {
    id: "workflow",
    title: "Workflow / PR process",
    description: "How changes ship.",
    body: `## Workflow

1. Start every task from a fresh branch off \`main\`.
2. Make changes in small, focused commits (one concern per commit).
3. Run \`pnpm lint && pnpm tsc --noEmit && pnpm vitest run\` locally.
4. Open a PR. CI runs the same checks plus Playwright on a preview deploy.
5. Two approvals required for changes to \`lib/pricing/\`; one approval elsewhere.
6. Squash-merge. PR title becomes the squash commit subject.
`,
  },
  {
    id: "tooling-pinned",
    title: "Tooling (pinned)",
    description: "Pinned linter/formatter/test config to avoid drift.",
    body: `## Tooling

| Tool        | Version | Config            |
| ----------- | ------- | ----------------- |
| oxlint      | 0.18.x  | \`.oxlintrc.json\` |
| prettier    | 3.4.x   | \`.prettierrc\`    |
| vitest      | 2.1.x   | \`vitest.config.ts\` |
| playwright  | 1.49.x  | \`playwright.config.ts\` |
| drizzle     | 0.38.x  | \`drizzle.config.ts\` |

When upgrading any of these, run \`pnpm lint --fix\` and commit the resulting
diff in a separate PR titled \`chore: bump <tool>\`.
`,
  },
  {
    id: "imports",
    title: "Linked context (@imports)",
    description: "Pull in extra files using @path syntax (max depth 5).",
    body: `## Linked context

For deeper context, read these on demand (do not load all of these into your
working context at once):

- Build internals: @agent_docs/building.md
- Pricing rules deep-dive: @agent_docs/pricing-rules.md
- Test conventions: @agent_docs/testing.md
- Architecture diagrams: @docs/architecture/README.md
`,
  },
  {
    id: "personal-style",
    title: "Personal style (for user-level CLAUDE.md)",
    description: "Cross-project personal preferences.",
    body: `## Personal style

- Be concise. Skip filler ("Great question!", "Sure!", etc.).
- When unsure, say so. Don't guess.
- Prefer editing existing files over creating new ones.
- Match the file's existing style. Don't reformat unrelated code.
- Run tests after meaningful changes when a test command exists.
- For UI changes, verify in a real browser before claiming "done".
`,
  },
];
