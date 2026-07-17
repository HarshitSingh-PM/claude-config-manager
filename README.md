# Claude Config Manager

[![npm](https://img.shields.io/npm/v/claude-config-ui.svg)](https://www.npmjs.com/package/claude-config-ui)
[![GitHub release](https://img.shields.io/github/v/release/HarshitSingh-PM/claude-config-manager?include_prereleases&label=mac%20app)](https://github.com/HarshitSingh-PM/claude-config-manager/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/claude-config-ui.svg)](#requirements)

A local, open-source UI for editing every Claude Code config file from one place — `settings.json`, `CLAUDE.md`, `.mcp.json`, subagents, slash commands, output styles, keybindings — plus a built-in **credentials manager** so you set GitHub / AWS / Vercel / Stripe / etc. once and they're available across every project.

<p align="center">
  <a href="https://github.com/HarshitSingh-PM/claude-config-manager/releases/latest"><img alt="Download for macOS — Apple Silicon" src="https://img.shields.io/badge/download-macOS%20Apple%20Silicon%20%E2%86%93-7c3aed?style=for-the-badge&logo=apple&logoColor=white"></a>
  &nbsp;
  <a href="https://github.com/HarshitSingh-PM/claude-config-manager/releases/latest"><img alt="Download for macOS — Intel" src="https://img.shields.io/badge/download-macOS%20Intel%20%E2%86%93-6d28d9?style=for-the-badge&logo=apple&logoColor=white"></a>
  &nbsp;
  <a href="https://github.com/HarshitSingh-PM/claude-config-manager/releases/latest"><img alt="Download for Windows" src="https://img.shields.io/badge/download-Windows%20%E2%86%93-5b21b6?style=for-the-badge&logo=windows&logoColor=white"></a>
</p>

<p align="center">
  <em>or, in any terminal:</em>&nbsp;&nbsp;<code>npx claude-config-ui</code>
</p>

<img width="800" height="387" alt="Image" src="https://github.com/user-attachments/assets/a88af615-a4d2-450e-bc11-6accd6644bf5" />

> Files saved by this tool land in Claude Code's standard locations. Claude Code picks them up automatically on the next session start. No daemons, no symlinks, no special integration step.

## Install

### Mac app

Download from the [latest release](https://github.com/HarshitSingh-PM/claude-config-manager/releases/latest):

- **`Claude Config-X.Y.Z-arm64.dmg`** — Apple Silicon (M1 / M2 / M3 / M4 Macs, 2020+)
- **`Claude Config-X.Y.Z-x64.dmg`** — Intel Macs (2019 and earlier)

Open the `.dmg`, drag **Claude Config** to **Applications**, launch from Spotlight or Launchpad.

> **First launch (one time):** macOS Gatekeeper will block the unsigned app. **Right-click → Open** the first time, then click **Open** in the dialog. After that it launches normally. (Or run `xattr -dr com.apple.quarantine "/Applications/Claude Config.app"` once.)

### Windows app

Download `Claude-Config-X.Y.Z-x64-setup.exe` from the [latest release](https://github.com/HarshitSingh-PM/claude-config-manager/releases/latest), run the installer, then launch **Claude Config** from the Start menu.

> **First launch (one time):** Windows SmartScreen will block the unsigned installer. Click **More info** → **Run anyway**. Standard for indie/OSS apps without a code-signing certificate.

### Command-line (any OS)

```bash
npx claude-config-ui
```

The launcher picks a free port, opens your browser, and detects your OS-correct paths automatically. Press `Ctrl+C` to stop.

---

## Why

Claude Code reads config from 30+ possible files across user, project, project-local, and enterprise scopes. People learn the system by trial-and-error or by copy-pasting community gists. This tool turns that into a guided form.

- **Auto-detected paths** — `~/.claude/` on macOS/Linux, `%APPDATA%\Claude\` on Windows, project paths from your repo, enterprise paths from `/Library/Application Support/ClaudeCode/` or `/etc/claude-code/`.
- **Every field has a tooltip** explaining what it does AND why it matters.
- **Community presets** baked in — Karpathy's 4-rules CLAUDE.md, HumanLayer's skeleton, Trail of Bits credential lockdown, popular hook recipes — drop them in with one click.
- **Auto-backup** — every save writes a `*.bak-<timestamp>` next to the original. Nothing is lost.
- **Autosave** — 1.2s debounce, smart backup policy that doesn't pollute your folder with hundreds of `.bak` files.
- **Path sandbox** — the API refuses to read or write anything outside your home directory, current working directory, or known Claude Code enterprise dirs.
- **Credentials catalog** — 28 services across cloud / deploy / SCM / databases / collaboration / AI / payments / email / observability. Set once at user scope, export to every project.

---

## The four scopes

This mirrors how Claude Code actually resolves config:

| Tab | What | Path |
| --- | --- | --- |
| **Global Claude** | Your personal user-level config (all projects) | `~/.claude/` |
| **Global Project** | Team-shared project config (committed to git) | `<project>/.claude/` + `<project>/CLAUDE.md` + `<project>/.mcp.json` |
| **Local Claude** | Personal overrides for one project (gitignored) | `<project>/.claude/settings.local.json` + `<project>/CLAUDE.local.md` |
| **Project Local (Enterprise)** | Organization policy deployed by IT (highest precedence) | `/Library/Application Support/ClaudeCode/` (mac), `C:\Program Files\ClaudeCode\` (win), `/etc/claude-code/` (linux) |

Precedence (lowest → highest, later wins): user → project shared → project local → enterprise.

---

## What it edits

For each scope, the relevant files are surfaced as a sidebar list. Click one to edit:

- **`settings.json`** — model, permissions (allow/deny/ask), hooks, status line, env, sandbox, telemetry, output style, theme.
- **Credentials** *(Global Claude only)* — AWS, GCP, Azure, DigitalOcean, Cloudflare, Fly, Vercel, Netlify, Heroku, Railway, GitHub, GitLab, Bitbucket, Postgres, Supabase, Neon, MongoDB, Redis, Slack, Linear, Notion, Atlassian, OpenAI, Anthropic, Mistral, Hugging Face, Stripe, Resend, SendGrid, Sentry, Datadog — masked inputs, eye-toggles, deep links to where to get each token, written into the `env` block of `~/.claude/settings.json`.
- **`CLAUDE.md`** (and `CLAUDE.local.md`) — markdown editor with line/char counts and 12 section templates (overview, stack, commands, structure, conventions, testing, architecture, hard rules, workflow, tooling, @imports, personal style). Plus four full-doc presets (Karpathy, HumanLayer, Trail of Bits, Minimal personal).
- **`.mcp.json`** — list of MCP servers with type-specific fields (stdio command/args; http URL/headers; env, alwaysLoad).
- **`keybindings.json`** — context-scoped key bindings (Chat / Global / Confirmation).
- **`agents/`** — list view of subagent markdown files; edit frontmatter (name/description/model/effort/tools/isolation) + body. Templates: `code-reviewer`, `security-auditor`, `test-writer`, `debugger`, `docs-writer`.
- **`commands/`** — slash commands. Templates: `/review`, `/commit`, `/tdd`, `/explore`, `/security-scan`.
- **`output-styles/`** — frontmatter + body for tone presets. Templates: `terse`, `explanatory`, `pr-review-mode`.
- **`managed-settings.json`** — enterprise policy.

---

## MCP servers

A dedicated **MCP** tab manages the Model Context Protocol servers Claude Code connects to, across all three scopes (user → `~/.claude.json`, project → `.mcp.json`, local → `~/.claude.json` project entry). You can:

- **See** every configured server with its scope, transport (stdio/http/sse/ws), auth model, and `alwaysLoad` state
- **Enable / disable** a server to save context — since Claude Code has no native per-server disable flag, the app reversibly stashes the config out of the live file and restores it on enable (your other `~/.claude.json` state is preserved, with a backup)
- **Add / remove / edit** servers (guided fields + a JSON body editor)
- **Resolve issues**: per-server diagnostics detect the auth model (OAuth / header token / `headersHelper` / env-var) and give the exact fix — including copy-paste `/mcp` (authenticate & reconnect), `claude mcp get <name>`, and `claude mcp reset-project-choices`. Secret values are masked.

> Context tip surfaced in the tab: tool search defers MCP tools by default, so servers barely cost context; `alwaysLoad: true` is what forces them in.

---

## Agent Orchestrator

The **Orchestrator** tab is a live, visual team board for running Claude agents. Launch one agent on a task, or launch several at once — each runs concurrently as its own card, and you watch the work happen in real time.

- **See what's already running** — the board's "Running on this machine" section discovers the claude sessions you didn't launch here (terminals, other Claude Code windows) by counting live `claude` processes and tailing recent session transcripts, showing each one's current activity, model, project, and a `claude --resume` command. These are observed read-only.
- **Launch agents individually** — pick the general agent or any of your subagent definitions (from `~/.claude/agents` and the project's `.claude/agents`), choose the model, permission mode, working directory, and a turn cap, then give it a task. Fire off as many as you like.
- **Launch a team** — flip the panel to **Team** mode and pick a template (Build squad / Ship crew / Research pod / Bug hunt) or a custom set of roles. Run it **orchestrated** (one lead agent delegates to the roles, shown as one card with the hierarchy) or **parallel** (one agent per role, grouped on the board).
- **Campaigns** — for multi-week work, create a campaign with an objective and a self-updating plan. Hit **Run next session** whenever you like; each session seeds a fresh agent with the saved plan + recent progress, does a chunk, and writes the plan back — so it survives app restarts and picks up exactly where it left off.
- **Continue / resume** — any finished run (and any observed terminal session) has a **Continue** action that resumes it with `claude -p --resume <session>`, carrying full prior context.
- **See the hierarchy** — every tool call, skill, MCP call, and **spawned sub-agent** is rendered as a colour-coded tree as it happens (sub-agents nest under the agent that delegated to them). Pick a subagent at launch and it's delegated to, so the hierarchy shows up on the board.
- **Track each agent live** — current activity, elapsed time, running cost, tokens, turns, and sub-agent count per card; a global **Skill activity** feed shows which skills/tools are firing across all agents.
- **Measurement** — a metrics view aggregates finished runs: success rate, total cost and tokens, breakdowns by agent and model, and top skills/tools. Run history persists across restarts.

Under the hood it spawns headless `claude -p … --output-format stream-json` processes and parses the event stream — no extra dependencies, using your already-authenticated `claude` CLI. Stop any agent mid-run, and grab a `claude --resume <session>` command to pick a run back up in your terminal.

> Permission modes map to the CLI: **Plan** (read-only, makes no changes), **Accept edits** (does the work — the default), **Auto** (model decides per call), or **Full auto** (skips every check — only for fully trusted tasks). Requires the `claude` CLI on your `PATH` (or set `CLAUDE_BIN`).

---

## Transfer — move your setup to another machine

The **Transfer** tab packs your whole Claude world into one encrypted `.ccsync` file and restores it on another laptop.

- **What goes in** — pick from live-counted categories: `~/.claude.json` (MCP servers with their API keys), settings, global `CLAUDE.md`, agents, skills, commands, keybindings, per-project auto-memory, and this app's own data (orchestrator history, campaigns). Add any extra files or folders under your home directory — `.env` files ride along too.
- **Real encryption** — the bundle is sealed with AES-256-GCM; the key is derived from your passphrase with scrypt. Nothing readable leaves your machine, so the file is safe to move over AirDrop, iCloud Drive, or a USB stick.
- **Safe restore** — on the other laptop, run `npx claude-config-ui`, open Transfer, and unlock the bundle. You get a per-file preview (new / changed / identical) with new-and-changed pre-selected; anything you overwrite is backed up first to `~/.claude-config-ui/transfer-backups/<timestamp>/`. Restores refuse paths outside your home directory.
- **Login stays out on purpose** — the Claude OAuth token is per-machine and refreshes, so it isn't bundled. Run `claude` and `/login` once on the new laptop; your subscription covers multiple machines.

---

## Interface & motion

The whole app is built to feel alive and readable: animated view transitions, staggered entrances, hover-lift cards, count-up metrics, animated expand/collapse, and skeleton loaders — all of which honour `prefers-reduced-motion`. Status is colour-coded like a traffic light — **green** for live / running / healthy, **red** for errors / failures, **amber** for pending / needs-review — so you can read state at a glance.

---

## Home dashboard

The app opens on a **Home** dashboard — a control center so you're not dropped straight into the dense Global Claude config. It shows KPI cards (projects, sessions + disk used, config health, context-vault coverage), an "At a glance" panel, and **Recommended next steps** derived from your actual setup (e.g. lock down credential reads, enable the sandbox, review a `bypassPermissions` default, add `logic.md` to projects, clean up tiny sessions). Every card and step deep-links into the relevant section.

---

## Projects

The **Projects** tab gives you a bird's-eye view of every project on your machine that uses Claude — discovered by scanning your common code roots (`~`, `~/projects`, `~/Developer`, `~/Documents`, …) and decoding the working directories of your recent Claude Code sessions (`~/.claude/projects/`). Projects you've actually used with Claude are flagged and sorted to the top by recency.

It also surfaces folders that aren't git repos and have no `CLAUDE.md`, but that your Claude sessions clearly worked on (e.g. a quick prototype) — promoted into the list automatically.

Pick a project and edit its project-level local files inline, all in one place:

- `CLAUDE.md` · `CLAUDE.local.md` · `summary.md` · `AGENTS.md`
- `.claude/settings.json` · `.claude/settings.local.json` · `.mcp.json`

Files that don't exist yet show a **new** badge — create them from a template or blank in one click. Every save still writes a timestamped `.bak`, and the same path sandbox applies.

### Claude sessions

Both per-project and as one global **All sessions** list, you can see every Claude Code session (the same ones `/resume` shows) with its first prompt, last-worked time, message count, size, and the project it worked on (auto-detected from the file paths each session touched). You can:

- **Sort** by last worked, first started, message count, size, or name
- **Rename** a session to a friendly label for easy reference
- **Reassign** a session to a different project if the auto-detection got it wrong
- **Delete** small or throwaway sessions to clean up (this frees disk and removes them from `/resume`)

### logic.md — a per-project decision log

Each project gets a `logic.md`: a long-term memory of the decisions, rules, and rationale behind it, so they don't get re-litigated or forgotten across sessions. These files live in a central **context vault** (default `~/ClaudeContext/<project>/`, configurable in the Projects header).

Toggle **Auto-maintain logic.md** to inject a small managed block into your global `~/.claude/CLAUDE.md` that tells Claude to read each project's `logic.md` every session and append decisions (and a summary of the logical instructions you give) as you make them — bringing that context back into scope automatically. Toggle it off to remove the block cleanly.

### credentials.md — track & rotate keys

Each project also gets a `credentials.md` in the same vault: a local-only inventory of the API keys, tokens, and passwords the project uses, so you can see what exists and when to rotate. Because it lives in the vault (outside any git repo) it can't be accidentally committed. The same auto-maintain toggle tells Claude to record any credential you share into it — as a **masked** value (prefix + last 4 only), with where it lives and a rotation status. It's plaintext and meant as a tracker, not a secret store; for high-value secrets use an encrypted store.

---

## Requirements

- Node.js 20.9 or newer
- macOS, Windows, or Linux

---

## Alternative install paths

### From source (for development or contributing)

```bash
git clone https://github.com/HarshitSingh-PM/claude-config-manager.git
cd claude-config-manager
npm install
npm run dev
# → http://localhost:3000
```

### Global install (skip `npx`)

```bash
npm install -g claude-config-ui
claude-config-ui
# or:
ccm
```

> The npm package is named `claude-config-ui` (the bare `claude-config-manager` was already taken). The GitHub repo keeps the `claude-config-manager` name.

---

## Configuration

Everything is auto-detected from your operating system. The only thing you set in the UI is the **project directory** for project-scoped tabs (defaults to wherever you launched the tool from). There's no `.env`, no config file, nothing to set up.

To point at a different project, paste its absolute path into the project field at the top of the page.

**Environment variables**:

- `PORT` — override the default `3737`.
- `CCM_NO_OPEN=1` — don't auto-open the browser on launch.

---

## How auto-detection works

- **macOS / Linux**: `~/.claude/` for user scope; `/Library/Application Support/ClaudeCode/` or `/etc/claude-code/` for enterprise.
- **Windows**: `%APPDATA%\Claude\` for user scope; `C:\Program Files\ClaudeCode\` for enterprise.
- **Project**: any directory you point at. The tool reads existing files if present and creates them on save if not.

The tool labels each file as `git-tracked` or `gitignored` in the editor so you always know which side of the `.gitignore` you're on.

---

## Safety

- Every write makes a timestamped `.bak-*` copy of the existing file first (autosaves create only one `.bak` per file per session — escape valve is the manual Save button).
- The file API refuses paths outside `~`, `cwd`, and known Claude Code enterprise directories.
- Deleting a subagent or slash command also writes a backup before removing the original.
- JSON output is pretty-printed with 2-space indent.
- Markdown frontmatter is round-tripped via `js-yaml` (preserves keys, drops empties).
- Credentials are written to the `env` block of `~/.claude/settings.json` — **plain text on disk**. Fine for personal-laptop API keys; for high-blast-radius prod secrets use Claude Code's `apiKeyHelper` instead (a shell command that fetches the value from your keychain at runtime).

---

## Stack

- Next.js 16 (App Router, Turbopack, React 19.2) — standalone server output for npx
- TypeScript strict
- Tailwind CSS 4
- Framer Motion (animations)
- Radix UI Tooltip (accessible tooltips)
- Lucide icons
- `js-yaml` for frontmatter parsing
- Electron (Mac `.dmg` distribution only — npm package is pure Node)

## Building desktop apps yourself

```bash
npm install
npm run dmg          # macOS arm64 .dmg → dist-electron/
npm run exe          # Windows x64 NSIS .exe → dist-electron/
# explicit arch:
npx electron-builder --mac dmg --x64       # Intel Mac .dmg
npx electron-builder --win nsis --x64      # Windows x64 .exe
```

> **Cross-compiling to Windows from Apple Silicon Macs** needs Rosetta installed (electron-builder uses an x86_64 `wine64` binary to set the .exe's icon and version metadata). One-time setup: `sudo softwareupdate --install-rosetta --agree-to-license`.

Builds are unsigned by default. To sign for distribution: set `mac.identity` to your Apple Developer cert name in `package.json#build.mac` (and flip `mac.hardenedRuntime` to `true`); for Windows, add `win.certificateFile` + `certificatePassword` (or use Azure SignTool).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). The easiest contributions:

- Add a new service to the Credentials catalog (`src/lib/credentialsCatalog.ts`)
- Add a new CLAUDE.md section template (`src/lib/presets/claudemdSections.ts`)
- Add a new subagent / slash command template (`src/lib/presets/agents.ts`, `commands.ts`)

---

## License

MIT. See [LICENSE](./LICENSE).

---

## Acknowledgements

Schema and presets are drawn from:

- Official Claude Code docs (docs.claude.com)
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
- [trailofbits/claude-code-config](https://github.com/trailofbits/claude-code-config)
- [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents)
- [wshobson/commands](https://github.com/wshobson/commands)
- HumanLayer's "Writing a good CLAUDE.md"
- Karpathy's trending CLAUDE.md gist
- [disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery)
