// Curated catalog of common services whose credentials people set once at
// user scope and then use across all projects. Each entry maps to a set of
// env vars that get written into the `env` block of ~/.claude/settings.json,
// which Claude Code exports into every Bash command and MCP server.

export type CredentialVar = {
  name: string;          // exact env var name — match what the underlying tool/MCP server expects
  label: string;         // human-friendly label
  description: string;   // what specifically this value is
  sensitive: boolean;    // true → masked input with eye-toggle
  placeholder?: string;
  required?: boolean;    // only one value is shown as required when toggled on (others optional)
};

export type CredentialService = {
  id: string;
  name: string;
  category: "cloud" | "deploy" | "scm" | "db" | "comms" | "ai" | "payments" | "email" | "monitoring" | "misc";
  description: string;
  docsUrl: string;       // where to create/find the token
  vars: CredentialVar[];
};

export const credentialCategories: { id: CredentialService["category"]; label: string; emoji: string }[] = [
  { id: "cloud", label: "Cloud", emoji: "☁️" },
  { id: "deploy", label: "Deployment", emoji: "🚀" },
  { id: "scm", label: "Source control", emoji: "🌿" },
  { id: "db", label: "Databases", emoji: "🗄️" },
  { id: "comms", label: "Collaboration", emoji: "💬" },
  { id: "ai", label: "AI / ML", emoji: "🧠" },
  { id: "payments", label: "Payments", emoji: "💳" },
  { id: "email", label: "Email", emoji: "✉️" },
  { id: "monitoring", label: "Observability", emoji: "📈" },
  { id: "misc", label: "Other", emoji: "🔧" },
];

export const credentialServices: CredentialService[] = [
  // ──────────────── Cloud ────────────────
  {
    id: "aws",
    name: "AWS",
    category: "cloud",
    description: "Amazon Web Services — IAM access keys for the official aws CLI and SDK.",
    docsUrl: "https://console.aws.amazon.com/iam/home#/security_credentials",
    vars: [
      { name: "AWS_ACCESS_KEY_ID", label: "Access key ID", description: "Starts with AKIA…", sensitive: true, required: true, placeholder: "AKIA…" },
      { name: "AWS_SECRET_ACCESS_KEY", label: "Secret access key", description: "40-character secret. Shown only once at creation.", sensitive: true, required: true },
      { name: "AWS_REGION", label: "Default region", description: "e.g. us-east-1, eu-west-1, me-south-1", sensitive: false, placeholder: "us-east-1" },
      { name: "AWS_SESSION_TOKEN", label: "Session token (optional)", description: "Only for temporary credentials from STS / SSO.", sensitive: true },
    ],
  },
  {
    id: "gcp",
    name: "Google Cloud",
    category: "cloud",
    description: "GCP service-account JSON path + project ID for gcloud and Google SDKs.",
    docsUrl: "https://cloud.google.com/iam/docs/keys-create-delete",
    vars: [
      { name: "GOOGLE_APPLICATION_CREDENTIALS", label: "Service-account JSON path", description: "Absolute path to the service-account key JSON file.", sensitive: false, required: true, placeholder: "/Users/you/.gcloud/service-account.json" },
      { name: "GOOGLE_CLOUD_PROJECT", label: "Project ID", description: "GCP project ID (not the display name).", sensitive: false, placeholder: "my-project-123456" },
    ],
  },
  {
    id: "azure",
    name: "Azure",
    category: "cloud",
    description: "Azure service-principal credentials for az CLI / Azure SDKs.",
    docsUrl: "https://learn.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal",
    vars: [
      { name: "AZURE_CLIENT_ID", label: "Client ID", description: "App registration client ID.", sensitive: false, required: true },
      { name: "AZURE_CLIENT_SECRET", label: "Client secret", description: "App registration secret.", sensitive: true, required: true },
      { name: "AZURE_TENANT_ID", label: "Tenant ID", description: "Azure AD tenant ID.", sensitive: false, required: true },
      { name: "AZURE_SUBSCRIPTION_ID", label: "Subscription ID", description: "Optional: pin to a specific subscription.", sensitive: false },
    ],
  },
  {
    id: "digitalocean",
    name: "DigitalOcean",
    category: "cloud",
    description: "DigitalOcean Personal Access Token for doctl and the DO API.",
    docsUrl: "https://cloud.digitalocean.com/account/api/tokens",
    vars: [
      { name: "DIGITALOCEAN_ACCESS_TOKEN", label: "Access token", description: "Personal Access Token. Grant read/write as needed.", sensitive: true, required: true, placeholder: "dop_v1_…" },
    ],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "cloud",
    description: "Cloudflare API token (scoped) for wrangler and CF API calls.",
    docsUrl: "https://dash.cloudflare.com/profile/api-tokens",
    vars: [
      { name: "CLOUDFLARE_API_TOKEN", label: "API token", description: "Scoped API token. Prefer scoped over global API key.", sensitive: true, required: true },
      { name: "CLOUDFLARE_ACCOUNT_ID", label: "Account ID", description: "Found in the right sidebar of any zone overview.", sensitive: false },
    ],
  },
  {
    id: "fly",
    name: "Fly.io",
    category: "cloud",
    description: "Fly API token for flyctl deploys.",
    docsUrl: "https://fly.io/user/personal_access_tokens",
    vars: [
      { name: "FLY_API_TOKEN", label: "API token", description: "Run `flyctl auth token` to fetch.", sensitive: true, required: true },
    ],
  },

  // ──────────────── Deployment ────────────────
  {
    id: "vercel",
    name: "Vercel",
    category: "deploy",
    description: "Vercel CLI auth and team scoping.",
    docsUrl: "https://vercel.com/account/tokens",
    vars: [
      { name: "VERCEL_TOKEN", label: "API token", description: "Account-level token. Create with the scope you need (full or scoped).", sensitive: true, required: true },
      { name: "VERCEL_TEAM_ID", label: "Team ID", description: "Optional: scope CLI calls to a specific team. Find it in team settings.", sensitive: false },
      { name: "VERCEL_ORG_ID", label: "Org ID", description: "Used by some CI flows alongside VERCEL_PROJECT_ID.", sensitive: false },
    ],
  },
  {
    id: "netlify",
    name: "Netlify",
    category: "deploy",
    description: "Netlify CLI auth and optional site scoping.",
    docsUrl: "https://app.netlify.com/user/applications#personal-access-tokens",
    vars: [
      { name: "NETLIFY_AUTH_TOKEN", label: "Personal access token", description: "Netlify CLI reads this directly.", sensitive: true, required: true },
      { name: "NETLIFY_SITE_ID", label: "Default site ID", description: "Optional: default site for commands that take --site.", sensitive: false },
    ],
  },
  {
    id: "railway",
    name: "Railway",
    category: "deploy",
    description: "Railway CLI authentication.",
    docsUrl: "https://railway.app/account/tokens",
    vars: [
      { name: "RAILWAY_TOKEN", label: "API token", description: "Project token or personal token, depending on use.", sensitive: true, required: true },
    ],
  },
  {
    id: "npm",
    name: "npm",
    category: "deploy",
    description: "npm registry auth token for `npm publish` and private-package installs.",
    docsUrl: "https://www.npmjs.com/settings/~/tokens",
    vars: [
      {
        name: "NPM_TOKEN",
        label: "Auth token",
        description:
          "Granular access token. Use 'Publish' scope for releases; 'Read-only' for CI installs. Reference in .npmrc as ${NPM_TOKEN}.",
        sensitive: true,
        required: true,
        placeholder: "npm_…",
      },
      {
        name: "NPM_CONFIG_REGISTRY",
        label: "Registry URL",
        description:
          "Override default registry (e.g. for GitHub Packages, JFrog, Verdaccio). Leave empty for npmjs.org.",
        sensitive: false,
        placeholder: "https://registry.npmjs.org/",
      },
    ],
  },
  {
    id: "heroku",
    name: "Heroku",
    category: "deploy",
    description: "Heroku CLI authentication.",
    docsUrl: "https://dashboard.heroku.com/account/applications",
    vars: [
      { name: "HEROKU_API_KEY", label: "API key", description: "Run `heroku auth:token` to retrieve.", sensitive: true, required: true },
    ],
  },

  // ──────────────── Source control ────────────────
  {
    id: "github",
    name: "GitHub",
    category: "scm",
    description: "Personal access token for gh CLI, git push, and the GitHub MCP server.",
    docsUrl: "https://github.com/settings/tokens",
    vars: [
      { name: "GITHUB_TOKEN", label: "Personal access token", description: "Fine-grained PAT recommended. Scopes: repo, read:org, workflow as needed.", sensitive: true, required: true, placeholder: "ghp_… or github_pat_…" },
      { name: "GH_TOKEN", label: "Alias for gh CLI", description: "Some tooling reads this name instead. Usually safe to set the same value.", sensitive: true },
    ],
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "scm",
    description: "GitLab API access for glab CLI and CI/CD scripts.",
    docsUrl: "https://gitlab.com/-/user_settings/personal_access_tokens",
    vars: [
      { name: "GITLAB_TOKEN", label: "Personal access token", description: "Scopes: api, read_repository, write_repository as needed.", sensitive: true, required: true, placeholder: "glpat-…" },
      { name: "GITLAB_URL", label: "GitLab URL", description: "Override for self-hosted GitLab. Defaults to https://gitlab.com if unset.", sensitive: false, placeholder: "https://gitlab.com" },
    ],
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    category: "scm",
    description: "Bitbucket Cloud app password for Atlassian git remotes.",
    docsUrl: "https://bitbucket.org/account/settings/app-passwords/",
    vars: [
      { name: "BITBUCKET_USERNAME", label: "Username", description: "Bitbucket account username (not email).", sensitive: false, required: true },
      { name: "BITBUCKET_APP_PASSWORD", label: "App password", description: "Generated app password, scoped to repository read/write as needed.", sensitive: true, required: true },
    ],
  },

  // ──────────────── Databases ────────────────
  {
    id: "postgres",
    name: "Postgres",
    category: "db",
    description: "Default connection URL for psql, drizzle, prisma, etc.",
    docsUrl: "https://www.postgresql.org/docs/current/libpq-envars.html",
    vars: [
      { name: "DATABASE_URL", label: "Connection URL", description: "Full Postgres URL: postgresql://user:pass@host:port/db. Most ORMs read this.", sensitive: true, required: true, placeholder: "postgresql://user:password@localhost:5432/mydb" },
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "db",
    description: "Supabase project URL + keys for client and server-side SDK calls.",
    docsUrl: "https://supabase.com/dashboard/account/tokens",
    vars: [
      { name: "SUPABASE_URL", label: "Project URL", description: "https://<project>.supabase.co", sensitive: false, required: true, placeholder: "https://xyz.supabase.co" },
      { name: "SUPABASE_ANON_KEY", label: "Anon key", description: "Public anon key — safe for client.", sensitive: false },
      { name: "SUPABASE_SERVICE_ROLE_KEY", label: "Service role key", description: "DANGER — bypasses RLS. Never expose to client. Server-side only.", sensitive: true },
      { name: "SUPABASE_ACCESS_TOKEN", label: "Personal access token", description: "For supabase CLI (different from project keys above).", sensitive: true },
    ],
  },
  {
    id: "neon",
    name: "Neon",
    category: "db",
    description: "Serverless Postgres on Neon. API key + connection URL.",
    docsUrl: "https://console.neon.tech/app/settings/api-keys",
    vars: [
      { name: "NEON_API_KEY", label: "API key", description: "For neon CLI and management API.", sensitive: true, required: true },
      { name: "DATABASE_URL", label: "Connection URL", description: "Pooled connection string for app code.", sensitive: true },
    ],
  },
  {
    id: "mongodb",
    name: "MongoDB Atlas",
    category: "db",
    description: "Atlas connection URI for the mongo shell and drivers.",
    docsUrl: "https://www.mongodb.com/docs/atlas/connect-to-database-deployment/",
    vars: [
      { name: "MONGODB_URI", label: "Connection URI", description: "mongodb+srv://user:pass@cluster.mongodb.net/db", sensitive: true, required: true, placeholder: "mongodb+srv://…" },
    ],
  },
  {
    id: "redis",
    name: "Redis",
    category: "db",
    description: "Redis connection URL for redis-cli, ioredis, etc.",
    docsUrl: "https://redis.io/docs/latest/operate/oss_and_stack/management/",
    vars: [
      { name: "REDIS_URL", label: "Connection URL", description: "redis://[user:pass@]host:port[/db]", sensitive: true, required: true, placeholder: "redis://localhost:6379" },
    ],
  },

  // ──────────────── Collaboration ────────────────
  {
    id: "slack",
    name: "Slack",
    category: "comms",
    description: "Slack bot/app tokens for the Slack MCP server and webhook scripts.",
    docsUrl: "https://api.slack.com/apps",
    vars: [
      { name: "SLACK_BOT_TOKEN", label: "Bot token (xoxb-)", description: "Bot-user OAuth token. Most Slack APIs need this.", sensitive: true, required: true, placeholder: "xoxb-…" },
      { name: "SLACK_APP_TOKEN", label: "App-level token (xapp-)", description: "Needed for Socket Mode.", sensitive: true },
      { name: "SLACK_SIGNING_SECRET", label: "Signing secret", description: "For verifying incoming Slack webhooks.", sensitive: true },
    ],
  },
  {
    id: "linear",
    name: "Linear",
    category: "comms",
    description: "Linear API key for the Linear MCP server and linear-cli.",
    docsUrl: "https://linear.app/settings/account/security",
    vars: [
      { name: "LINEAR_API_KEY", label: "API key", description: "Personal API key. Account → Settings → API.", sensitive: true, required: true, placeholder: "lin_api_…" },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    category: "comms",
    description: "Notion integration token for the Notion API.",
    docsUrl: "https://www.notion.so/profile/integrations",
    vars: [
      { name: "NOTION_API_KEY", label: "Integration token", description: "Internal integration secret. Share specific pages with the integration to grant access.", sensitive: true, required: true, placeholder: "secret_…" },
    ],
  },
  {
    id: "atlassian",
    name: "Atlassian (Jira / Confluence)",
    category: "comms",
    description: "Atlassian API token for Jira and Confluence Cloud APIs.",
    docsUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
    vars: [
      { name: "ATLASSIAN_EMAIL", label: "Account email", description: "The email of your Atlassian account.", sensitive: false, required: true },
      { name: "ATLASSIAN_API_TOKEN", label: "API token", description: "Used together with email as basic auth.", sensitive: true, required: true },
      { name: "ATLASSIAN_URL", label: "Base URL", description: "https://<your-org>.atlassian.net", sensitive: false, required: true, placeholder: "https://acme.atlassian.net" },
    ],
  },

  // ──────────────── AI ────────────────
  {
    id: "openai",
    name: "OpenAI",
    category: "ai",
    description: "OpenAI API key for chat/embedding/audio endpoints.",
    docsUrl: "https://platform.openai.com/api-keys",
    vars: [
      { name: "OPENAI_API_KEY", label: "API key", description: "Project key recommended over user key.", sensitive: true, required: true, placeholder: "sk-…" },
      { name: "OPENAI_ORG_ID", label: "Organization ID", description: "Optional: bill to a specific org.", sensitive: false },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "ai",
    description: "Anthropic API key for the Claude API (separate from Claude Code login).",
    docsUrl: "https://console.anthropic.com/settings/keys",
    vars: [
      { name: "ANTHROPIC_API_KEY", label: "API key", description: "For direct Claude API calls. Note: Claude Code uses its own login by default.", sensitive: true, required: true, placeholder: "sk-ant-…" },
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    category: "ai",
    description: "Mistral La Plateforme API key.",
    docsUrl: "https://console.mistral.ai/api-keys",
    vars: [
      { name: "MISTRAL_API_KEY", label: "API key", description: "For Mistral chat and embedding endpoints.", sensitive: true, required: true },
    ],
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    category: "ai",
    description: "HF token for model/dataset access and Inference Endpoints.",
    docsUrl: "https://huggingface.co/settings/tokens",
    vars: [
      { name: "HF_TOKEN", label: "Access token", description: "Read scope is enough for most use cases.", sensitive: true, required: true, placeholder: "hf_…" },
    ],
  },

  // ──────────────── Payments ────────────────
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    description: "Stripe API keys for the official stripe SDK and CLI.",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    vars: [
      { name: "STRIPE_SECRET_KEY", label: "Secret key", description: "Server-side only. Prefer restricted keys for least-privilege.", sensitive: true, required: true, placeholder: "sk_live_… or sk_test_…" },
      { name: "STRIPE_PUBLISHABLE_KEY", label: "Publishable key", description: "Safe to ship to client.", sensitive: false, placeholder: "pk_live_… or pk_test_…" },
      { name: "STRIPE_WEBHOOK_SECRET", label: "Webhook signing secret", description: "Per-endpoint signing secret.", sensitive: true, placeholder: "whsec_…" },
    ],
  },

  // ──────────────── Email ────────────────
  {
    id: "resend",
    name: "Resend",
    category: "email",
    description: "Resend email API key.",
    docsUrl: "https://resend.com/api-keys",
    vars: [
      { name: "RESEND_API_KEY", label: "API key", description: "Restrict to sending domain for safety.", sensitive: true, required: true, placeholder: "re_…" },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    category: "email",
    description: "SendGrid email API key.",
    docsUrl: "https://app.sendgrid.com/settings/api_keys",
    vars: [
      { name: "SENDGRID_API_KEY", label: "API key", description: "Full or restricted scope.", sensitive: true, required: true, placeholder: "SG.…" },
    ],
  },

  // ──────────────── Observability ────────────────
  {
    id: "sentry",
    name: "Sentry",
    category: "monitoring",
    description: "Sentry auth token for releases, source maps, and CLI.",
    docsUrl: "https://sentry.io/settings/account/api/auth-tokens/",
    vars: [
      { name: "SENTRY_AUTH_TOKEN", label: "Auth token", description: "Used by sentry-cli for releases & source maps.", sensitive: true, required: true, placeholder: "sntrys_…" },
      { name: "SENTRY_ORG", label: "Organization slug", description: "URL slug of your Sentry org.", sensitive: false },
      { name: "SENTRY_PROJECT", label: "Default project slug", description: "Optional: default project for sentry-cli.", sensitive: false },
    ],
  },
  {
    id: "datadog",
    name: "Datadog",
    category: "monitoring",
    description: "Datadog API & App keys for the datadog CLI and APIs.",
    docsUrl: "https://app.datadoghq.com/organization-settings/api-keys",
    vars: [
      { name: "DD_API_KEY", label: "API key", description: "For sending data to Datadog.", sensitive: true, required: true },
      { name: "DD_APP_KEY", label: "Application key", description: "Needed for reading metrics, dashboards, monitors.", sensitive: true },
      { name: "DD_SITE", label: "Site", description: "datadoghq.com (default), datadoghq.eu, ddog-gov.com, etc.", sensitive: false, placeholder: "datadoghq.com" },
    ],
  },
];
