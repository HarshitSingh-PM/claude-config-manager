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

## Projects

The **Projects** tab gives you a bird's-eye view of every project on your machine that uses Claude — discovered by scanning your common code roots (`~`, `~/projects`, `~/Developer`, `~/Documents`, …) and decoding the working directories of your recent Claude Code sessions (`~/.claude/projects/`). Projects you've actually used with Claude are flagged and sorted to the top by recency.

Pick a project and edit its project-level local files inline, all in one place:

- `CLAUDE.md` · `CLAUDE.local.md` · `summary.md` · `AGENTS.md`
- `.claude/settings.json` · `.claude/settings.local.json` · `.mcp.json`

Files that don't exist yet show a **new** badge — create them from a template or blank in one click. Every save still writes a timestamped `.bak`, and the same path sandbox applies.

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
