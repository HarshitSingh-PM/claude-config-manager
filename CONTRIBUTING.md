# Contributing

Thanks for considering a contribution. This is a small, focused tool — kept intentionally simple — so the bar for new features is "does it make a real Claude Code user's config life easier, today?"

## Quick start (development)

```bash
git clone https://github.com/HarshitSingh-PM/claude-config-manager.git
cd claude-config-manager
npm install
npm run dev
# → http://localhost:3000
```

Node 20.9+ required (Next.js 16).

## What's easy to contribute

These are low-friction, high-value additions:

- **New service in the Credentials catalog.** Add an entry to `src/lib/credentialsCatalog.ts`. Each entry needs: env-var names that match what the underlying tool/MCP expects, a docs URL, a one-line description.
- **New CLAUDE.md section template.** Add to `src/lib/presets/claudemdSections.ts`. Lead with `## Heading` so it composes with other sections. Include a realistic example, not just headings.
- **New subagent / slash-command / output-style template.** Add to `src/lib/presets/agents.ts`, `commands.ts`, or `outputStyles.ts`. Cite the source.
- **New `settings.json` preset.** Add to `src/lib/presets/settings.ts`. Patches are merged into the existing draft (arrays are unioned).

For all of these: open a PR with the new file/entry and a one-paragraph "why this is useful" in the PR description. No issue required first.

## What needs discussion first

Open an issue before starting if your change touches:

- **The 4-tab scope model** (User / Project-shared / Project-local / Enterprise) — these mirror how Claude Code resolves config; we don't want to drift.
- **The file write API** (`src/app/api/file/route.ts`) — its allow-list and backup behavior is part of the safety story.
- **New file types** beyond what Claude Code itself reads.
- **External services or cloud sync** — this is a *local* tool. No data leaves the user's machine.

## Code style

- TypeScript strict. Don't disable rules to silence errors.
- One concern per PR. A new credentials service is one PR; refactoring the form layout is another.
- Match the existing shape — schema-driven forms via `Field.tsx`, design tokens in `globals.css`, motion via `framer-motion`.
- New runtime dependencies are looked at carefully. Build-time deps are easier.

## Testing your change

```bash
npm run lint      # ESLint
npm run build     # Type-check + production build
```

For UI changes, also run `npm run dev` and exercise the actual flow you changed.

## Release process

Maintainer-only:

```bash
npm version patch  # or minor / major
npm run build:standalone
npm publish        # prepublishOnly re-runs the standalone build
git push --tags
```

`prepublishOnly` ensures `.next/standalone/` is fresh before publishing.

## Reporting bugs

Open an issue with:
- OS + Node version (`node --version`)
- Steps to reproduce
- What you expected vs what happened
- Any error from the terminal where you ran `npx claude-config-manager`

## License

By contributing, you agree your contribution is licensed under the [MIT license](./LICENSE).
