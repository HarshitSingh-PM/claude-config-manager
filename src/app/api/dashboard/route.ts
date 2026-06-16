import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { scanAllSessions, claudeDir } from "@/lib/sessionScan";
import { readAppConfig } from "@/lib/appConfig";

export const dynamic = "force-dynamic";

const SMALL_SESSION_MSGS = 10; // sessions below this are "throwaway" cleanup candidates
const LOGIC_BLOCK_MARKER = "ccm:logic:start";

async function readJson(p: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

function credentialsLocked(deny: unknown): boolean {
  if (!Array.isArray(deny)) return false;
  const re = /(\.env|\.ssh|\.aws|\.npmrc|\.git-credentials|credentials|secrets|keychain)/i;
  return deny.some((d) => typeof d === "string" && /^Read\(/i.test(d) && re.test(d));
}

export async function GET() {
  const home = os.homedir();
  const dir = claudeDir();

  const settingsPath = path.join(dir, "settings.json");
  const claudeMdPath = path.join(dir, "CLAUDE.md");

  const [scanned, settings, appConfig, claudeMd] = await Promise.all([
    scanAllSessions(),
    readJson(settingsPath),
    readAppConfig(),
    fs.readFile(claudeMdPath, "utf8").catch(() => ""),
  ]);

  // ─── Session KPIs ───────────────────────────────────────────────
  const totalBytes = scanned.reduce((n, s) => n + (s.sizeBytes || 0), 0);
  const small = scanned.filter((s) => s.messages < SMALL_SESSION_MSGS).length;
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const activeThisWeek = scanned.filter((s) => (s.modified ?? 0) >= weekAgo).length;
  const lastActive = scanned.reduce((m, s) => Math.max(m, s.modified ?? 0), 0) || null;

  // ─── Config health ──────────────────────────────────────────────
  const perms = (settings?.permissions ?? {}) as Record<string, unknown>;
  const sandbox = (settings?.sandbox ?? {}) as Record<string, unknown>;
  const config = {
    settingsExists: settings !== null,
    model: (settings?.model as string) || null,
    permissionMode: (perms.defaultMode as string) || null,
    bypassesPermissions: perms.defaultMode === "bypassPermissions",
    sandboxEnabled: sandbox.enabled === true,
    credentialsLocked: credentialsLocked(perms.deny),
    // autoMemory defaults to on in Claude Code; only false if explicitly disabled.
    autoMemory: settings?.autoMemoryEnabled !== false,
    denyCount: Array.isArray(perms.deny) ? perms.deny.length : 0,
    allowCount: Array.isArray(perms.allow) ? perms.allow.length : 0,
    hasGlobalClaudeMd: claudeMd.trim().length > 0,
  };

  return NextResponse.json({
    home,
    sessions: {
      count: scanned.length,
      totalBytes,
      smallCount: small,
      activeThisWeek,
      lastActive,
    },
    config,
    vault: {
      root: appConfig.contextVaultRoot,
      logicAutoMaintain: claudeMd.includes(LOGIC_BLOCK_MARKER),
    },
  });
}
