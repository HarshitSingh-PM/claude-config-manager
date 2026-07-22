import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Reads the Claude app's local usage cache to surface remaining quota for the
// rolling 5-hour window, the weekly window, and the per-model (Fable 5 / Opus /
// Sonnet) weekly windows — plus when each resets.
//
// Sources (both written by the Claude desktop app, account-wide):
//   • ~/Library/Application Support/Claude Usage/history/usageHistory_*.json
//       snapshots tagged sessionReset | weeklyReset, with per-model weekly %,
//       token counts, and triggeringResetTime. This is the rich source.
//   • ~/Library/Application Support/Claude/plan-usage-history.json
//       frequent (~5 min) samples of { fh: 5h %, sd: weekly % } — used to
//       freshen the headline 5h / weekly numbers when it's newer.
//
// Everything degrades gracefully: if a file is absent (e.g. the desktop app
// isn't installed), we return { available: false } and the UI hides the widget.

const COCOA_EPOCH_OFFSET = 978_307_200; // seconds between 2001-01-01 and 1970-01-01
const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Meter = {
  usedPct: number;
  remainingPct: number;
  tokensUsed: number | null;
  tokensRemaining: number | null;
  resetAt: number | null; // unix ms
};

function cocoaToUnixMs(t: number): number {
  return Math.round((t + COCOA_EPOCH_OFFSET) * 1000);
}

// Advance a reset time past `now` by whole windows, so a slightly stale cache
// still yields a sensible future countdown.
function nextReset(resetAt: number | null, windowMs: number, now: number): number | null {
  if (!resetAt) return null;
  let r = resetAt;
  while (r <= now) r += windowMs;
  return r;
}

function clampPct(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

// used + pct → implied cap → remaining tokens. Only meaningful when we have a
// non-zero token count AND a non-zero percentage (some windows, e.g. the 5-hour
// one, report a % but no token count — deriving a cap from 0 used is nonsense).
function remainingTokens(used: number | null, usedPct: number): number | null {
  if (!used || usedPct <= 0) return null;
  const cap = used / (usedPct / 100);
  return Math.max(0, Math.round(cap - used));
}

async function newestUsageHistory(): Promise<string | null> {
  const dir = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Claude Usage",
    "history",
  );
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return null;
  }
  const files = names.filter((n) => n.startsWith("usageHistory_") && n.endsWith(".json"));
  if (!files.length) return null;
  let best: { p: string; mtime: number } | null = null;
  for (const n of files) {
    const p = path.join(dir, n);
    try {
      const st = await fs.stat(p);
      if (!best || st.mtimeMs > best.mtime) best = { p, mtime: st.mtimeMs };
    } catch {
      /* skip */
    }
  }
  return best?.p ?? null;
}

export async function GET() {
  const now = Date.now();

  // ── Rich source: usage history snapshots ──────────────────────
  let session: Record<string, number> | null = null;
  let weekly: Record<string, number> | null = null;
  let snapshotAt: number | null = null;

  const histPath = await newestUsageHistory();
  if (histPath) {
    try {
      const raw = await fs.readFile(histPath, "utf8");
      const snaps = (JSON.parse(raw)?.snapshots ?? []) as Record<string, number | string>[];
      for (const s of snaps) {
        if (s.resetType === "sessionReset") session = s as Record<string, number>;
        else if (s.resetType === "weeklyReset") weekly = s as Record<string, number>;
        if (typeof s.timestamp === "number") {
          const ts = cocoaToUnixMs(s.timestamp);
          if (!snapshotAt || ts > snapshotAt) snapshotAt = ts;
        }
      }
    } catch {
      /* fall through to plan-usage */
    }
  }

  // ── Fresh headline %: plan-usage-history (fh = 5h, sd = weekly) ─
  let fhPct: number | null = null;
  let sdPct: number | null = null;
  let planAt: number | null = null;
  try {
    const p = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Claude",
      "plan-usage-history.json",
    );
    const raw = await fs.readFile(p, "utf8");
    const samples = (JSON.parse(raw)?.samples ?? []) as { t: number; u: { fh: number; sd: number } }[];
    const last = samples[samples.length - 1];
    if (last) {
      fhPct = clampPct(last.u?.fh);
      sdPct = clampPct(last.u?.sd);
      planAt = last.t;
    }
  } catch {
    /* optional */
  }

  if (!session && !weekly && fhPct == null) {
    return NextResponse.json({ available: false });
  }

  // Prefer the freshest reading for the headline 5h / weekly %.
  const planNewer = planAt != null && (snapshotAt == null || planAt >= snapshotAt);

  const fiveUsed = clampPct(planNewer && fhPct != null ? fhPct : session?.sessionPercentage);
  const weekUsed = clampPct(planNewer && sdPct != null ? sdPct : weekly?.weeklyPercentage);

  const build = (
    usedPct: number,
    tokensUsed: number | null,
    resetRaw: number | null,
    windowMs: number,
  ): Meter => ({
    usedPct,
    remainingPct: 100 - usedPct,
    tokensUsed,
    tokensRemaining: remainingTokens(tokensUsed, usedPct),
    resetAt: nextReset(resetRaw, windowMs, now),
  });

  const sessionResetRaw = session?.triggeringResetTime
    ? cocoaToUnixMs(session.triggeringResetTime)
    : null;
  const weeklyResetRaw = weekly?.triggeringResetTime
    ? cocoaToUnixMs(weekly.triggeringResetTime)
    : null;

  const fableUsed = clampPct(weekly?.fableWeeklyPercentage);
  const opusUsed = clampPct(weekly?.opusWeeklyPercentage);
  const sonnetUsed = clampPct(weekly?.sonnetWeeklyPercentage);

  return NextResponse.json({
    available: true,
    updatedAt: Math.max(snapshotAt ?? 0, planAt ?? 0) || now,
    fiveHour: build(fiveUsed, session?.sessionTokensUsed ?? null, sessionResetRaw, FIVE_HOUR_MS),
    weekly: build(weekUsed, weekly?.weeklyTokensUsed ?? null, weeklyResetRaw, WEEK_MS),
    fableWeekly: build(fableUsed, weekly?.fableWeeklyTokensUsed ?? null, weeklyResetRaw, WEEK_MS),
    opusWeekly: build(opusUsed, weekly?.opusWeeklyTokensUsed ?? null, weeklyResetRaw, WEEK_MS),
    sonnetWeekly: build(sonnetUsed, weekly?.sonnetWeeklyTokensUsed ?? null, weeklyResetRaw, WEEK_MS),
  });
}
