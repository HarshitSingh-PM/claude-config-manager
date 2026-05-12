import { acceptanceCriteria, constitutionRules } from "./rules";

export type SaaSFormValues = {
  // Product
  name: string;
  problem: string;
  icp: string;          // ideal customer profile
  valueProp: string;
  scaleTarget: string;
  outOfScope: string;

  // Stack
  tenancy: string;
  frontend: string;
  apiStyle: string;
  backend: string;
  database: string;
  orm: string;
  auth: string;
  billing: string;
  hosting: string;
  email: string;
  storage: string;
  jobs: string;
  observability: string;
  featureFlags: string;
  analytics: string;
  unitTest: string;
  e2eTest: string;
  lint: string;
  packageManager: string;

  // Features
  features: string[];

  // Quality bar
  tsStrict: boolean;
  coverageTarget: string;
  commitStyle: string;
  a11y: string;
  prSizeCap: string;

  // Output contract
  planFirst: boolean;
  commitPerSlice: boolean;
  customNotes: string;
};

export const DEFAULT_VALUES: SaaSFormValues = {
  name: "",
  problem: "",
  icp: "",
  valueProp: "",
  scaleTarget: "10–100 users (early)",
  outOfScope: "",

  tenancy: "row-level (shared DB, tenant_id + RLS)",
  frontend: "Next.js 16 (App Router, RSC)",
  apiStyle: "Next.js Server Actions (RSC-native)",
  backend: "none — colocated with frontend",
  database: "Postgres (default)",
  orm: "Drizzle",
  auth: "Better Auth",
  billing: "Stripe",
  hosting: "Vercel",
  email: "Resend (React Email templates)",
  storage: "Cloudflare R2",
  jobs: "Inngest",
  observability: "Sentry + PostHog",
  featureFlags: "PostHog Feature Flags",
  analytics: "PostHog",
  unitTest: "Vitest",
  e2eTest: "Playwright",
  lint: "Biome",
  packageManager: "pnpm",

  features: [
    "Onboarding: sign up, email verification, profile completion, workspace creation",
    "Team / workspace management: orgs, invites (email + link), roles (owner/admin/member/billing), permissions",
    "Billing UI: pricing page, Stripe Checkout, customer portal, plan switch with proration, dunning emails, usage metering",
    "Settings: profile, password, 2FA/passkeys, sessions list + revoke, API keys (scoped, rotatable), danger zone",
  ],

  tsStrict: true,
  coverageTarget: "60% lines on lib/, no minimum on components/",
  commitStyle: "Conventional Commits",
  a11y: "WCAG 2.2 AA",
  prSizeCap: "soft 400 lines, hard 800",

  planFirst: true,
  commitPerSlice: true,
  customNotes: "",
};

/**
 * Build the Claude Code prompt from form values. Output is a single
 * markdown/XML hybrid string ready to paste into Claude Code.
 *
 * Structure (per research): role → product → stack → repo layout → rules →
 * features → quality bar → acceptance → output contract.
 *
 * Sections users left empty are gracefully omitted instead of writing
 * placeholders Claude would have to guess at.
 */
export function assemblePrompt(v: SaaSFormValues): string {
  const role = v.name.trim()
    ? `You are scaffolding a production-grade B2B SaaS named **${v.name.trim()}**. Follow the rules in the <rules> block strictly. Plan first; then implement.`
    : `You are scaffolding a production-grade B2B SaaS. Follow the rules in the <rules> block strictly. Plan first; then implement.`;

  // Filter rules by user choices (some rules only apply if Stripe/jobs/API are picked)
  const rules = constitutionRules
    .filter((r) => !r.requires || r.requires(v as unknown as Record<string, unknown>))
    .map((r, i) => `  ${i + 1}. ${r.text}`)
    .join("\n");

  const featureLines = v.features.length
    ? v.features.map((f, i) => `  ${i + 1}. ${f}`).join("\n")
    : "  (no features yet — start with auth + a single CRUD entity)";

  const outOfScope = v.outOfScope.trim()
    ? v.outOfScope
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `  - ${l}`)
        .join("\n")
    : "  (none specified — assume only the features above are in scope)";

  const customSection = v.customNotes.trim()
    ? `\n<additional_notes>\n${v.customNotes.trim()}\n</additional_notes>\n`
    : "";

  const outputContract: string[] = [];
  if (v.planFirst) {
    outputContract.push(
      "1. Write a `plan.md` first listing every file you intend to create + the commit plan. Stop and wait for my approval before writing any code.",
    );
  }
  if (v.commitPerSlice) {
    outputContract.push(
      `${v.planFirst ? "2" : "1"}. After approval, implement one vertical slice per commit (auth, then billing, then each entity). Each commit must leave the repo in a green state (lint + tests pass).`,
    );
  }
  outputContract.push(
    `${outputContract.length + 1}. Use ${v.commitStyle}. Run \`${v.packageManager} lint\` and \`${v.packageManager} test\` before every commit.`,
  );
  outputContract.push(
    `${outputContract.length + 1}. When unsure, surface the choice in plan.md rather than guessing. Don't invent fields, env vars, or libraries that aren't in the stack above.`,
  );

  const acceptanceLines = acceptanceCriteria.map((c) => `  - ${c}`).join("\n");

  return `<role>${role}</role>

<product>
  Name: ${v.name.trim() || "(unnamed)"}
  Problem: ${v.problem.trim() || "(describe the pain you're solving)"}
  Target user (ICP): ${v.icp.trim() || "(who is this for, specifically)"}
  Value proposition: ${v.valueProp.trim() || "(why a user pays you in one sentence)"}
  Scale target (year 1): ${v.scaleTarget}
  Out of scope:
${outOfScope}
</product>

<stack>
  Frontend:        ${v.frontend}
  API style:       ${v.apiStyle}
  Backend:         ${v.backend}
  Database:        ${v.database}
  Multi-tenancy:   ${v.tenancy}
  ORM:             ${v.orm}
  Auth:            ${v.auth}
  Billing:         ${v.billing}
  Email:           ${v.email}
  Storage:         ${v.storage}
  Background jobs: ${v.jobs}
  Observability:   ${v.observability}
  Feature flags:   ${v.featureFlags}
  Analytics:       ${v.analytics}
  Hosting:         ${v.hosting}
  Testing:         ${v.unitTest}${v.e2eTest && v.e2eTest !== "none for v1" ? ` + ${v.e2eTest}` : ""}
  Lint/format:     ${v.lint}
  Package manager: ${v.packageManager}
</stack>

<repo_layout>
  app/                Routes (App Router)
  app/(marketing)/    Public landing + pricing
  app/(app)/          Authenticated app (tenant-scoped)
  app/(admin)/        Admin / god-mode (role-gated)
  components/         Shared React components
  lib/                Pure functions, no React
  lib/db/             ORM schema + queries
  lib/auth/           Auth helpers + session reader
  lib/billing/        Stripe (or chosen provider) helpers
  lib/jobs/           Background job definitions
  lib/email/          Email templates
  jobs/               Background job entry points
  tests/              Unit + integration tests
  e2e/                Playwright specs
  scripts/            Seed, migrate, one-offs
</repo_layout>

<rules>
${rules}
</rules>

<features priority_ordered="true">
${featureLines}
</features>

<quality_bar>
  TypeScript: ${v.tsStrict ? "strict (strict: true, noUncheckedIndexedAccess)" : "non-strict"}
  Test coverage: ${v.coverageTarget}
  Lint/format: ${v.lint}
  Commit style: ${v.commitStyle}
  Accessibility: ${v.a11y}
  PR size cap: ${v.prSizeCap}
</quality_bar>

<acceptance>
${acceptanceLines}
</acceptance>
${customSection}
<output_contract>
${outputContract.map((l) => "  " + l).join("\n")}
</output_contract>
`;
}

export function promptStats(s: string): { lines: number; chars: number; words: number } {
  return {
    lines: s.split("\n").length,
    chars: s.length,
    words: s.trim() ? s.trim().split(/\s+/).length : 0,
  };
}
