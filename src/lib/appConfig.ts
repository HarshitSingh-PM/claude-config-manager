import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// App-owned config (NOT Claude's config). Stored separately so we never
// pollute ~/.claude. Currently holds where the app writes the context files
// it generates (logic.md), i.e. the "central vault".
export type AppConfig = {
  contextVaultRoot: string;
};

function configPath(): string {
  return path.join(os.homedir(), ".claude-config-ui", "config.json");
}

export function defaultVaultRoot(): string {
  return path.join(os.homedir(), "ClaudeContext");
}

export async function readAppConfig(): Promise<AppConfig> {
  const fallback: AppConfig = { contextVaultRoot: defaultVaultRoot() };
  try {
    const raw = await fs.readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      contextVaultRoot:
        typeof parsed.contextVaultRoot === "string" && parsed.contextVaultRoot.trim()
          ? parsed.contextVaultRoot
          : fallback.contextVaultRoot,
    };
  } catch {
    return fallback;
  }
}

export async function writeAppConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await readAppConfig();
  const next: AppConfig = { ...current, ...patch };
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

// Folder name for a project inside the vault — the readable basename, matching
// the user's mental model (~/ClaudeContext/rintel-scraper/logic.md).
export function vaultFolderName(projectPath: string): string {
  return path.basename(projectPath);
}

export function vaultPathFor(vaultRoot: string, projectPath: string, filename: string): string {
  return path.join(vaultRoot, vaultFolderName(projectPath), filename);
}

export function logicPathFor(vaultRoot: string, projectPath: string): string {
  return vaultPathFor(vaultRoot, projectPath, "logic.md");
}
