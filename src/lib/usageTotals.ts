// All-time token totals, computed by scanning every session transcript under
// ~/.claude/projects/**/*.jsonl and summing the per-message `usage` fields.
// Transcripts are append-only, so we keep a per-file cache (size+mtime keyed)
// in ~/.claude-config-ui/usage-alltime-cache.json — the first scan pays the
// full cost, every later call only re-reads files that changed.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

export interface AllTimeTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number; // all four summed — same convention as ccusage
  messages: number;
  files: number;
  firstActivity: number | null; // unix ms of the oldest transcript
  scannedAt: number;
}

interface FileTotals {
  size: number;
  mtimeMs: number;
  in: number;
  out: number;
  cc: number;
  cr: number;
  n: number; // assistant messages counted
  born: number; // file birth/mtime floor for firstActivity
}

const CACHE_PATH = path.join(os.homedir(), ".claude-config-ui", "usage-alltime-cache.json");

function claudeProjectsDir(): string {
  return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "projects");
}

function loadCache(): Record<string, FileTotals> {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    return c && typeof c === "object" ? c : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, FileTotals>) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
  } catch {
    /* best effort */
  }
}

async function scanFile(p: string, st: { size: number; mtimeMs: number; birthtimeMs: number }): Promise<FileTotals> {
  const t: FileTotals = {
    size: st.size,
    mtimeMs: st.mtimeMs,
    in: 0,
    out: 0,
    cc: 0,
    cr: 0,
    n: 0,
    born: Math.round(st.birthtimeMs || st.mtimeMs),
  };
  // Streamed transcripts can repeat a message id as content grows — count each
  // request once, keyed by requestId (falling back to the message id).
  const seen = new Set<string>();
  const rl = readline.createInterface({
    input: fs.createReadStream(p, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  try {
    for await (const line of rl) {
      if (!line.includes('"usage"')) continue;
      let obj: {
        requestId?: string;
        message?: { id?: string; usage?: Record<string, number> };
      };
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      const usage = obj?.message?.usage;
      if (!usage) continue;
      const key = obj.requestId || obj.message?.id || "";
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      t.in += usage.input_tokens || 0;
      t.out += usage.output_tokens || 0;
      t.cc += usage.cache_creation_input_tokens || 0;
      t.cr += usage.cache_read_input_tokens || 0;
      t.n++;
    }
  } finally {
    rl.close();
  }
  return t;
}

async function computeAllTime(): Promise<AllTimeTotals> {
  const cache = loadCache();
  const fresh: Record<string, FileTotals> = {};
  let dirty = false;

  const root = claudeProjectsDir();
  let projectDirs: string[] = [];
  try {
    projectDirs = (await fsp.readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => path.join(root, e.name));
  } catch {
    /* no transcripts at all */
  }

  for (const dir of projectDirs) {
    let entries: string[] = [];
    try {
      entries = await fsp.readdir(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith(".jsonl")) continue;
      const p = path.join(dir, name);
      let st: fs.Stats;
      try {
        st = await fsp.stat(p);
      } catch {
        continue;
      }
      const cached = cache[p];
      if (cached && cached.size === st.size && cached.mtimeMs === st.mtimeMs) {
        fresh[p] = cached;
        continue;
      }
      try {
        fresh[p] = await scanFile(p, st);
        dirty = true;
      } catch {
        /* unreadable file — skip */
      }
    }
  }
  // dropped files also dirty the cache
  if (Object.keys(fresh).length !== Object.keys(cache).length) dirty = true;
  if (dirty) saveCache(fresh);

  const out: AllTimeTotals = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    messages: 0,
    files: 0,
    firstActivity: null,
    scannedAt: Date.now(),
  };
  for (const t of Object.values(fresh)) {
    out.inputTokens += t.in;
    out.outputTokens += t.out;
    out.cacheCreationTokens += t.cc;
    out.cacheReadTokens += t.cr;
    out.messages += t.n;
    out.files++;
    if (t.born && (!out.firstActivity || t.born < out.firstActivity)) out.firstActivity = t.born;
  }
  out.totalTokens = out.inputTokens + out.outputTokens + out.cacheCreationTokens + out.cacheReadTokens;
  return out;
}

// Serve a memoized result and refresh at most once a minute; concurrent calls
// share one in-flight scan. Pinned to globalThis so HMR doesn't re-scan.
const g = globalThis as unknown as {
  __ccmUsageTotals?: { at: number; value: AllTimeTotals } | null;
  __ccmUsageTotalsInflight?: Promise<AllTimeTotals> | null;
};

export async function getAllTimeTotals(): Promise<AllTimeTotals> {
  const now = Date.now();
  if (g.__ccmUsageTotals && now - g.__ccmUsageTotals.at < 60_000) return g.__ccmUsageTotals.value;
  if (g.__ccmUsageTotalsInflight) return g.__ccmUsageTotalsInflight;
  g.__ccmUsageTotalsInflight = computeAllTime()
    .then((value) => {
      g.__ccmUsageTotals = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      g.__ccmUsageTotalsInflight = null;
    });
  return g.__ccmUsageTotalsInflight;
}
