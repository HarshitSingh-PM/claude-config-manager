// SaaS "constitution" — 14 rules baked into every assembled prompt.
// These are the cross-cutting concerns that LLMs reliably get wrong unless
// told explicitly. Each rule is a single line so the whole block fits inside
// the ~150-200 instruction attention budget Anthropic documents for Claude 4.x.

export type Rule = {
  id: string;
  text: string;
  // Optional: only include this rule if user picked the relevant feature/stack
  requires?: (values: Record<string, unknown>) => boolean;
};

export const constitutionRules: Rule[] = [
  {
    id: "tenant-id",
    text:
      "Every tenant-scoped table MUST have a non-null `tenant_id` (or `organization_id`) column with an index; every query MUST filter by it. Prefer Postgres RLS policies as belt-and-suspenders.",
  },
  {
    id: "tenant-source",
    text:
      "Never trust `tenant_id` from the request body — always derive it from the authenticated session/JWT claim.",
  },
  {
    id: "soft-delete",
    text:
      "Soft-delete user-facing rows with `deleted_at timestamptz`; hard-delete only via the GDPR deletion job after a retention window.",
  },
  {
    id: "audit",
    text:
      "Every mutation writes an `audit_log` row (`actor_id`, `tenant_id`, `action`, `target_type`, `target_id`, `diff_jsonb`, `created_at`).",
  },
  {
    id: "webhook-idempotency",
    text:
      "All webhooks (Stripe, billing, integration) MUST be idempotent: persist `event.id` in a `webhook_events` table with a PK constraint; return 200 immediately, process asynchronously.",
    requires: (v) => (v.billing as string)?.toLowerCase().includes("stripe") || (v.billing as string)?.toLowerCase().includes("paddle") || (v.billing as string)?.toLowerCase().includes("lemon") || (v.billing as string)?.toLowerCase().includes("polar"),
  },
  {
    id: "stripe-sig",
    text:
      "Verify webhook signatures (e.g. `stripe.webhooks.constructEvent`) BEFORE any DB work; reject within a 5s budget.",
    requires: (v) => Boolean((v.billing as string) && !(v.billing as string).startsWith("none")),
  },
  {
    id: "rate-limit",
    text:
      "Rate-limit every public endpoint: per-IP for unauthenticated, per-user AND per-tenant for authenticated. Use a sliding window (Redis/Upstash).",
  },
  {
    id: "jobs-retry",
    text:
      "Background jobs MUST be retry-safe (idempotent by job key) with an explicit max-attempts + dead-letter destination.",
    requires: (v) => Boolean((v.jobs as string) && !(v.jobs as string).startsWith("none")),
  },
  {
    id: "secrets",
    text:
      "No secrets in client bundles. Server-only env vars MUST NOT be prefixed `NEXT_PUBLIC_` / `VITE_` / `PUBLIC_`. Validate every env at boot with Zod (fail fast).",
  },
  {
    id: "migrations",
    text:
      "Migrations MUST be zero-downtime: additive first (add column nullable → backfill → enforce not-null → drop old) — never rename in one step.",
  },
  {
    id: "api-versioning",
    text:
      "Public APIs versioned via URL prefix (`/api/v1`); breaking changes require a new version and a 6-month deprecation window.",
    requires: (v) => {
      const features = (v.features as string[] | undefined) ?? [];
      return features.some((f) => f.startsWith("Public API"));
    },
  },
  {
    id: "gdpr",
    text:
      "GDPR baseline: per-user data export endpoint (JSON+CSV), deletion endpoint that cascades and writes a tombstone, cookie/consent banner, DPA in `/legal`.",
  },
  {
    id: "ui-states",
    text:
      "Every route has an error boundary AND a loading state; never render `undefined`. Server actions return a discriminated union `{ok:true,data}|{ok:false,error}`.",
  },
  {
    id: "logging",
    text:
      "PII (email, name, phone) excluded from logs; structured logging only (e.g. `pino`/`structlog`) with `tenant_id` + `request_id` on every line.",
  },
];

export const acceptanceCriteria = [
  "`pnpm dev` boots without errors and lands on the landing page.",
  "Sign-up → email verify → workspace-creation flow works end-to-end.",
  "Stripe test checkout completes successfully; replayed webhook is a no-op.",
  "Seed creates 2 tenants with isolated data; cross-tenant query from tenant A returns empty for tenant B's resources.",
  "`pnpm test` and `pnpm build` are both green.",
  "Server-only env vars are validated at boot; missing env produces a clear error.",
];
