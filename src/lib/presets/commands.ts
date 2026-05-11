export type CommandTemplate = {
  id: string;
  title: string;
  source: string;
  description: string;
  fm: Record<string, unknown>;
  body: string;
};

export const commandTemplates: CommandTemplate[] = [
  {
    id: "review",
    title: "/review",
    source: "Builder.io guide",
    description: "Review the current staged diff. Surface real issues.",
    fm: {
      name: "review",
      description: "Reviews the currently staged diff for bugs, security, performance, readability.",
      "argument-hint": "[focus-area]",
      "allowed-tools": ["Bash(git diff *)", "Bash(git status)", "Read", "Grep"],
    },
    body: `Review the staged diff below. Optional focus area: **$ARGUMENTS**

!\`git diff --staged\`

For each issue you find, output:

- **Severity**: blocker / major / nit
- **File:line**: where
- **Why**: one sentence
- **Fix**: concrete suggestion

Skip the praise. Only output issues. If there are no real issues, say
"No issues found" and stop.
`,
  },
  {
    id: "commit",
    title: "/commit",
    source: "rishabhsonker gist",
    description: "Draft a conventional commit message from staged changes.",
    fm: {
      name: "commit",
      description: "Draft a conventional commit message from the currently staged changes.",
      "allowed-tools": ["Bash(git diff *)", "Bash(git status)", "Bash(git log *)"],
    },
    body: `Draft a commit message for the staged changes.

!\`git status\`
!\`git diff --staged\`

Recent commit style:
!\`git log -5 --oneline\`

Rules:
- Match the repository's existing commit style (Conventional Commits / plain
  English / etc.) — infer from the recent log.
- First line: ≤ 72 chars, imperative mood ("add" not "added").
- Body (if needed): explain **why**, not what. The diff shows the what.
- No emoji unless the recent log uses them.
- No mention of Claude or AI tools in the message.

Output the message ready to paste. Do not run \`git commit\`.
`,
  },
  {
    id: "tdd",
    title: "/tdd",
    source: "wshobson/commands",
    description: "Red → green → refactor for the function or feature you describe.",
    fm: {
      name: "tdd",
      description: "Test-driven development cycle: write failing test, make it pass, refactor.",
      "argument-hint": "<feature or function>",
      "allowed-tools": ["Read", "Grep", "Edit", "Write", "Bash"],
    },
    body: `Build **$ARGUMENTS** using TDD.

Steps (do them in order, do not skip):

1. **Red**: write one failing test for the smallest piece of behavior.
   Show me the test. Run it. Confirm it fails for the right reason.
2. **Green**: write the minimum code to make that test pass. Show me the
   diff. Run the test. Confirm it passes.
3. **Refactor**: clean up only what you just wrote, only if there's
   something to clean. Re-run tests to confirm green.
4. **Repeat** for the next smallest behavior, until the feature is complete.

Rules:
- One test, one increment. No "let me write 5 tests upfront."
- Each step is its own message — don't batch them.
- If a step takes more than ~20 lines of code, the step is too big.
- Use the project's existing test framework. Do not introduce a new one.
`,
  },
  {
    id: "explore",
    title: "/explore",
    source: "rishabhsonker gist",
    description: "Guided codebase exploration when you join a new project.",
    fm: {
      name: "explore",
      description: "Survey a codebase: structure, entry points, conventions, where work happens.",
      "allowed-tools": ["Read", "Grep", "Glob", "Bash(git log *)", "Bash(git ls-files *)"],
    },
    body: `Survey this codebase and report what someone joining the team
needs to know to make their first change. Focus area (optional): $ARGUMENTS

Read in this order:

1. \`README.md\`, \`CLAUDE.md\`, \`AGENTS.md\` — what does this project claim
   to be?
2. \`package.json\` / \`pyproject.toml\` / \`Cargo.toml\` / etc. — stack and
   tooling.
3. Top-level directory listing (\`ls\`).
4. Entry point (\`src/index.*\`, \`src/app/\`, \`main.go\`, etc.).
5. Last 20 commits (\`git log --oneline -20\`) — where is the team
   actually working?

Output:

- **One paragraph**: what this project does and how it's organized.
- **Stack & versions**: bulleted.
- **Entry point**: file path and 2-sentence description.
- **Where work happens lately**: the 2-3 directories with recent commits.
- **Build & test commands**: only commands that actually exist in
  package.json / Makefile / etc. — do not invent.
- **One landmine to watch for**: anything weird you spotted (a CLAUDE.md
  rule, a custom lint config, a non-obvious dependency).
`,
  },
  {
    id: "security-scan",
    title: "/security-scan",
    source: "wshobson/commands",
    description: "Quick security pass over the current diff or whole repo.",
    fm: {
      name: "security-scan",
      description: "Run a security audit on the current changes (or whole repo if no diff).",
      "allowed-tools": ["Read", "Grep", "Glob", "Bash(git diff *)"],
    },
    body: `Audit for security issues. Scope: $ARGUMENTS (default: staged
diff if any, otherwise whole repo).

Look for:

- **Secrets** committed: API keys, tokens, passwords, private keys in
  source or fixtures.
- **Injection**: unparameterized SQL, \`shell=True\` with user input,
  template literals into HTML/XML.
- **Auth**: missing authz on routes, JWT \`alg: none\`, sessions that
  never expire.
- **Crypto**: MD5/SHA1 for security purposes, hardcoded keys/IVs,
  homemade crypto.
- **Deserialization**: \`pickle\`, \`yaml.load\` (not \`safe_load\`),
  \`eval\` on untrusted input.
- **Logging**: PII or secrets in logs.

For each finding:
- **Severity**: Critical / High / Medium / Low
- **CWE**: if applicable
- **Location**: file:line
- **Evidence**: 1-3 line snippet
- **Fix**: concrete remediation

If clean, say so explicitly. Don't pad findings.
`,
  },
];
