import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import zlib from "node:zlib";

/**
 * Encrypted transfer bundles (.ccsync)
 *
 * Layout: magic(8) | salt(16) | iv(12) | gcmTag(16) | ciphertext
 * Key:    scrypt(passphrase, salt, 32) with N=2^15, r=8, p=1
 * Cipher: AES-256-GCM, AAD = magic
 * Plain:  gzip(JSON manifest)
 *
 * All file paths inside a bundle are home-relative ("~/...") with "/"
 * separators, so a bundle restores cleanly on a machine with a different
 * username. Restores refuse anything that would land outside the home dir.
 */

const MAGIC = Buffer.from("CCSYNC1\n", "utf8"); // 8 bytes
const SCRYPT_OPTS = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const PER_FILE_CAP = 10 * 1024 * 1024; // skip single files above 10 MB
const TOTAL_CAP = 200 * 1024 * 1024; // refuse bundles above 200 MB raw
const IGNORE_NAMES = new Set(["node_modules", ".git", ".DS_Store", "__pycache__", ".venv"]);

export interface BundleFile {
  /** home-relative, always "~/a/b" form with forward slashes */
  path: string;
  mode?: number;
  /** base64 */
  content: string;
}

export interface BundleManifest {
  version: 1;
  createdAt: string;
  hostname: string;
  files: BundleFile[];
}

export interface CollectedFile {
  rel: string;
  abs: string;
  size: number;
}

export interface CategoryPreview {
  key: string;
  label: string;
  hint: string;
  fileCount: number;
  totalBytes: number;
}

export interface CollectResult {
  files: CollectedFile[];
  skipped: { path: string; reason: string }[];
  totalBytes: number;
}

export type IncludeFlags = Record<string, boolean>;

interface Category {
  key: string;
  label: string;
  hint: string;
  roots: () => string[];
}

const home = () => os.homedir();

export const CATEGORIES: Category[] = [
  {
    key: "claudeJson",
    label: "Claude Code core config (~/.claude.json)",
    hint: "MCP servers with their API keys, trusted projects, global state",
    roots: () => [path.join(home(), ".claude.json")],
  },
  {
    key: "settings",
    label: "Settings",
    hint: "~/.claude/settings.json and settings.local.json (permissions, hooks, env)",
    roots: () => [path.join(home(), ".claude", "settings.json"), path.join(home(), ".claude", "settings.local.json")],
  },
  {
    key: "claudeMd",
    label: "Global CLAUDE.md",
    hint: "Your private instructions applied to every project",
    roots: () => [path.join(home(), ".claude", "CLAUDE.md")],
  },
  {
    key: "agents",
    label: "Agents",
    hint: "~/.claude/agents — custom subagent definitions",
    roots: () => [path.join(home(), ".claude", "agents")],
  },
  {
    key: "skills",
    label: "Skills",
    hint: "~/.claude/skills — skill folders incl. scripts",
    roots: () => [path.join(home(), ".claude", "skills")],
  },
  {
    key: "commands",
    label: "Commands",
    hint: "~/.claude/commands — slash commands",
    roots: () => [path.join(home(), ".claude", "commands")],
  },
  {
    key: "keybindings",
    label: "Keybindings",
    hint: "~/.claude/keybindings.json",
    roots: () => [path.join(home(), ".claude", "keybindings.json")],
  },
  {
    key: "memory",
    label: "Auto-memory",
    hint: "~/.claude/projects/*/memory — Claude's persistent memory per project",
    roots: () => {
      const base = path.join(home(), ".claude", "projects");
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(base, { withFileTypes: true });
      } catch {
        return [];
      }
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => path.join(base, e.name, "memory"))
        .filter((p) => fs.existsSync(p));
    },
  },
  {
    key: "appData",
    label: "Claude Config UI data",
    hint: "~/.claude-config-ui — orchestrator history and campaigns",
    roots: () => [path.join(home(), ".claude-config-ui")],
  },
];

function toRel(abs: string): string | null {
  const rel = path.relative(home(), abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return "~/" + rel.split(path.sep).join("/");
}

/** Resolve a bundle path back to an absolute path, refusing escapes from home. */
export function fromRel(rel: string): string | null {
  if (!rel.startsWith("~/")) return null;
  const parts = rel.slice(2).split("/");
  if (parts.some((p) => p === ".." || p === "" || p.includes("\\"))) return null;
  return path.join(home(), ...parts);
}

function walk(abs: string, out: CollectedFile[], skipped: { path: string; reason: string }[]) {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    return; // missing roots are fine — machine simply doesn't have that piece
  }
  if (stat.isDirectory()) {
    if (IGNORE_NAMES.has(path.basename(abs))) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      skipped.push({ path: abs, reason: "unreadable directory" });
      return;
    }
    for (const e of entries) {
      if (IGNORE_NAMES.has(e.name)) continue;
      if (e.isSymbolicLink()) continue;
      walk(path.join(abs, e.name), out, skipped);
    }
    return;
  }
  if (!stat.isFile()) return;
  if (stat.size > PER_FILE_CAP) {
    skipped.push({ path: abs, reason: `larger than ${PER_FILE_CAP / 1024 / 1024} MB` });
    return;
  }
  const rel = toRel(abs);
  if (!rel) {
    skipped.push({ path: abs, reason: "outside home directory" });
    return;
  }
  out.push({ rel, abs, size: stat.size });
}

export function collectFiles(include: IncludeFlags, extraPaths: string[]): CollectResult {
  const files: CollectedFile[] = [];
  const skipped: { path: string; reason: string }[] = [];
  for (const cat of CATEGORIES) {
    if (!include[cat.key]) continue;
    for (const root of cat.roots()) walk(root, files, skipped);
  }
  for (const raw of extraPaths) {
    let p = raw.trim();
    if (!p) continue;
    if (p.startsWith("~/")) p = path.join(home(), p.slice(2));
    if (!path.isAbsolute(p)) {
      skipped.push({ path: raw, reason: "not an absolute or ~/ path" });
      continue;
    }
    if (!toRel(p) && p !== home()) {
      skipped.push({ path: raw, reason: "outside home directory" });
      continue;
    }
    walk(p, files, skipped);
  }
  // dedupe (a category root and an extra path can overlap)
  const seen = new Set<string>();
  const deduped = files.filter((f) => (seen.has(f.rel) ? false : (seen.add(f.rel), true)));
  const totalBytes = deduped.reduce((a, f) => a + f.size, 0);
  return { files: deduped, skipped, totalBytes };
}

export function previewCategories(extraPaths: string[]): { categories: CategoryPreview[]; extras: CollectResult } {
  const categories = CATEGORIES.map((cat) => {
    const out: CollectedFile[] = [];
    const skipped: { path: string; reason: string }[] = [];
    for (const root of cat.roots()) walk(root, out, skipped);
    return {
      key: cat.key,
      label: cat.label,
      hint: cat.hint,
      fileCount: out.length,
      totalBytes: out.reduce((a, f) => a + f.size, 0),
    };
  });
  const extras = collectFiles({}, extraPaths);
  return { categories, extras };
}

export function buildBundle(collected: CollectResult, passphrase: string): Buffer {
  if (collected.totalBytes > TOTAL_CAP) {
    throw new Error(`bundle would be ${Math.round(collected.totalBytes / 1024 / 1024)} MB raw; cap is 200 MB`);
  }
  const manifest: BundleManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    hostname: os.hostname(),
    files: collected.files.map((f) => {
      const buf = fs.readFileSync(f.abs);
      const mode = fs.statSync(f.abs).mode & 0o777;
      return { path: f.rel, mode, content: buf.toString("base64") };
    }),
  };
  const plain = zlib.gzipSync(Buffer.from(JSON.stringify(manifest), "utf8"));
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32, SCRYPT_OPTS);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(MAGIC);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, salt, iv, tag, ct]);
}

export function decryptBundle(buf: Buffer, passphrase: string): BundleManifest {
  if (buf.length < 8 + 16 + 12 + 16 + 1 || !buf.subarray(0, 8).equals(MAGIC)) {
    throw new Error("not a .ccsync bundle");
  }
  const salt = buf.subarray(8, 24);
  const iv = buf.subarray(24, 36);
  const tag = buf.subarray(36, 52);
  const ct = buf.subarray(52);
  const key = crypto.scryptSync(passphrase, salt, 32, SCRYPT_OPTS);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  let plain: Buffer;
  try {
    plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch {
    throw new Error("wrong passphrase or corrupted bundle");
  }
  const manifest = JSON.parse(zlib.gunzipSync(plain).toString("utf8")) as BundleManifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) {
    throw new Error("unsupported bundle version");
  }
  return manifest;
}

export type FileState = "new" | "changed" | "same";

export function inspectAgainstDisk(manifest: BundleManifest): {
  files: { path: string; size: number; state: FileState }[];
} {
  return {
    files: manifest.files.map((f) => {
      const content = Buffer.from(f.content, "base64");
      const abs = fromRel(f.path);
      let state: FileState = "new";
      if (abs && fs.existsSync(abs)) {
        try {
          state = fs.readFileSync(abs).equals(content) ? "same" : "changed";
        } catch {
          state = "changed";
        }
      }
      return { path: f.path, size: content.length, state };
    }),
  };
}

export function applyBundle(
  manifest: BundleManifest,
  selectPaths: string[],
): { restored: string[]; backedUp: string[]; backupDir: string | null; errors: { path: string; error: string }[] } {
  const wanted = new Set(selectPaths);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(home(), ".claude-config-ui", "transfer-backups", ts);
  let backupUsed = false;
  const restored: string[] = [];
  const backedUp: string[] = [];
  const errors: { path: string; error: string }[] = [];
  for (const f of manifest.files) {
    if (!wanted.has(f.path)) continue;
    const abs = fromRel(f.path);
    if (!abs) {
      errors.push({ path: f.path, error: "refused: path escapes home directory" });
      continue;
    }
    try {
      const content = Buffer.from(f.content, "base64");
      if (fs.existsSync(abs) && !fs.readFileSync(abs).equals(content)) {
        const dest = path.join(backupRoot, f.path.slice(2));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(abs, dest);
        backedUp.push(f.path);
        backupUsed = true;
      }
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      if (typeof f.mode === "number") fs.chmodSync(abs, f.mode);
      restored.push(f.path);
    } catch (err) {
      errors.push({ path: f.path, error: String(err) });
    }
  }
  return { restored, backedUp, backupDir: backupUsed ? backupRoot : null, errors };
}
