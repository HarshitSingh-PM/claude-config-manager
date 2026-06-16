export type SettingsPreset = {
  id: string;
  title: string;
  source: string;
  description: string;
  patch: Record<string, unknown>;
};

export const settingsPresets: SettingsPreset[] = [
  {
    id: "lockdown-credentials",
    title: "Lock down credentials",
    source: "Trail of Bits claude-code-config",
    description: "Block Claude from reading common secret/credential paths.",
    patch: {
      permissions: {
        deny: [
          "Read(./.env)",
          "Read(./.env.*)",
          "Read(./secrets/**)",
          "Read(~/.ssh/**)",
          "Read(~/.gnupg/**)",
          "Read(~/.aws/**)",
          "Read(~/.azure/**)",
          "Read(~/.kube/**)",
          "Read(~/.docker/config.json)",
          "Read(~/.npmrc)",
          "Read(~/.pypirc)",
          "Read(~/.gem/credentials)",
          "Read(~/.git-credentials)",
          "Read(~/.config/gh/**)",
          "Read(~/Library/Keychains/**)",
          "Edit(~/.bashrc)",
          "Edit(~/.zshrc)",
        ],
      },
    },
  },
  {
    id: "block-destructive",
    title: "Block destructive commands",
    source: "Klement Gunndu — 5 permission patterns",
    description: "Stop force-pushes, rm -rf, raw curl/wget.",
    patch: {
      permissions: {
        deny: ["Bash(rm -rf *)", "Bash(curl *)", "Bash(wget *)", "Bash(git push --force *)"],
      },
    },
  },
  {
    id: "fast-greenlight",
    title: "Greenlight common safe commands",
    source: "community consensus",
    description: "Auto-approve lint/test/status/diff so you stop clicking.",
    patch: {
      permissions: {
        allow: [
          "Bash(npm run lint)",
          "Bash(npm run test *)",
          "Bash(npm test *)",
          "Bash(pnpm test *)",
          "Bash(bun test *)",
          "Bash(python -m pytest *)",
          "Bash(ruff check *)",
          "Bash(git status)",
          "Bash(git diff *)",
          "Bash(git log *)",
        ],
      },
    },
  },
  {
    id: "format-on-edit",
    title: "Hook: format on edit",
    source: "claudefa.st + Builder.io",
    description: "Run prettier after every Edit/Write/MultiEdit.",
    patch: {
      hooks: {
        PostToolUse: [
          {
            matcher: "Edit|Write|MultiEdit",
            hooks: [
              {
                type: "command",
                // Hook input arrives as JSON on stdin; pull the edited file path from it.
                command:
                  "f=$(jq -r '.tool_input.file_path // empty'); [ -n \"$f\" ] && prettier --write \"$f\" 2>/dev/null || true",
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "bash-audit-log",
    title: "Hook: log every Bash command",
    source: "Trail of Bits",
    description: "Append all Bash invocations to ~/.claude/bash-commands.log.",
    patch: {
      hooks: {
        PostToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: "jq -r '.tool_input.command' >> ~/.claude/bash-commands.log",
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "block-rm-rf",
    title: "Hook: block rm -rf in Bash",
    source: "disler/claude-code-hooks-mastery",
    description: "PreToolUse hook that exits 2 (blocking) if a Bash command contains rm -rf.",
    patch: {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  "jq -r '.tool_input.command' | grep -q 'rm -rf' && { echo 'rm -rf blocked by hook' >&2; exit 2; } || exit 0",
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "plan-mode-first",
    title: "Plan-mode first",
    source: "Anthropic — permission modes",
    description: "Default to read-only planning; Claude proposes a plan before touching anything.",
    patch: {
      permissions: {
        defaultMode: "plan",
      },
    },
  },
  {
    id: "trust-project-mcp",
    title: "Auto-approve this project's MCP servers",
    source: "Anthropic — MCP settings",
    description: "Skip the approval prompt for MCP servers defined in this project's .mcp.json.",
    patch: {
      enableAllProjectMcpServers: true,
    },
  },
  {
    id: "session-context-loader",
    title: "Hook: load project context on start",
    source: "community — SessionStart context injection",
    description:
      "On session start, inject .claude/context.md into the conversation (its stdout is added to context).",
    patch: {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command: "cat .claude/context.md 2>/dev/null || true",
              },
            ],
          },
        ],
      },
    },
  },
];
