import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { readAppConfig } from "@/lib/appConfig";

export const dynamic = "force-dynamic";

// We inject a self-delimited, idempotent block into the user's GLOBAL
// ~/.claude/CLAUDE.md. Because it's global it applies to every project, and
// because Claude reads CLAUDE.md every session it pulls logic.md back into
// context each time — which is exactly the "stop re-deciding / avoid
// hallucination" behaviour the user asked for.
const START = "<!-- ccm:logic:start -->";
const END = "<!-- ccm:logic:end -->";

function globalClaudeMd(): string {
  const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  return path.join(dir, "CLAUDE.md");
}

function block(vaultRoot: string): string {
  return `${START}
## Project logic log (managed by Claude Config Manager — do not edit these markers)

Every project has a decision log at: \`${vaultRoot}/<project-folder-name>/logic.md\`
(where \`<project-folder-name>\` is the basename of the project directory).

- **At the start of work in a project, read its logic.md** if it exists, and treat it as authoritative prior context. Do not re-litigate decisions already recorded there.
- **Whenever the user gives a logical instruction — a decision, a rule, a rationale, a constraint, a preference, a correction, or "the logic" of how something should work — append a concise summary of it to that project's logic.md** under a dated \`## YYYY-MM-DD\` heading as a terse bullet (what they instructed + why). Capture the user's intent in their terms, not just the code change. Create the file and its folder if missing.
- Keep entries factual and short. This file is the project's long-term memory of the instructions and decisions behind it.

Alongside logic.md, each project has a credentials inventory at \`${vaultRoot}/<project-folder-name>/credentials.md\`.
- **Whenever the user shares an API key, token, password, or other credential, record it in that project's credentials.md** so they can track and rotate it: add a row with the service, the key/secret name, a MASKED value (keep only a prefix + last 4 chars — never store the full secret), where it lives, the date shared, and a rotation status. If a secret was pasted in plaintext, mark its status "exposed — rotate".
- Never echo full secret values back; never commit or move this file out of the vault.
${END}`;
}

async function readGlobal(): Promise<string> {
  try {
    return await fs.readFile(globalClaudeMd(), "utf8");
  } catch {
    return "";
  }
}

export async function GET() {
  const content = await readGlobal();
  const { contextVaultRoot } = await readAppConfig();
  return NextResponse.json({
    enabled: content.includes(START) && content.includes(END),
    path: globalClaudeMd(),
    vaultRoot: contextVaultRoot,
  });
}

export async function POST() {
  const { contextVaultRoot } = await readAppConfig();
  const file = globalClaudeMd();
  const existing = await readGlobal();
  const fresh = block(contextVaultRoot);

  let next: string;
  if (existing.includes(START) && existing.includes(END)) {
    // Replace the existing managed block (keeps vault path in sync).
    next = existing.replace(new RegExp(`${START}[\\s\\S]*?${END}`), fresh);
  } else {
    next = existing.trim() ? `${existing.trimEnd()}\n\n${fresh}\n` : `${fresh}\n`;
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, next, "utf8");
  return NextResponse.json({ ok: true, enabled: true, path: file });
}

export async function DELETE() {
  const file = globalClaudeMd();
  const existing = await readGlobal();
  if (!existing.includes(START)) return NextResponse.json({ ok: true, enabled: false });
  const next = existing
    .replace(new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n*`), "\n")
    .trimEnd();
  await fs.writeFile(file, next ? `${next}\n` : "", "utf8");
  return NextResponse.json({ ok: true, enabled: false });
}
