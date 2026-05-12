// Catalog of choices the SaaS prompt-builder exposes.
// Each option carries a one-line tradeoff used as the field tooltip — so users
// can pick informed, not by random.

export type Option = {
  value: string;       // canonical string written into the prompt
  label: string;       // UI label
  tradeoff: string;    // one-liner used as tooltip / inline help
  recommended?: boolean;
};

export type Field = {
  id: string;
  label: string;
  description: string;
  options: Option[];
  multi?: boolean;        // multi-select (used for features)
};

// ─── Stack ────────────────────────────────────────────────────

export const multiTenancy: Field = {
  id: "tenancy",
  label: "Multi-tenancy model",
  description: "How tenants' data is isolated. The single most consequential SaaS decision.",
  options: [
    {
      value: "row-level (shared DB, tenant_id + RLS)",
      label: "Row-level (shared DB + RLS)",
      tradeoff: "Cheapest, fastest onboarding. Leak risk if you forget tenant_id — mitigate with Postgres RLS as belt-and-suspenders.",
      recommended: true,
    },
    {
      value: "schema-per-tenant (shared DB)",
      label: "Schema-per-tenant",
      tradeoff: "Cleaner isolation than row-level. Migration fan-out becomes painful past ~100 tenants.",
    },
    {
      value: "database-per-tenant",
      label: "Database-per-tenant",
      tradeoff: "Strongest isolation, supports data residency. Expensive, slow onboarding, complex ops.",
    },
    {
      value: "single-tenant (one deployment per customer)",
      label: "Single-tenant deployments",
      tradeoff: "Maximum isolation. Most expensive. Only justifiable for high-compliance enterprise.",
    },
  ],
};

export const frontend: Field = {
  id: "frontend",
  label: "Frontend framework",
  description: "What renders the UI.",
  options: [
    { value: "Next.js 16 (App Router, RSC)", label: "Next.js (App Router)", tradeoff: "Default for 2026 — RSC, Server Actions, Vercel-aligned. Largest ecosystem.", recommended: true },
    { value: "Remix / React Router v7", label: "Remix / React Router v7", tradeoff: "Web-fundamentals-first. Better for non-Vercel hosting.", },
    { value: "SvelteKit", label: "SvelteKit", tradeoff: "Smallest bundles, fast DX. Smaller component ecosystem." },
    { value: "Astro (with islands)", label: "Astro", tradeoff: "Great for content-heavy SaaS (marketing + blog + docs). Weaker for app shells." },
    { value: "SolidStart", label: "SolidStart", tradeoff: "Fast, fine-grained reactivity. Small community." },
    { value: "TanStack Start", label: "TanStack Start", tradeoff: "TanStack-router-based, full-stack. Newer, less battle-tested." },
  ],
};

export const apiStyle: Field = {
  id: "apiStyle",
  label: "API style",
  description: "How the frontend talks to the backend.",
  options: [
    { value: "tRPC (end-to-end TypeScript)", label: "tRPC", tradeoff: "Best DX in a TS-only codebase. End-to-end types. Locked to TS." },
    { value: "REST + Next.js Route Handlers", label: "REST + Route Handlers", tradeoff: "Universal. External integrations friendly. No automatic types." },
    { value: "Next.js Server Actions (RSC-native)", label: "Server Actions", tradeoff: "Simplest for forms. Tightly coupled to React server-side rendering.", recommended: true },
    { value: "GraphQL", label: "GraphQL", tradeoff: "Over-engineered for most SaaS. Pick only if you have a real federation or many clients." },
  ],
};

export const backend: Field = {
  id: "backend",
  label: "Separate backend (if any)",
  description: "Only set if you need a backend separate from the frontend framework.",
  options: [
    { value: "none — colocated with frontend", label: "None (colocated)", tradeoff: "Simplest. Server Actions / Route Handlers handle backend in the same repo.", recommended: true },
    { value: "FastAPI (Python)", label: "FastAPI", tradeoff: "Python, OpenAPI free. Good for ML / scientific backends." },
    { value: "Hono (TS, edge-native)", label: "Hono", tradeoff: "Tiny, edge-native, very fast. Pure HTTP server." },
    { value: "NestJS", label: "NestJS", tradeoff: "Angular-flavored enterprise patterns. Heavy." },
    { value: "Express", label: "Express", tradeoff: "Legacy default. Use only if a team mandates it." },
    { value: "Elysia (Bun)", label: "Elysia", tradeoff: "Bun-native, fast. Bun ecosystem still maturing." },
  ],
};

export const database: Field = {
  id: "database",
  label: "Database",
  description: "Primary persistence.",
  options: [
    { value: "Postgres (default)", label: "Postgres", tradeoff: "Default. RLS for multi-tenancy, JSONB, pgvector. Hard to outgrow.", recommended: true },
    { value: "MySQL / PlanetScale (Vitess)", label: "MySQL / PlanetScale", tradeoff: "Branching schemas, horizontal scale. No RLS — enforce tenant_id manually." },
    { value: "MongoDB", label: "MongoDB", tradeoff: "Flexible schema, weaker relational guarantees. Pick only if your data really is document-shaped." },
    { value: "SQLite + Turso/libSQL", label: "SQLite + Turso", tradeoff: "Edge-replicated, cheap. Limited concurrency; not ideal past medium-scale SaaS." },
  ],
};

export const orm: Field = {
  id: "orm",
  label: "ORM / query builder",
  description: "How TypeScript talks to the database.",
  options: [
    { value: "Drizzle", label: "Drizzle", tradeoff: "TS-first, ~7KB, edge-ready, SQL-like syntax. 2026 favorite.", recommended: true },
    { value: "Prisma", label: "Prisma", tradeoff: "Best DX. Heavier. v7 dropped the Rust engine." },
    { value: "Kysely", label: "Kysely", tradeoff: "Typed query builder. No migrations — pair with a tool like dbmate." },
    { value: "SQLAlchemy (Python)", label: "SQLAlchemy", tradeoff: "Python's default. Pair with FastAPI." },
    { value: "raw SQL", label: "Raw SQL", tradeoff: "Maximum control, no abstraction tax. Higher footgun rate." },
  ],
};

export const auth: Field = {
  id: "auth",
  label: "Authentication",
  description: "Sign-up, login, sessions.",
  options: [
    { value: "Better Auth", label: "Better Auth", tradeoff: "OSS. 2FA/passkeys/orgs built-in. 2026 darling. No vendor lock-in.", recommended: true },
    { value: "Clerk", label: "Clerk", tradeoff: "Fastest to ship. Hosted UI. Per-MAU pricing; vendor lock-in." },
    { value: "Auth.js / NextAuth v5", label: "Auth.js (NextAuth v5)", tradeoff: "Largest ecosystem. Missing 2FA/RBAC out of the box — DIY layer needed." },
    { value: "Supabase Auth", label: "Supabase Auth", tradeoff: "Free with Supabase DB. Locks you into Supabase." },
    { value: "Auth0", label: "Auth0", tradeoff: "Enterprise polish. Expensive. SAML/SSO baked in." },
    { value: "WorkOS", label: "WorkOS", tradeoff: "Enterprise SSO/SAML/SCIM done right. Pay-per-connection." },
  ],
};

export const billing: Field = {
  id: "billing",
  label: "Billing",
  description: "Subscriptions, checkout, invoices.",
  options: [
    { value: "Stripe", label: "Stripe", tradeoff: "Default. Best docs. ~3% + fees. You handle tax/MoR.", recommended: true },
    { value: "Paddle (Merchant of Record)", label: "Paddle", tradeoff: "MoR — handles VAT/sales tax worldwide. Slightly higher fees." },
    { value: "Lemon Squeezy (Stripe-owned MoR)", label: "Lemon Squeezy", tradeoff: "MoR. Owned by Stripe since 2024. Simpler than Stripe for digital goods." },
    { value: "Polar", label: "Polar", tradeoff: "OSS-friendly, devtools focus. Newer." },
    { value: "none for now", label: "None (free)", tradeoff: "Skip billing entirely for v1. Add later." },
  ],
};

export const hosting: Field = {
  id: "hosting",
  label: "Hosting",
  description: "Where this runs in production.",
  options: [
    { value: "Vercel", label: "Vercel", tradeoff: "Next.js native, edge, zero-config. Expensive at scale.", recommended: true },
    { value: "Fly.io", label: "Fly.io", tradeoff: "Full VMs, multi-region Postgres support. More ops." },
    { value: "Railway", label: "Railway", tradeoff: "Cheapest managed. Simpler than AWS." },
    { value: "Cloudflare Workers + D1/R2", label: "Cloudflare Workers", tradeoff: "Cheapest edge. CF-locked. Workers runtime constraints." },
    { value: "AWS (ECS/EKS)", label: "AWS", tradeoff: "Maximum control. Slow to set up. Best when you must integrate with AWS services." },
    { value: "self-hosted Docker", label: "Self-host", tradeoff: "Sovereign data. You run everything." },
  ],
};

export const email: Field = {
  id: "email",
  label: "Transactional email",
  description: "Sign-up verifications, password resets, magic links, billing receipts.",
  options: [
    { value: "Resend (React Email templates)", label: "Resend", tradeoff: "React Email templates, dev-first DX. Newer.", recommended: true },
    { value: "Postmark", label: "Postmark", tradeoff: "Best deliverability for transactional. Plain templates." },
    { value: "SendGrid", label: "SendGrid", tradeoff: "Legacy enterprise. Twilio-owned." },
    { value: "AWS SES", label: "AWS SES", tradeoff: "Cheapest at scale. No templating UI; you build it." },
  ],
};

export const storage: Field = {
  id: "storage",
  label: "File storage",
  description: "User-uploaded files, avatars, exports.",
  options: [
    { value: "Cloudflare R2", label: "Cloudflare R2", tradeoff: "S3-compatible, no egress fees. CF-aligned.", recommended: true },
    { value: "AWS S3", label: "AWS S3", tradeoff: "Universal default. Egress fees can sting." },
    { value: "Supabase Storage", label: "Supabase Storage", tradeoff: "Bundled with Supabase auth + db." },
    { value: "UploadThing", label: "UploadThing", tradeoff: "Next.js DX-focused. Vendor-tied." },
    { value: "none", label: "None (no uploads)", tradeoff: "Skip if v1 doesn't need file uploads." },
  ],
};

export const jobs: Field = {
  id: "jobs",
  label: "Background jobs",
  description: "Async tasks: email sends, webhooks, data exports, scheduled work.",
  options: [
    { value: "Inngest", label: "Inngest", tradeoff: "Serverless-native. No Redis. Step functions with retries built in.", recommended: true },
    { value: "Trigger.dev v3", label: "Trigger.dev v3", tradeoff: "Long-running tasks. OSS self-host option. v3 changed pricing." },
    { value: "BullMQ + Redis", label: "BullMQ + Redis", tradeoff: "Maximum throughput. You run Redis." },
    { value: "Cloudflare Queues", label: "Cloudflare Queues", tradeoff: "Cheap. CF-locked." },
    { value: "Hatchet", label: "Hatchet", tradeoff: "AI/task orchestration focus. OSS." },
    { value: "none for now", label: "None", tradeoff: "Synchronous only. Fine for v0 if no email sends or webhooks." },
  ],
};

export const observability: Field = {
  id: "observability",
  label: "Observability (errors + logs)",
  description: "What breaks and why.",
  options: [
    { value: "Sentry + PostHog", label: "Sentry + PostHog", tradeoff: "Sentry for errors, PostHog for product analytics + replay. Industry default.", recommended: true },
    { value: "PostHog (all-in-one)", label: "PostHog (all-in-one)", tradeoff: "Errors + product analytics + flags + replay in one tool." },
    { value: "Sentry only", label: "Sentry only", tradeoff: "Errors only. Add analytics later." },
    { value: "Axiom (logs)", label: "Axiom", tradeoff: "Logs, cheap. Pair with Sentry for errors." },
    { value: "Datadog", label: "Datadog", tradeoff: "Enterprise. Expensive. APM + logs + RUM." },
  ],
};

export const featureFlags: Field = {
  id: "featureFlags",
  label: "Feature flags",
  description: "Gate features per user/tenant/cohort.",
  options: [
    { value: "PostHog Feature Flags", label: "PostHog", tradeoff: "Free if you already use PostHog. Solid OSS option.", recommended: true },
    { value: "GrowthBook (OSS)", label: "GrowthBook", tradeoff: "OSS, self-host or cloud. Experimentation-strong." },
    { value: "LaunchDarkly", label: "LaunchDarkly", tradeoff: "Enterprise standard. Expensive." },
    { value: "Statsig", label: "Statsig", tradeoff: "Free up to 1M events. Experimentation-strong." },
    { value: "inline env-based (no service)", label: "Inline / env-based", tradeoff: "Good enough for under 10 flags. No targeting." },
  ],
};

export const analytics: Field = {
  id: "analytics",
  label: "Product analytics",
  description: "Events, funnels, retention.",
  options: [
    { value: "PostHog", label: "PostHog", tradeoff: "Open-source. Combines product analytics + flags + replay.", recommended: true },
    { value: "Plausible", label: "Plausible", tradeoff: "Privacy-first, no cookies. Lightweight. Page-level only." },
    { value: "Vercel Analytics", label: "Vercel Analytics", tradeoff: "Zero-config on Vercel. Limited." },
    { value: "Mixpanel", label: "Mixpanel", tradeoff: "Event/funnel-heavy. Expensive past free tier." },
    { value: "Umami (OSS Plausible)", label: "Umami", tradeoff: "OSS Plausible-alike. Self-host." },
  ],
};

export const unitTest: Field = {
  id: "unitTest",
  label: "Unit testing",
  description: "Fast in-process tests.",
  options: [
    { value: "Vitest", label: "Vitest", tradeoff: "Vite/Next-native. Fast.", recommended: true },
    { value: "Jest", label: "Jest", tradeoff: "Legacy default. Slower. Larger ecosystem." },
    { value: "Bun test", label: "Bun test", tradeoff: "Native to Bun. Fast. Less mature." },
    { value: "Pytest", label: "Pytest", tradeoff: "Python default." },
  ],
};

export const e2eTest: Field = {
  id: "e2eTest",
  label: "End-to-end testing",
  description: "Browser-driven tests of full flows.",
  options: [
    { value: "Playwright", label: "Playwright", tradeoff: "Gold standard. Multi-browser. Best parallelization.", recommended: true },
    { value: "Cypress", label: "Cypress", tradeoff: "Decent DX. Slower than Playwright. Chrome-first." },
    { value: "none for v1", label: "None for now", tradeoff: "Skip E2E. Heavy investment; add when the product stabilizes." },
  ],
};

export const lint: Field = {
  id: "lint",
  label: "Lint / format",
  description: "Code style enforcement.",
  options: [
    { value: "Biome", label: "Biome", tradeoff: "Single fast binary. 2026 momentum. ESLint subset coverage.", recommended: true },
    { value: "ESLint + Prettier", label: "ESLint + Prettier", tradeoff: "Largest ecosystem. Two tools to keep aligned." },
    { value: "Oxlint", label: "Oxlint", tradeoff: "Rust-fast. ESLint-compatible. Newer." },
    { value: "Ruff (Python)", label: "Ruff", tradeoff: "Python's Rust-fast linter. Default for new Python projects." },
  ],
};

export const packageManager: Field = {
  id: "packageManager",
  label: "Package manager",
  description: "How dependencies are installed.",
  options: [
    { value: "pnpm", label: "pnpm", tradeoff: "Fast, disk-efficient, default for 2026.", recommended: true },
    { value: "bun", label: "bun", tradeoff: "Fastest. Occasional incompatibilities. Newer." },
    { value: "npm", label: "npm", tradeoff: "Default with Node. Slowest." },
    { value: "yarn (berry)", label: "yarn (berry)", tradeoff: "Legacy. PnP optional." },
  ],
};

export const scaleTarget: Field = {
  id: "scaleTarget",
  label: "Scale target (year 1)",
  description: "Architectural decisions cascade from this. A 10-tenant tool ≠ a 10,000-tenant tool.",
  options: [
    { value: "10–100 users (early)", label: "10–100 users (early)", tradeoff: "Simplest stack. Don't over-engineer.", recommended: true },
    { value: "100–10,000 users (growth)", label: "100–10K users (growth)", tradeoff: "Need real background jobs, observability, rate limiting." },
    { value: "10,000+ users", label: "10K+ users (scale)", tradeoff: "Sharding considerations. Caching layer. Multi-region." },
  ],
};

// ─── Feature multi-select ────────────────────────────────────

export const features: Field = {
  id: "features",
  label: "Features to scaffold",
  description: "Pick the slices Claude should build. Common SaaS features come pre-described.",
  multi: true,
  options: [
    { value: "Onboarding: sign up, email verification, profile completion, workspace creation", label: "Onboarding flow", tradeoff: "Sign up + verify + profile + first workspace.", recommended: true },
    { value: "Team / workspace management: orgs, invites (email + link), roles (owner/admin/member/billing), permissions", label: "Team / workspace management", tradeoff: "Orgs, invites, roles, permissions.", recommended: true },
    { value: "Billing UI: pricing page, Stripe Checkout, customer portal, plan switch with proration, dunning emails, usage metering", label: "Billing UI", tradeoff: "Pricing → checkout → portal → metering.", recommended: true },
    { value: "Admin / god-mode: user search, audited impersonation, refunds, plan overrides, per-tenant feature flags", label: "Admin dashboard", tradeoff: "God-mode for support — impersonation logged." },
    { value: "Settings: profile, password, 2FA/passkeys, sessions list + revoke, API keys (scoped, rotatable), danger zone", label: "Settings & account", tradeoff: "Profile + 2FA + sessions + API keys + danger zone.", recommended: true },
    { value: "Notifications: in-app inbox, email digest, per-event preferences, outbound webhooks", label: "Notifications", tradeoff: "In-app + email + webhook subscribers." },
    { value: "Audit log: viewer UI with filter by actor/action/date, CSV export", label: "Audit log viewer", tradeoff: "Searchable audit trail." },
    { value: "Search: Postgres FTS (or Typesense/Meilisearch), tenant-scoped", label: "Search", tradeoff: "Tenant-scoped search across entities." },
    { value: "Data export: user-triggered async job, signed S3/R2 URL emailed to user", label: "Data export (GDPR)", tradeoff: "Required for GDPR." },
    { value: "Onboarding checklist: gamified first-week activation tasks", label: "Activation checklist", tradeoff: "Lifts activation conversion 10–20% on average." },
    { value: "Public marketing site: landing, pricing, blog (MDX), changelog, docs link", label: "Marketing site", tradeoff: "Pricing + blog + changelog in the same repo." },
    { value: "Help / docs portal: Mintlify / Fumadocs / Nextra", label: "Docs portal", tradeoff: "Self-served docs reduces support load." },
    { value: "Public API + docs: REST or tRPC, OpenAPI spec, scoped tokens, rate limits, Scalar UI", label: "Public API + docs", tradeoff: "External-developer ready." },
    { value: "Outbound webhooks: signed HMAC-SHA256 payloads, retry with exponential backoff, replay UI", label: "Outbound webhooks", tradeoff: "Let customers subscribe to your events." },
  ],
};
