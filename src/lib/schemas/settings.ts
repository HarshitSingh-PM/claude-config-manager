import type { Field, FieldScope, Schema } from "./types";

// Coverage follows the official settings reference
// (https://code.claude.com/docs/en/settings-reference), Claude Code 2.1.28x.
// Keys that only work in ~/.claude.json ("Global config") are deliberately
// absent: Claude Code ignores them in a settings file.

type Extra = { significance?: string; scope?: FieldScope };

const bool = (key: string, label: string, tooltip: string, def?: boolean, extra: Extra = {}): Field => ({
  type: "boolean",
  key,
  label,
  tooltip,
  default: def,
  ...extra,
});

const str = (key: string, label: string, tooltip: string, placeholder?: string, extra: Extra = {}): Field => ({
  type: "string",
  key,
  label,
  tooltip,
  placeholder,
  ...extra,
});

const num = (
  key: string,
  label: string,
  tooltip: string,
  opts: { placeholder?: string; min?: number; max?: number } & Extra = {},
): Field => ({ type: "number", key, label, tooltip, ...opts });

const list = (
  key: string,
  label: string,
  tooltip: string,
  itemPlaceholder?: string,
  extra: Extra & { suggestions?: string[]; objectKey?: string } = {},
): Field => ({ type: "list", key, label, tooltip, itemPlaceholder, ...extra });

const select = (
  key: string,
  label: string,
  tooltip: string,
  values: (string | [string, string])[],
  extra: Extra & { unset?: string } = {},
): Field => {
  const { unset, ...rest } = extra;
  return {
    type: "select",
    key,
    label,
    tooltip,
    options: [
      { value: "", label: unset ?? "(default)" },
      ...values.map((v) =>
        typeof v === "string" ? { value: v, label: v } : { value: v[0], label: `${v[0]} — ${v[1]}` },
      ),
    ],
    ...rest,
  };
};

const json = (
  key: string,
  label: string,
  tooltip: string,
  placeholder: string,
  extra: Extra & { rows?: number } = {},
): Field => ({ type: "json", key, label, tooltip, placeholder, ...extra });

const group = (
  key: string,
  label: string,
  tooltip: string,
  fields: Field[],
  collapsed = false,
): Field => ({ type: "group", key, label, tooltip, fields, collapsed });

export const modelOptions = [
  { value: "", label: "(inherit / default)" },
  { value: "default", label: "default", description: "Your account's default model" },
  { value: "best", label: "best", description: "The most capable model available to you" },
  { value: "fable", label: "fable", description: "Highest capability, premium cost (Fable 5.1)" },
  { value: "opus", label: "opus", description: "Most capable everyday model (Opus 5.5)" },
  { value: "sonnet", label: "sonnet", description: "Balanced (Sonnet 5.5)" },
  { value: "haiku", label: "haiku", description: "Fast & cheap (Haiku 4.5)" },
  { value: "opusplan", label: "opusplan", description: "Opus while planning, Sonnet to execute" },
  { value: "sonnet[1m]", label: "sonnet[1m]", description: "Sonnet with a 1M-token context window" },
  { value: "opus[1m]", label: "opus[1m]", description: "Opus with a 1M-token context window" },
  { value: "claude-fable-5-1", label: "claude-fable-5-1 (pinned — most capable)" },
  { value: "claude-opus-5-5", label: "claude-opus-5-5 (pinned)" },
  { value: "claude-sonnet-5-5", label: "claude-sonnet-5-5 (pinned)" },
  { value: "claude-haiku-4-5", label: "claude-haiku-4-5 (pinned)" },
  { value: "claude-fable-5", label: "claude-fable-5 (pinned — previous)" },
  { value: "claude-opus-5", label: "claude-opus-5 (pinned — previous)" },
  { value: "claude-sonnet-5", label: "claude-sonnet-5 (pinned — previous)" },
  { value: "claude-opus-4-8", label: "claude-opus-4-8 (pinned — previous gen)" },
];

const effort = ["low", "medium", "high", "xhigh"];

export const settingsSchema: Schema = {
  id: "settings",
  title: "settings.json",
  description:
    "Claude Code settings. Permissions, hooks, model, status line, environment — all live here.",
  format: "json",
  fields: [
    group("model_group", "Model & reasoning", "Which Claude model to use, how hard it thinks, and what happens when it's unavailable.", [
      {
        type: "select",
        key: "model",
        label: "Model",
        tooltip: "The model every new session starts on. Project settings override user settings; you can still switch mid-session with /model.",
        significance: "Fable = highest capability. Opus = most capable everyday model. Sonnet = balanced. Haiku = fast, cheap.",
        options: modelOptions,
      },
      select("effortLevel", "Effort level", "Default reasoning effort for models you haven't saved a level for. `max` and ultracode are session-only — set them with /effort or CLAUDE_CODE_EFFORT_LEVEL.", effort, {
        significance: "Higher = better reasoning but more tokens and slower. Adjust live with /effort.",
      }),
      select("maxEffortLevel", "Max effort level (cap)", "Cap the effort a session can use. Any higher level — from /effort, --effort, a skill or a subagent — runs at the cap instead.", [...effort, ["max", "no cap"]], {
        unset: "(no cap)",
        significance: "A cost control. Usually deployed in managed settings.",
      }),
      json("modelSettings", "Per-model settings", "Saved effort level (and auto-compact window / effort cap) per model. /effort and the /model slider write this for you.", '{\n  "claude-opus-5-5": { "effortLevel": "xhigh" }\n}', { rows: 4 }),
      select("advisorModel", "Advisor model", "A stronger model the main model can consult mid-task. It must be at least as capable as your main model.", [["fable", "Fable 5.1"], ["opus", "Opus 5.5"], ["sonnet", "Sonnet 5.5"]], {
        unset: "(off)",
        significance: "Pairs a fast executor with a smarter advisor — quality boost without running everything on the big model.",
      }),
      list("fallbackModel", "Fallback models", "Backup models tried in order when the primary is overloaded or unavailable (max 3). `default` expands to your account default.", "sonnet", {
        significance: "Keeps sessions going through rate limits or provider outages.",
      }),
      bool("switchModelsOnFlag", "Switch models when a request is flagged", "When a safety classifier flags a request, switch to the fallback model and continue. Off = pause and let you choose.", true),
      bool("alwaysThinkingEnabled", "Extended thinking", "Thinking is on by default for models that support it — set to off to disable it for every session.", true),
      bool("showThinkingSummaries", "Show thinking summaries", "Show summaries of Claude's extended thinking when you expand it with Ctrl+O.", false),
      bool("fastMode", "Fast mode", "Faster output at a higher per-token cost, without downgrading the model. /fast writes this for you.", false, {
        significance: "Requires extra usage enabled. Supported on Opus.",
      }),
      bool("fastModePerSessionOptIn", "Fast mode: opt in every session", "Stop a saved fastMode from carrying into new sessions — /fast must be run each time.", false),
      bool("ultracode", "Ultracode (always plan a workflow)", "Start sessions with ultracode on: Claude plans a multi-agent workflow for each substantive task instead of waiting for you to ask.", false, {
        significance: "Spends many more tokens per task. Needs dynamic workflows and a model that supports xhigh effort.",
      }),
      select("promptCacheTtl", "Prompt cache lifetime (main conversation)", "How long the prompt cache holds your main conversation. 1h keeps it warm across long pauses at a higher write cost.", ["5m", "1h"]),
      select("subagentPromptCacheTtl", "Prompt cache lifetime (subagents & helpers)", "Cache lifetime for subagents, workflows, compaction and other background requests.", ["5m", "1h"]),
      str("outputStyle", "Output style", "Name of a built-in style (default, Proactive, Explanatory, Learning) or one under output-styles/.", "Explanatory"),
      str("language", "Response language", "Claude responds in this language by default. Any language name works; it also sets the voice dictation language.", "japanese"),
      list("availableModels", "Available models (allowlist)", "Restrict which models can be selected for the main session, subagents, skills and the advisor.", "sonnet", {
        significance: "Useful for teams standardizing on specific models or controlling cost.",
      }),
      bool("enforceAvailableModels", "Apply the allowlist to the Default option too", "Make the /model picker's Default option resolve to an allowed model when the account default isn't on the allowlist.", false),
      {
        type: "kv",
        key: "modelOverrides",
        label: "Model ID overrides (Bedrock / Vertex / Foundry)",
        tooltip: "Map an Anthropic model ID to a provider-specific ID such as a Bedrock inference-profile ARN.",
        keyPlaceholder: "claude-opus-5-5",
        valuePlaceholder: "arn:aws:bedrock:…",
      },
      json("modelPicker", "Custom /model picker rows", "List the models the /model picker offers, in your order and under your labels — after the built-in lineup or instead of it.", '{\n  "options": [{ "model": "claude-opus-5-5", "label": "Team Opus" }],\n  "replaceBuiltInOptions": false\n}', { scope: "user", rows: 5 }),
    ]),

    group("permissions", "Permissions", "Auto-approve, block, or always-ask patterns. Deny rules win over allow rules.", [
      select("permissions.defaultMode", "Default permission mode", "The permission mode new sessions start in.", [
        ["default", "ask each time"],
        ["manual", "alias for default"],
        ["acceptEdits", "auto-approve edits"],
        ["plan", "read-only planning"],
        ["auto", "a classifier reviews each action"],
        ["dontAsk", "never prompt, deny instead"],
        ["bypassPermissions", "skip all prompts (dangerous)"],
      ], {
        significance: "`plan` is read-only; `acceptEdits` auto-approves edits but still asks for risky tools; `bypassPermissions` skips all prompts (only safe inside a sandbox).",
      }),
      {
        type: "list",
        key: "permissions.allow",
        label: "Allow (auto-approve)",
        tooltip: "Tools/patterns auto-approved without prompt. Format: Tool(pattern). E.g. Bash(npm run test *), Read(./src/**), WebFetch(domain:github.com), mcp__github__get_*.",
        significance: "Cuts permission prompts dramatically. Be precise — wildcards on Bash can be dangerous.",
        itemPlaceholder: "Bash(npm run *)",
        suggestions: [
          "Bash(npm run lint)",
          "Bash(npm run test *)",
          "Bash(git status)",
          "Bash(git diff *)",
          "Bash(git log *)",
          "Read(./src/**)",
          "WebFetch(domain:github.com)",
          "WebFetch(domain:docs.claude.com)",
        ],
      },
      {
        type: "list",
        key: "permissions.deny",
        label: "Deny (block)",
        tooltip: "Tools/patterns blocked completely. Deny takes precedence over allow. Matching files are also hidden from file discovery and search.",
        significance: "Strongest guardrail. Pair with sandbox — without sandbox, deny only blocks Claude's built-in tools, not arbitrary Bash.",
        itemPlaceholder: "Read(./.env)",
        suggestions: [
          "Read(./.env)",
          "Read(./.env.*)",
          "Read(./secrets/**)",
          "Read(~/.ssh/**)",
          "Read(~/.aws/**)",
          "Read(~/.gnupg/**)",
          "Read(~/.kube/**)",
          "Read(~/.docker/config.json)",
          "Read(~/.npmrc)",
          "Read(~/.git-credentials)",
          "Read(~/Library/Keychains/**)",
          "Bash(rm -rf *)",
          "Bash(curl *)",
          "Bash(wget *)",
          "Bash(git push --force *)",
          "Edit(~/.zshrc)",
          "Edit(~/.bashrc)",
        ],
      },
      {
        type: "list",
        key: "permissions.ask",
        label: "Ask (always confirm)",
        tooltip: "Tools/patterns that always prompt, even in a mode that would otherwise approve them.",
        significance: "Good middle ground for things you want oversight on but not blocked.",
        itemPlaceholder: "Bash(git push *)",
        suggestions: ["Bash(git push *)", "Bash(npm publish *)", "Bash(docker push *)", "Edit(/etc/**)"],
      },
      list("permissions.additionalDirectories", "Additional working directories", "Directories outside the one you started in that Claude may read and edit.", "~/shared-config"),
      bool("permissions.blockReadsOutsideWorkingDirectories", "Block reads outside working directories", "Make Read, Grep, Glob and LSP refuse paths outside your working directories in every mode — including bypassPermissions.", false, {
        significance: "A `true` in any settings file applies.",
      }),
      select("permissions.disableBypassPermissionsMode", "Bypass-permissions mode", "Set to `disable` to reject --dangerously-skip-permissions and any bypassPermissions request.", ["disable"], { unset: "(allowed)" }),
      select("disableAutoMode", "Auto mode", "Set to `disable` to remove auto mode from the Shift+Tab cycle and reject --permission-mode auto.", ["disable"], { unset: "(allowed)" }),
      bool("useAutoModeDuringPlan", "Use the auto-mode classifier in plan mode", "Let the classifier review shell commands while planning, so safe read-only commands don't prompt.", true, { scope: "user" }),
      bool("skipAutoPermissionPrompt", "Skip the auto-mode intro notice", "Don't show the one-time notice describing auto mode.", false, { scope: "user" }),
      bool("skipDangerousModePermissionPrompt", "Skip the bypass-mode confirmation", "Don't show the confirmation dialog before entering bypassPermissions mode. Claude Code writes this when you accept the dialog.", false, { scope: "user" }),
      group("autoMode_group", "Auto mode classifier rules", "Prose rules that tune what the auto-mode classifier allows and blocks. Read from user or managed settings.", [
        list("autoMode.environment", "Environment (what you trust)", "Describe trusted repos, buckets and domains so the classifier stops blocking routine internal operations.", "Our source lives in github.com/acme/*", { scope: "user" }),
        list("autoMode.allow", "Allow rules", "Plain-language descriptions of actions the classifier should allow.", "Deploying to the staging cluster is routine", { scope: "user" }),
        list("autoMode.soft_deny", "Soft-deny rules", "Actions the classifier should block unless you clearly asked for them.", "Force-pushing to any branch", { scope: "user" }),
        list("autoMode.hard_deny", "Hard-deny rules", "Actions the classifier must always block.", "Deleting production databases", { scope: "user" }),
        bool("autoMode.classifyAllShell", "Classify every shell command", "Send every Bash/PowerShell command through the classifier in auto mode, suspending your shell allow rules.", false, { scope: "user" }),
      ], true),
    ]),

    group("sandbox", "Sandbox", "Filesystem & network isolation for Bash. Strongly recommended — pair with deny rules.", [
      bool("sandbox.enabled", "Enable sandbox", "Isolate the Bash commands Claude runs from your filesystem and network.", false, {
        significance: "Without sandbox, deny rules don't block arbitrary Bash commands — only Claude's built-in tools.",
      }),
      bool("sandbox.failIfUnavailable", "Fail if the sandbox can't start", "Exit at startup instead of silently running unsandboxed when a dependency is missing or the platform is unsupported.", false),
      bool("sandbox.autoAllowBashIfSandboxed", "Auto-allow sandboxed Bash", "Run sandboxed commands without a permission prompt. Deny rules and content-scoped ask rules still apply.", true),
      bool("sandbox.allowUnsandboxedCommands", "Allow retry outside the sandbox", "Let Claude retry a blocked command unsandboxed (dangerouslyDisableSandbox) — through the normal permission flow.", true),
      list("sandbox.excludedCommands", "Commands that run outside the sandbox", "Tools that don't work under the sandbox. Same syntax as the inside of a Bash(...) rule.", "docker *"),
      {
        type: "list",
        key: "sandbox.enabledPlatforms",
        label: "Platforms to sandbox on",
        tooltip: "Limit sandboxing to these platforms. Leave empty for all supported platforms.",
        itemPlaceholder: "macos",
        suggestions: ["macos", "linux", "wsl", "windows"],
      },
      group("sandbox_fs", "Filesystem", "Which paths sandboxed commands can read and write. By default they write only to the working directory and temp.", [
        list("sandbox.filesystem.allowWrite", "Write-allowed paths", "Extra paths sandboxed commands can write to.", "~/.cache/build"),
        list("sandbox.filesystem.denyWrite", "Write-blocked paths", "Block writes to specific paths, even inside an otherwise writable directory.", "./.git/hooks"),
        list("sandbox.filesystem.denyRead", "Read-blocked paths", "Block sandboxed commands from reading these paths. Use for credentials.", "~/.aws/credentials"),
        list("sandbox.filesystem.allowRead", "Read re-allowed paths", "Re-open reading for specific paths inside a denyRead region — for workspace-only read access.", "~/work/project"),
        bool("sandbox.filesystem.disabled", "Disable filesystem isolation (network only)", "Skip filesystem isolation while keeping network isolation.", false, { scope: "user" }),
      ]),
      group("sandbox_net", "Network", "Which hosts, ports and sockets sandboxed commands can reach.", [
        list("sandbox.network.allowedDomains", "Allowed domains", "Pre-allow domains so the sandbox doesn't prompt. Wildcards (*.example.com) and :port suffixes work.", "github.com"),
        list("sandbox.network.deniedDomains", "Denied domains", "Always-blocked domains — wins over allowedDomains.", "pastebin.com"),
        bool("sandbox.network.strictAllowlist", "Strict allowlist (deny instead of prompt)", "Deny hosts outside the allowlist instead of asking for approval.", false, { scope: "user" }),
        bool("sandbox.network.allowLocalBinding", "Allow local port binding (macOS)", "Let sandboxed commands listen on ports (dev servers) and reach localhost.", false),
        list("sandbox.network.allowUnixSockets", "Allowed Unix sockets (macOS)", "Socket paths sandboxed commands can connect to.", "/var/run/docker.sock"),
        bool("sandbox.network.allowAllUnixSockets", "Allow all Unix sockets", "The only way to permit Unix sockets on Linux and WSL2.", false),
        list("sandbox.network.allowMachLookup", "Allowed Mach/XPC services (macOS)", "Extra XPC service names the sandbox may look up — needed by the iOS Simulator, Playwright, etc.", "com.apple.CoreSimulator.*"),
        num("sandbox.network.httpProxyPort", "Your own HTTP proxy port", "Route sandbox traffic through your HTTP proxy instead of Claude Code's. Your proxy takes over filtering.", { placeholder: "8080", min: 1, max: 65535 }),
        num("sandbox.network.socksProxyPort", "Your own SOCKS5 proxy port", "Route sandbox traffic through your SOCKS5 proxy instead of Claude Code's.", { placeholder: "1080", min: 1, max: 65535 }),
        json("sandbox.network.tlsTerminate", "TLS termination (experimental)", "Make the sandbox proxy terminate TLS so it can inspect HTTPS — required for `mask` credentials. `{}` generates an ephemeral CA.", '{ "caCertPath": "/path/ca.pem", "caKeyPath": "/path/ca-key.pem" }', { scope: "user", rows: 2 }),
      ], true),
      group("sandbox_adv", "Credentials & advanced", "Credential protection and platform escape hatches.", [
        json("sandbox.credentials", "Protected credentials", "Credential files and env vars to hide (`deny`) or replace with a sentinel (`mask`) inside the sandbox.", '{\n  "files": [{ "path": "~/.netrc", "mode": "deny" }],\n  "envVars": [{ "name": "GITHUB_TOKEN", "mode": "deny" }]\n}', { rows: 5 }),
        json("sandbox.ignoreViolations", "Ignored violations", "Silence expected violation reports: map a command substring to path substrings.", '{ "git": ["/etc/hosts"] }', { rows: 2 }),
        bool("sandbox.allowAppleEvents", "Allow Apple Events (macOS)", "Let sandboxed commands use `open`, `osascript` and browser launchers. Removes code-execution isolation.", false, { scope: "user" }),
        bool("sandbox.enableWeakerNetworkIsolation", "Weaker network isolation (macOS)", "Let Go-based tools (gh, gcloud, terraform) reach the system TLS trust service behind a MITM proxy.", false),
        bool("sandbox.enableWeakerNestedSandbox", "Weaker nested sandbox (Docker on Linux)", "Run the Linux sandbox inside an unprivileged container by reusing the container's /proc.", false),
        json("sandbox.ripgrep", "Custom ripgrep binary", "Point the sandbox at your own `rg` build.", '{ "command": "/usr/local/bin/rg", "args": [] }', { scope: "user", rows: 2 }),
      ], true),
    ]),

    group("mcp_group", "MCP servers", "Control which Model Context Protocol servers are approved, allowed or blocked.", [
      bool("enableAllProjectMcpServers", "Auto-approve all project MCP servers", "Approve every server in this project's .mcp.json without prompting.", false, {
        significance: "Convenient for trusted repos; leave off if you vet servers individually.",
      }),
      list("enabledMcpjsonServers", "Approved .mcp.json servers", "Names of specific .mcp.json servers to approve.", "playwright"),
      list("disabledMcpjsonServers", "Rejected .mcp.json servers", "Names of specific .mcp.json servers to reject — a rejection in any settings file applies.", "some-untrusted-server"),
      list("allowedMcpServers", "Allowed MCP servers (allowlist)", "If set, only matching servers may be used — from any source, including plugins and claude.ai. Stored as { serverName } entries.", "github", { objectKey: "serverName" }),
      list("deniedMcpServers", "Denied MCP servers (blocklist)", "Servers that may never load, wherever they are defined. Wins over the allowlist.", "some-untrusted-server", { objectKey: "serverName" }),
      bool("disableClaudeAiConnectors", "Disable claude.ai connectors", "Don't fetch or connect the MCP connectors enabled on your claude.ai account.", false, {
        significance: "A `true` in any settings file applies — a repo can opt out of connectors.",
      }),
    ]),

    group("env", "Environment variables", "Env vars set for every session and the subprocesses Claude Code starts.", [
      {
        type: "kv",
        key: "env",
        label: "Variables",
        tooltip: "Key/value pairs. Most documented Claude Code env vars work here (MAX_THINKING_TOKENS, BASH_DEFAULT_TIMEOUT_MS, DISABLE_TELEMETRY, …). Avoid secrets in committed scopes.",
        significance: "Useful for API keys, debug flags, timeouts, telemetry opt-outs.",
        keyPlaceholder: "BASH_DEFAULT_TIMEOUT_MS",
        valuePlaceholder: "120000",
      },
    ]),

    group("hooks_group", "Hooks & automation", "Run commands, HTTP calls, MCP tools, prompts or agents on lifecycle events — build them in the Hooks section below. Also: dynamic workflows.", [
      bool("disableAllHooks", "Disable all hooks", "Kill switch — turns off hooks, the custom status line and any custom file-suggestion command without deleting them.", false),
      list("allowedHttpHookUrls", "Allowed HTTP hook URLs", "URL patterns HTTP hooks may call (* is a wildcard). An empty list blocks every HTTP hook.", "https://hooks.internal.example.com/*"),
      list("httpHookAllowedEnvVars", "Env vars HTTP hooks may send", "Outer allowlist of env var names HTTP hooks can interpolate into headers.", "HOOK_TOKEN"),
      bool("enableWorkflows", "Dynamic workflows", "Turn Claude-authored multi-agent workflow scripts on or off for yourself.", true),
      bool("disableWorkflows", "Disable workflows for everyone (policy)", "Turn off dynamic workflows and bundled workflow commands for everyone these settings reach.", false),
      bool("workflowKeywordTriggerEnabled", "`ultracode` keyword triggers a workflow", "Typing the keyword ultracode in a prompt starts a dynamic workflow.", true),
      select("workflowSizeGuideline", "Workflow size guideline", "The agent count Claude aims for in workflows it writes — advice, not an enforced cap.", [
        ["small", "fewer than 5 agents"],
        ["medium", "fewer than 10 agents"],
        ["large", "bigger fan-outs"],
        ["unrestricted", "no guideline"],
      ]),
    ]),

    group("session", "Memory & context", "Auto-memory, compaction, checkpoints and how much output Claude sees.", [
      bool("autoMemoryEnabled", "Auto-memory", "Let Claude read and write its own memory directory as it learns about your project.", true, {
        significance: "Turn off if you prefer to maintain CLAUDE.md by hand only.",
      }),
      str("autoMemoryDirectory", "Auto-memory directory", "Custom directory for auto-memory. Ignored in checked-in project settings for security.", "~/.claude/memory"),
      bool("autoCompactEnabled", "Auto-compact at context limit", "Summarize the conversation automatically when context approaches the limit.", true, {
        significance: "Keeps long /goal and /loop runs going without manual /compact.",
      }),
      num("autoCompactWindow", "Auto-compact window (tokens)", "How full the context gets before auto-compaction (100,000–1,000,000). Capped at your model's window.", { placeholder: "500000", min: 100000, max: 1000000 }),
      bool("fileCheckpointingEnabled", "File checkpointing (/rewind)", "Snapshot files before each edit so /rewind can restore them.", true, {
        significance: "A safety net for autonomous, multi-edit runs.",
      }),
      num("bashOutputMaxChars", "Bash output limit (chars)", "How much of a command's output Claude receives inline (4,000–128,000; default 30,000). Longer output is saved to a file.", { placeholder: "30000", min: 4000, max: 128000 }),
      list("claudeMdExcludes", "CLAUDE.md excludes", "Glob patterns or absolute paths of CLAUDE.md files to skip — handy in monorepos.", "**/other-team/CLAUDE.md"),
      str("plansDirectory", "Plans directory", "Where plan-mode plan files are stored, relative to the project root. Default: ~/.claude/plans.", "./plans"),
      num("cleanupPeriodDays", "Transcript retention (days)", "Delete session transcripts and other app data older than this. Minimum 1; default 30.", { placeholder: "30", min: 1 }),
    ]),

    group("interface", "Interface & terminal", "How the Claude Code terminal UI looks and behaves.", [
      select("theme", "Theme", "Color theme. Custom themes use custom:<slug>.", ["auto", "dark", "light", "dark-daltonized", "light-daltonized", "dark-ansi", "light-ansi"]),
      select("tui", "Renderer", "`fullscreen` is the flicker-free alt-screen renderer with virtualized scrollback; `default` is the classic one. /tui writes this.", ["fullscreen", "default"], { unset: "(auto)" }),
      select("viewMode", "Transcript view", "The view sessions start in. `focus` shows the prompt, one-line tool summaries and the final response only.", ["default", "verbose", "focus"]),
      bool("verbose", "Verbose tool output", "Show full tool output instead of collapsed summaries.", false),
      select("editorMode", "Editor mode", "Key bindings for the input box.", ["normal", "vim"]),
      {
        type: "kv",
        key: "vimInsertModeRemaps",
        label: "Vim insert-mode escape remaps",
        tooltip: "Map a two-key INSERT-mode sequence to Escape, e.g. jk → <Esc>. `<Esc>` is the only supported target.",
        keyPlaceholder: "jk",
        valuePlaceholder: "<Esc>",
        scope: "user",
      },
      select("defaultShell", "Shell for `!` commands", "Which shell runs commands you type with the ! prefix.", ["bash", "powershell"]),
      bool("respondToBashCommands", "Claude responds after `!` commands", "Off = the command output is added to context without a reply.", true),
      bool("promptSuggestionEnabled", "Prompt suggestions", "Show the grayed-out predicted next prompt in the input box.", true),
      bool("emojiCompletionEnabled", "Emoji shortcode completion", "Suggest and replace :shortcodes: with emoji in the prompt.", true),
      bool("respectGitignore", "@ file picker respects .gitignore", "Leave gitignored files out of @ suggestions.", true),
      bool("showTurnDuration", "Show turn duration", "Show \"Cooked for 1m 6s · done 6:05 PM\" after each response.", true),
      select("timeFormat", "Time format", "How times are written in the interface.", ["auto", "12-hour", "24-hour", "24-hour-utc"]),
      str("timeZone", "Time zone", "IANA time zone for times shown in the interface. Default: your system zone.", "Asia/Dubai"),
      num("maxProseWidth", "Max prose width (columns)", "Wrap paragraphs at this many columns in wide terminals (min 40). Tables and code keep full width.", { placeholder: "100", min: 40 }),
      bool("spinnerTipsEnabled", "Spinner tips", "Rotate short tips about Claude Code features in the spinner line.", true),
      json("spinnerTipsOverride", "Custom spinner tips", "Add your own tips, or replace the built-in ones with excludeDefault.", '{ "tips": ["Run /compact before big refactors"], "excludeDefault": false }', { rows: 3 }),
      json("spinnerVerbs", "Custom spinner verbs", "Add to or replace the rotating verbs (\"Baking…\").", '{ "mode": "append", "verbs": ["Brewing", "Tinkering"] }', { rows: 2 }),
      bool("prefersReducedMotion", "Reduce motion", "Reduce or turn off spinner, shimmer and flash animations.", false),
      bool("axScreenReader", "Screen-reader mode", "Flat text without decorative borders or animations.", false),
      bool("syntaxHighlightingDisabled", "Disable syntax highlighting", "Show diffs, code blocks and previews as plain text.", false),
      bool("autoScrollEnabled", "Auto-scroll (fullscreen)", "Follow new output to the bottom of the conversation.", true),
      bool("wheelScrollAccelerationEnabled", "Wheel scroll acceleration (fullscreen)", "Accelerate mouse-wheel scrolling during fast scrolls.", true),
      bool("terminalProgressBarEnabled", "Terminal progress indicator", "Report an in-progress state to terminals that show one on the tab or taskbar.", true),
      bool("terminalTitleFromRename", "Tab title follows /rename", "Use the session name from /rename or --name as the terminal tab title.", true),
      bool("showClearContextOnPlanAccept", "Offer \"clear context\" when accepting a plan", "Add an option to the plan-approval menu that approves the plan and clears planning context.", false),
      select("askUserQuestionTimeout", "Question auto-continue timeout", "Idle time before an unanswered question dialog continues with the options already selected.", ["60s", "5m", "10m", "never"], { scope: "user" }),
      select("dialogExpiry", "Remote dialog expiry", "Deadline for dialogs forwarded to a remote client and for held cross-session messages. Default 5m.", ["60s", "5m", "10m", "never"], { scope: "user" }),
      bool("autoContinueAtUsageLimit", "Auto-continue after a usage limit resets", "Wait in the open session and resume the task once your claude.ai limit resets.", true, { scope: "user" }),
      bool("bashEditDiffEnabled", "Show diffs of files changed by Bash", "Record which files a Bash command changed and show their diff after it runs.", false, { scope: "user" }),
      json("spellcheck", "Prompt spell check", "Underline misspelled words in the prompt using aspell, hunspell or ispell.", '{ "enabled": true, "checker": "auto", "language": "en_GB" }', { scope: "user", rows: 2 }),
      json("voice", "Voice dictation", "/voice writes this. mode is hold or tap; autoSubmit sends on key release in hold mode.", '{ "enabled": true, "mode": "hold", "autoSubmit": false }', { rows: 2 }),
      json("fileSuggestion", "Custom @ file suggestion command", "Run your own command to supply @ autocomplete — useful for huge monorepos with a prebuilt index.", '{ "type": "command", "command": "~/.claude/file-suggestion.sh" }', { rows: 2 }),
      json("footerLinksRegexes", "Footer link badges", "Render clickable footer badges when a regex matches turn output — e.g. turn ticket IDs into links.", '[{ "type": "regex", "pattern": "(?<id>PROJ-\\\\d+)", "url": "https://jira.example.com/browse/{id}", "label": "{id}" }]', { scope: "user", rows: 3 }),
      list("companyAnnouncements", "Startup announcements", "Messages shown at startup; one is picked at random each session.", "Welcome to Acme — see go/claude for guidelines"),
    ], true),

    group("statusLine_g", "Status line", "A custom command that renders the line below the prompt. The Status line tab builds the script for you.", [
      select("statusLine.type", "Type", "`command` runs a shell command and renders its stdout.", ["command"], { unset: "(disabled)" }),
      str("statusLine.command", "Command", "Script or command to run. It receives session JSON on stdin.", "~/.claude/statusline.sh", {
        significance: "Popular pattern: show model, context %, cost, and 5-hour-quota bar.",
      }),
      num("statusLine.padding", "Padding", "Left/right padding in characters.", { placeholder: "0", min: 0 }),
      num("statusLine.refreshInterval", "Refresh interval (seconds)", "Also re-run the command every N seconds — for clocks or state that changes while the session is idle.", { placeholder: "5", min: 1 }),
      bool("statusLine.hideVimModeIndicator", "Hide built-in vim mode indicator", "Suppress `-- INSERT --` when your script renders vim.mode itself.", false),
      select("subagentStatusLine.type", "Subagent rows: type", "Run your own command to render each subagent's row in the agent panel.", ["command"], { unset: "(default rows)" }),
      str("subagentStatusLine.command", "Subagent rows: command", "Command that rewrites the `name · description · token count` row for each subagent.", "~/.claude/subagent-statusline.sh"),
    ], true),

    group("git_group", "Git & attribution", "What Claude adds to commits and pull requests.", [
      str("attribution.commit", "Commit attribution", "Text (including trailers) added to commits. Default: a Co-Authored-By trailer.", "Co-Authored-By: Claude <noreply@anthropic.com>"),
      str("attribution.pr", "PR attribution", "Text added to pull request descriptions.", "🤖 Generated with Claude Code"),
      bool("attribution.sessionUrl", "Append session link", "Add the claude.ai session link to commits/PRs made from cloud or Remote Control sessions.", true),
      bool("includeCoAuthoredBy", "Co-Authored-By trailer (deprecated)", "Deprecated — use the attribution fields above. Turning this off removes Claude's byline from commits and PRs.", true),
      bool("includeGitInstructions", "Built-in git instructions", "Include Claude Code's commit/PR workflow instructions and a git status snapshot in context.", true, {
        significance: "Turn off if your own CLAUDE.md or skills define the git workflow.",
      }),
      str("prUrlTemplate", "PR link template", "Point PR links at an internal review tool. Placeholders: {host} {owner} {repo} {number} {url}.", "https://review.example.com/{owner}/{repo}/pull/{number}"),
    ], true),

    group("plugins_group", "Plugins & skills", "Plugin enablement, marketplaces and how skills are listed to Claude.", [
      {
        type: "kv",
        key: "enabledPlugins",
        label: "Enabled plugins",
        tooltip: "plugin-name@marketplace-name → true/false. /plugin writes this for you.",
        keyPlaceholder: "formatter@anthropic-tools",
        valuePlaceholder: "true",
        valueType: "boolean",
      },
      json("extraKnownMarketplaces", "Extra marketplaces", "Register plugin marketplaces by name so everyone who opens the repo gets them.", '{\n  "acme-tools": { "source": { "source": "github", "repo": "acme/claude-plugins" } }\n}', { rows: 4 }),
      {
        type: "kv",
        key: "skillOverrides",
        label: "Skill visibility overrides",
        tooltip: "skill name → on | name-only | user-invocable-only | off. Hide or collapse a skill without editing its SKILL.md.",
        keyPlaceholder: "code-review",
        valuePlaceholder: "name-only",
      },
      bool("disableBundledSkills", "Disable bundled skills", "Remove the skills and workflows that ship with Claude Code.", false),
      bool("disableSkillShellExecution", "Disable skill shell execution", "Don't run inline !`cmd` blocks in skills and custom commands.", false, {
        significance: "A hardening option when using third-party skills you haven't audited.",
      }),
      num("skillListingBudgetFraction", "Skill listing budget (fraction of context)", "Share of the context window reserved for the skill listing. Default 0.01 (1%).", { placeholder: "0.01", min: 0, max: 1 }),
      num("skillListingMaxDescChars", "Skill description cap (chars)", "Per-skill cap on description + when_to_use text in the listing. Default 1536.", { placeholder: "1536", min: 1 }),
      bool("syncClaudeAiSkills", "Sync skills from claude.ai", "Download the skills enabled on your claude.ai account into ~/.claude/skills/synced/.", true, { scope: "user" }),
      bool("syncClaudeAiPlugins", "Sync plugins from claude.ai", "Download the plugins enabled on your claude.ai account.", true, { scope: "user" }),
      json("pluginConfigs", "Plugin option values", "Answers to plugins' config dialogs, keyed by plugin ID. Claude Code writes this for you.", '{ "formatter@anthropic-tools": { "options": { "style": "compact" } } }', { scope: "user", rows: 3 }),
    ], true),

    group("autonomy_group", "Agents, sessions & worktrees", "Background agents, agent teams, cross-session messaging and git worktrees.", [
      str("agent", "Main-thread agent", "Run the main session as a named subagent — applies its system prompt, tool restrictions and model.", "code-reviewer"),
      select("teammateMode", "Agent team display", "Where agent-team teammates are shown.", [
        ["in-process", "inside the main pane"],
        ["auto", "split panes when the terminal supports them"],
        ["tmux", "tmux split panes"],
        ["iterm2", "iTerm2 native split panes"],
      ]),
      select("crossSessionInbound", "Cross-session messages", "What to do when another Claude session sends this one a message.", [
        ["accept", "deliver immediately"],
        ["hold", "show a notice, wait for approval"],
        ["refuse", "drop the message"],
      ], { significance: "`hold` queues messages for your review; `refuse` isolates the session." }),
      bool("isolatePeerMachines", "Approve cross-machine messages", "Require your approval before SendMessage reaches one of your sessions on another machine.", false),
      bool("disableAgentView", "Disable agent view & background agents", "Turn off `claude agents`, --bg, /background and the on-demand supervisor.", false),
      select("worktree.baseRef", "Worktree base", "Which ref new worktrees branch from.", [
        ["fresh", "origin/<default-branch>"],
        ["head", "your current local HEAD"],
      ]),
      select("worktree.bgIsolation", "Background session isolation", "How background sessions isolate their file edits.", [
        ["worktree", "edit in a separate worktree"],
        ["none", "edit in place"],
      ]),
      list("worktree.symlinkDirectories", "Worktree symlinked directories", "Symlink these directories from the main repo into each worktree instead of duplicating them.", "node_modules"),
      list("worktree.sparsePaths", "Worktree sparse paths", "Check out only these directories in each worktree (git sparse-checkout).", "packages/web"),
      str("processWrapper", "Process wrapper", "A launcher command placed in front of background processes Claude Code starts (macOS/Linux).", "/usr/local/bin/corp-launcher", { scope: "user" }),
    ], true),

    group("remote_group", "Remote control & notifications", "Remote Control, push notifications and the Artifact tool.", [
      select("preferredNotifChannel", "Local notifications", "How Claude Code notifies you when a task completes or a prompt is waiting.", ["auto", "terminal_bell", "iterm2", "iterm2_with_bell", "kitty", "ghostty", "notifications_disabled"]),
      bool("awaySummaryEnabled", "Session recap when you return", "Show a one-line recap after you've been away from the terminal for a few minutes.", true),
      bool("remoteControlAtStartup", "Connect Remote Control at startup", "Connect Remote Control automatically when each interactive session starts.", false),
      bool("agentPushNotifEnabled", "Push when Claude decides it's worth it", "Let Claude send a push notification to your phone, e.g. when a long task finishes (Remote Control connected).", false),
      bool("inputNeededNotifEnabled", "Push when input is needed", "Push to your phone when a permission prompt or question is waiting.", false),
      bool("disableRemoteControl", "Disable Remote Control", "Refuse `claude remote-control`, --remote-control, auto-start and the in-session toggle.", false),
      bool("enableArtifact", "Artifact tool", "Let Claude publish session output as a private web page on claude.ai.", true),
      str("remote.defaultEnvironmentId", "Default cloud environment", "Default environment for cloud sessions created from the CLI. /remote-env writes this.", "env_…"),
      select("disableDeepLinkRegistration", "claude-cli:// deep links", "Set to `disable` to stop registering the protocol handler with the OS.", ["disable"], { unset: "(registered)" }),
      json("sshConfigs", "Desktop SSH connections", "SSH connections added to the Desktop environment dropdown.", '[{ "id": "dev", "name": "Dev box", "sshHost": "dev.example.com" }]', { scope: "user", rows: 2 }),
    ], true),

    group("auth_group", "Authentication & providers", "Credential helpers and login restrictions. API keys themselves live in the Credentials tab.", [
      str("apiKeyHelper", "API key helper", "Command that prints the credential Claude Code sends with model requests.", "~/bin/get-claude-key.sh"),
      str("awsAuthRefresh", "AWS auth refresh command", "Run when Bedrock credentials stop working, e.g. `aws sso login --profile dev`.", "aws sso login --profile dev"),
      str("awsCredentialExport", "AWS credential export command", "Command that prints AWS credentials as JSON, for credentials outside ~/.aws.", "aws sts assume-role …"),
      str("gcpAuthRefresh", "GCP auth refresh command", "Run when Google Cloud credentials expire, e.g. `gcloud auth application-default login`.", "gcloud auth application-default login"),
      str("otelHeadersHelper", "OpenTelemetry headers helper", "Command that prints OTel export headers as JSON — for backends with rotating tokens.", "~/bin/otel-headers.sh"),
      select("forceLoginMethod", "Restrict login method", "Limit which kind of account can log in.", [
        ["claudeai", "claude.ai accounts only"],
        ["console", "Console accounts only"],
        ["gateway", "a cloud gateway"],
      ], { unset: "(any)" }),
      str("forceLoginOrgUUID", "Login organization UUID", "Pre-select (or, from managed settings, require) this Anthropic organization at login.", "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"),
    ], true),

    group("updates_group", "Updates & privacy", "Release channel, data retention and feedback prompts.", [
      select("autoUpdatesChannel", "Auto-updates channel", "`stable` is about a week old and skips releases with major regressions.", ["latest", "stable"]),
      str("minimumVersion", "Minimum version", "Never auto-install a version below this — prevents a downgrade when moving to stable.", "2.1.280"),
      num("desktopSessionCleanupPeriodDays", "Desktop transcript retention (days)", "Age limit for Desktop/Cowork session transcripts. 0 = keep forever.", { placeholder: "0", min: 0, scope: "user" }),
      select("feedbackDrafts", "Claude-drafted feedback", "Whether Claude may queue feedback drafts for you to review, and whether a card shows.", ["notify", "quiet", "off"], { scope: "user" }),
      num("feedbackSurveyRate", "Session survey rate (0–1)", "Probability the session quality survey appears when eligible. 0 turns it off.", { placeholder: "0", min: 0, max: 1 }),
      bool("skipWebFetchPreflight", "Skip WebFetch domain preflight", "Skip the check that sends each hostname to api.anthropic.com — for networks that block Anthropic (Bedrock, Vertex).", false),
    ], true),

    group("managed_group", "Enterprise & managed policy", "Keys Claude Code honors only from managed settings. Editing them elsewhere has no effect.", [
      bool("allowManagedPermissionRulesOnly", "Only managed permission rules", "Ignore allow/ask/deny rules from user, project and local settings.", false, { scope: "managed" }),
      bool("allowManagedHooksOnly", "Only managed hooks", "Run only hooks your organization deploys.", false, { scope: "managed" }),
      bool("allowManagedMcpServersOnly", "Only the managed MCP allowlist", "Read allowedMcpServers from managed settings alone.", false, { scope: "managed" }),
      bool("allowAllClaudeAiMcps", "Keep claude.ai connectors alongside managed-mcp.json", "Otherwise managed-mcp.json suppresses them.", false, { scope: "managed" }),
      bool("allowClaudeInChromeWithManagedMcp", "Keep Claude in Chrome alongside managed-mcp.json", "Let the built-in Chrome server run with a deployed managed-mcp.json.", false, { scope: "managed" }),
      json("managedMcpServers", "Managed MCP servers", "Remote MCP servers provided to every user.", '{ "docs": { "type": "http", "url": "https://mcp.example.com/mcp" } }', { scope: "managed", rows: 2 }),
      select("availableModelsMatch", "Model allowlist matching", "`prefix` also permits later versions that extend an ID; `exact` permits only the named version.", ["prefix", "exact"], { scope: "managed" }),
      list("deniedModels", "Denied models", "Block specific models even when the allowlist permits them.", "fable", { scope: "managed" }),
      json("modelPricing", "Contracted model pricing", "Report spend at your organization's rates instead of list price.", '{ "multiplier": 0.8 }', { scope: "managed", rows: 2 }),
      {
        type: "list",
        key: "allowedProviders",
        label: "Allowed providers",
        tooltip: "Services a machine may reach Claude through.",
        itemPlaceholder: "anthropic",
        suggestions: ["anthropic", "bedrock", "vertex", "foundry", "anthropicAws", "mantle", "customEndpoint", "gateway"],
        scope: "managed",
      },
      str("forceLoginGatewayUrl", "Login gateway URL", "Gateway URL the /login Cloud gateway screen connects to.", "https://gateway.example.com", { scope: "managed" }),
      list("gatewayInternalNetworks", "Gateway internal networks", "Public IPv4 CIDR blocks your internal network uses, so /login accepts a gateway there (max 4).", "203.0.113.0/24", { scope: "managed" }),
      str("requiredMinimumVersion", "Required minimum version", "Oldest Claude Code version allowed to start.", "2.1.250", { scope: "managed" }),
      str("requiredMaximumVersion", "Required maximum version", "Newest Claude Code version allowed to start.", "2.1.289", { scope: "managed" }),
      { type: "string", key: "claudeMd", label: "Managed CLAUDE.md", tooltip: "Instructions injected as organization-managed memory, ahead of user and project CLAUDE.md.", multiline: true, rows: 4, placeholder: "# Company engineering rules\n…", scope: "managed" },
      bool("channelsEnabled", "Allow channels", "Channels are blocked on Team and Enterprise plans until this is on.", false, { scope: "managed" }),
      json("allowedChannelPlugins", "Allowed channel plugins", "Which channel plugins can push messages into sessions.", '[{ "marketplace": "acme-tools", "plugin": "pager" }]', { scope: "managed", rows: 2 }),
      json("strictKnownMarketplaces", "Marketplace allowlist", "Plugin marketplace sources users may add. An empty array is a lockdown.", '[{ "source": "github", "repo": "acme/claude-plugins" }]', { scope: "managed", rows: 2 }),
      json("blockedMarketplaces", "Marketplace blocklist", "Marketplace sources blocked for the organization.", '[{ "source": "github", "repo": "untrusted/plugins" }]', { scope: "managed", rows: 2 }),
      {
        type: "list",
        key: "strictPluginOnlyCustomization",
        label: "Plugin-only customization",
        tooltip: "Surfaces that may come only from plugins or managed settings.",
        itemPlaceholder: "skills",
        suggestions: ["skills", "agents", "hooks", "mcp"],
        scope: "managed",
      },
      list("pluginSuggestionMarketplaces", "Plugin suggestion marketplaces", "Marketplaces whose plugins may appear as contextual install suggestions.", "acme-tools", { scope: "managed" }),
      str("pluginTrustMessage", "Plugin trust message", "Your own text appended to the plugin trust warning.", "Plugins from acme-tools are vetted by Security.", { scope: "managed" }),
      list("prependPlugins", "Mods that run first", "Managed plugins whose mods run before every user-installed mod.", "sec-default@builtin", { scope: "user" }),
      list("appendPlugins", "Mods that run last", "Managed plugins whose mods run after every user-installed mod.", "audit@acme-tools", { scope: "user" }),
      bool("disableCommandPluginSources", "Block command-sourced plugins", "Never run a marketplace-declared install command.", false, { scope: "managed" }),
      bool("disableSideloadFlags", "Reject sideload flags", "Reject --plugin-dir, --plugin-url, --agents and --mcp-config at startup.", false, { scope: "managed" }),
      bool("sandbox.network.allowManagedDomainsOnly", "Sandbox: managed domains only", "Honor only allowedDomains from managed settings.", false, { scope: "managed" }),
      bool("sandbox.filesystem.allowManagedReadPathsOnly", "Sandbox: managed read paths only", "Honor only allowRead entries from managed settings.", false, { scope: "managed" }),
      str("sandbox.bwrapPath", "Sandbox: bubblewrap path", "Absolute path to a bwrap binary outside PATH.", "/opt/bin/bwrap", { scope: "managed" }),
      str("sandbox.socatPath", "Sandbox: socat path", "Absolute path to a socat binary outside PATH.", "/opt/bin/socat", { scope: "managed" }),
      list("sshHostAllowlist", "Desktop SSH host allowlist", "Hosts a Desktop SSH session may connect to.", "*.example.com", { scope: "managed" }),
      bool("disableDesktopLocalSessions", "Disable Desktop local sessions", "Force Desktop Code sessions onto remote machines.", false, { scope: "managed" }),
      bool("disableBrowserExternalNavigation", "Desktop: block external browsing", "Turn off external browsing in the Browser pane.", false, { scope: "managed" }),
      select("browserExternalPageTools", "Desktop: Claude's tools on external pages", "Stop Claude reading or acting on external pages in the Browser pane.", ["disabled"], { scope: "managed", unset: "(allowed)" }),
      bool("disableMobileSimulatorTools", "Desktop: block iOS Simulator tools", "Remove Claude's access to the iOS Simulator pane.", false, { scope: "managed" }),
      bool("forceRemoteSettingsRefresh", "Block startup until managed settings refresh", "Fail closed if server-managed settings can't be fetched.", false, { scope: "managed" }),
      select("managedSourcesBehavior", "Multiple managed sources", "Apply only the highest-priority managed source, or merge them all.", ["first-wins", "merge"], { scope: "managed" }),
      select("parentSettingsBehavior", "Host-supplied managed settings", "How settings from an embedding host (Agent SDK, IDE) combine with the admin tier.", ["first-wins", "merge"], { scope: "managed" }),
      json("policyHelper", "Policy helper", "Executable that computes managed settings at startup.", '{ "path": "/opt/corp/claude-policy", "timeoutMs": 10000 }', { scope: "managed", rows: 2 }),
      bool("wslInheritsWindowsSettings", "WSL inherits Windows policy", "Read managed settings from the Windows policy chain on WSL.", false, { scope: "managed" }),
    ], true),
  ],
};

export type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "PostToolBatch"
  | "PermissionRequest"
  | "PermissionDenied"
  | "UserPromptSubmit"
  | "UserPromptExpansion"
  | "SessionStart"
  | "SessionEnd"
  | "Setup"
  | "Stop"
  | "StopFailure"
  | "Notification"
  | "PreCompact"
  | "PostCompact"
  | "PreModelSwitch"
  | "PostModelSwitch"
  | "SubagentStart"
  | "SubagentStop"
  | "TeammateIdle"
  | "TaskCreated"
  | "TaskCompleted"
  | "FileChanged"
  | "CwdChanged"
  | "DirectoryAdded"
  | "WorktreeCreate"
  | "WorktreeRemove"
  | "ConfigChange"
  | "InstructionsLoaded"
  | "MessageDisplay"
  | "Elicitation"
  | "ElicitationResult";

export const hookEvents: { value: HookEvent; label: string; tooltip: string }[] = [
  {
    value: "PreToolUse",
    label: "PreToolUse",
    tooltip: "Before any tool runs. Can allow, deny, ask, or defer the call.",
  },
  {
    value: "PostToolUse",
    label: "PostToolUse",
    tooltip: "After a tool runs successfully. Use to lint, format, log.",
  },
  {
    value: "PostToolUseFailure",
    label: "PostToolUseFailure",
    tooltip: "After a tool call fails. React to or block on errors.",
  },
  {
    value: "PostToolBatch",
    label: "PostToolBatch",
    tooltip: "After a batch of parallel tool calls completes.",
  },
  {
    value: "PermissionRequest",
    label: "PermissionRequest",
    tooltip: "When a permission dialog would show. Auto-allow or deny it.",
  },
  {
    value: "PermissionDenied",
    label: "PermissionDenied",
    tooltip: "After a permission was denied. Can request a retry.",
  },
  {
    value: "UserPromptSubmit",
    label: "UserPromptSubmit",
    tooltip: "When the user submits a prompt. Use to validate or enrich.",
  },
  {
    value: "UserPromptExpansion",
    label: "UserPromptExpansion",
    tooltip: "When a slash command expands. Matcher is the command name.",
  },
  {
    value: "SessionStart",
    label: "SessionStart",
    tooltip: "Session begins/resumes/clears/forks. Load context, set env.",
  },
  {
    value: "SessionEnd",
    label: "SessionEnd",
    tooltip: "Session ends. Clean up, flush logs, persist state.",
  },
  {
    value: "Setup",
    label: "Setup",
    tooltip: "Repo setup/maintenance entry points (init | maintenance).",
  },
  {
    value: "Stop",
    label: "Stop",
    tooltip: "Claude finishes a turn. Post-process, notify, or block to continue.",
  },
  {
    value: "StopFailure",
    label: "StopFailure",
    tooltip: "A turn ended with an error. Matcher is the error type.",
  },
  {
    value: "Notification",
    label: "Notification",
    tooltip: "Claude sends a notification (permission_prompt, idle_prompt, …).",
  },
  {
    value: "PreCompact",
    label: "PreCompact",
    tooltip: "Before context compaction (manual | auto). Save state.",
  },
  {
    value: "PostCompact",
    label: "PostCompact",
    tooltip: "After context compaction (manual | auto). Re-inject context.",
  },
  {
    value: "PreModelSwitch",
    label: "PreModelSwitch",
    tooltip: "Before the session switches model. Matcher is the target model name. Can block the switch.",
  },
  {
    value: "PostModelSwitch",
    label: "PostModelSwitch",
    tooltip: "After the session switched model. Matcher is the model name.",
  },
  {
    value: "SubagentStart",
    label: "SubagentStart",
    tooltip: "A subagent starts. Matcher is the agent type name.",
  },
  {
    value: "SubagentStop",
    label: "SubagentStop",
    tooltip: "Subagent finishes. Aggregate results.",
  },
  {
    value: "TeammateIdle",
    label: "TeammateIdle",
    tooltip: "An agent-team teammate goes idle. Keep it working or let it rest.",
  },
  {
    value: "TaskCreated",
    label: "TaskCreated",
    tooltip: "A task is created on the task list.",
  },
  {
    value: "TaskCompleted",
    label: "TaskCompleted",
    tooltip: "A task is marked completed. Verify or block completion.",
  },
  {
    value: "FileChanged",
    label: "FileChanged",
    tooltip: "A watched file changed. Matcher is the filename pattern.",
  },
  {
    value: "CwdChanged",
    label: "CwdChanged",
    tooltip: "The working directory changed.",
  },
  {
    value: "DirectoryAdded",
    label: "DirectoryAdded",
    tooltip: "A directory was added to the session (slash command or repo root).",
  },
  {
    value: "WorktreeCreate",
    label: "WorktreeCreate",
    tooltip: "A worktree is being created. Return a path to control placement.",
  },
  {
    value: "WorktreeRemove",
    label: "WorktreeRemove",
    tooltip: "A worktree is being removed. Clean up.",
  },
  {
    value: "ConfigChange",
    label: "ConfigChange",
    tooltip: "Settings/skills changed mid-session. Audit or block.",
  },
  {
    value: "InstructionsLoaded",
    label: "InstructionsLoaded",
    tooltip: "CLAUDE.md / instructions were loaded. Matcher is the load reason.",
  },
  {
    value: "MessageDisplay",
    label: "MessageDisplay",
    tooltip: "Before a message renders. Can replace the displayed content.",
  },
  {
    value: "Elicitation",
    label: "Elicitation",
    tooltip: "An MCP server asks the user for input. Accept, decline, or cancel.",
  },
  {
    value: "ElicitationResult",
    label: "ElicitationResult",
    tooltip: "After the user answers an MCP elicitation.",
  },
];

/** What each event's `matcher` filters on, with example values. Events absent
 *  from this map have no matcher support — Claude Code silently ignores one. */
export const hookMatcherHints: Partial<Record<HookEvent, { what: string; examples: string[] }>> = {
  PreToolUse: { what: "tool name", examples: ["Bash", "Edit|Write", "mcp__.*"] },
  PostToolUse: { what: "tool name", examples: ["Edit|Write", "Bash", "mcp__.*"] },
  PostToolUseFailure: { what: "tool name", examples: ["Bash", "Edit|Write"] },
  PermissionRequest: { what: "tool name", examples: ["Bash", "Edit|Write"] },
  PermissionDenied: { what: "tool name", examples: ["Bash", "mcp__.*"] },
  SessionStart: { what: "how the session started", examples: ["startup", "resume", "clear", "compact", "fork"] },
  SessionEnd: { what: "why the session ended", examples: ["clear", "resume", "logout", "prompt_input_exit", "other"] },
  Setup: { what: "which flag triggered setup", examples: ["init", "maintenance"] },
  Notification: {
    what: "notification type",
    examples: ["permission_prompt", "idle_prompt", "agent_needs_input", "agent_completed", "auth_success", "elicitation_dialog"],
  },
  SubagentStart: { what: "agent type", examples: ["general-purpose", "Explore", "Plan"] },
  SubagentStop: { what: "agent type", examples: ["general-purpose", "Explore", "Plan"] },
  PreCompact: { what: "what triggered compaction", examples: ["manual", "auto"] },
  PostCompact: { what: "what triggered compaction", examples: ["manual", "auto"] },
  PreModelSwitch: { what: "target model", examples: ["claude-opus-5-5", ".*opus.*", ".*fable.*"] },
  PostModelSwitch: { what: "target model", examples: ["claude-opus-5-5", ".*opus.*", ".*fable.*"] },
  ConfigChange: {
    what: "configuration source",
    examples: ["user_settings", "project_settings", "local_settings", "policy_settings", "skills"],
  },
  DirectoryAdded: { what: "how the directory was added", examples: ["slash_command", "register_repo_root"] },
  FileChanged: { what: "literal filenames to watch", examples: [".envrc|.env", "package.json"] },
  StopFailure: {
    what: "error type",
    examples: ["rate_limit", "overloaded", "authentication_failed", "billing_error", "server_error", "max_output_tokens"],
  },
  InstructionsLoaded: {
    what: "load reason",
    examples: ["session_start", "nested_traversal", "path_glob_match", "include", "compact"],
  },
  UserPromptExpansion: { what: "skill or command name", examples: ["deploy", "code-review"] },
  Elicitation: { what: "MCP server name", examples: ["github"] },
  ElicitationResult: { what: "MCP server name", examples: ["github"] },
};

/** Events whose handlers can filter further with an `if` permission rule. */
export const hookToolEvents: HookEvent[] = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PermissionRequest",
  "PermissionDenied",
];
