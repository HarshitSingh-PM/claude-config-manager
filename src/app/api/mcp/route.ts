import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";

// ─── Where Claude Code stores MCP servers ────────────────────────
// User scope  → ~/.claude.json  →  mcpServers
// Local scope → ~/.claude.json  →  projects["<dir>"].mcpServers
// Project     → <dir>/.mcp.json →  mcpServers
const userClaudeJson = () => path.join(os.homedir(), ".claude.json");
// App-owned store for reversibly "disabled" servers (Claude Code has no native
// per-server disable flag, so we stash the config here and restore on enable).
const disabledStorePath = () => path.join(os.homedir(), ".claude-config-ui", "disabled-mcp.json");

type ServerConfig = Record<string, unknown>;
type Scope = "user" | "local" | "project";

async function readJson(p: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

// Write JSON preserving everything else in the file; keep a rolling backup.
async function writeJsonBackup(p: string, obj: unknown) {
  try {
    await fs.copyFile(p, `${p}.ccm-bak`);
  } catch {
    /* no existing file to back up */
  }
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

async function readDisabled(): Promise<Record<string, ServerConfig>> {
  return ((await readJson(disabledStorePath())) as Record<string, ServerConfig>) ?? {};
}
async function writeDisabled(obj: Record<string, ServerConfig>) {
  await fs.mkdir(path.dirname(disabledStorePath()), { recursive: true });
  await fs.writeFile(disabledStorePath(), `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

function disabledKey(scope: Scope, name: string, projectDir: string): string {
  return scope === "user" ? `user:${name}` : `${scope}:${projectDir}:${name}`;
}

function transportOf(cfg: ServerConfig): "stdio" | "http" | "sse" | "ws" {
  const t = String(cfg.type ?? "");
  if (t === "streamable-http") return "http";
  if (t === "http" || t === "sse" || t === "ws") return t;
  return cfg.url ? "http" : "stdio";
}

function analyze(cfg: ServerConfig) {
  const transport = transportOf(cfg);
  const url = cfg.url as string | undefined;
  const command = cfg.command as string | undefined;
  const headers = (cfg.headers as Record<string, string>) ?? {};
  const headerKeys = Object.keys(headers);
  const env = (cfg.env as Record<string, string>) ?? {};
  const envKeys = Object.keys(env);
  const hasAuthHeader = headerKeys.some((k) => /^authorization$|api[-_]?key|token|secret/i.test(k));
  const headersHelper = Boolean(cfg.headersHelper);

  const issues: string[] = [];
  if (transport === "stdio" && !command) issues.push("stdio server has no `command`.");
  if (transport !== "stdio" && !url) issues.push(`${transport} server has no \`url\`.`);
  if (transport !== "stdio" && url && !/^https?:|^wss?:/.test(url))
    issues.push("`url` should start with http(s):// or ws(s)://.");

  let auth: "none" | "env-var" | "header-token" | "dynamic-headers" | "oauth";
  if (transport === "stdio")
    auth = envKeys.some((k) => /TOKEN|KEY|SECRET|PASS|CRED/i.test(k)) ? "env-var" : "none";
  else if (hasAuthHeader) auth = "header-token";
  else if (headersHelper) auth = "dynamic-headers";
  else auth = "oauth"; // remote server with no static auth → almost certainly OAuth via /mcp

  return {
    transport,
    target: command ?? url ?? "",
    alwaysLoad: cfg.alwaysLoad === true,
    envKeys,
    headerKeys,
    headersHelper,
    auth,
    issues,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectDir = url.searchParams.get("projectDir") || "";

  const cj = (await readJson(userClaudeJson())) ?? {};
  const userServers = (cj.mcpServers as Record<string, ServerConfig>) ?? {};
  const projects = (cj.projects as Record<string, { mcpServers?: Record<string, ServerConfig> }>) ?? {};
  const localServers = (projectDir && projects[projectDir]?.mcpServers) || {};

  let projectServers: Record<string, ServerConfig> = {};
  let projectMcpExists = false;
  if (projectDir) {
    const pj = await readJson(path.join(projectDir, ".mcp.json"));
    if (pj && pj.mcpServers) {
      projectServers = pj.mcpServers as Record<string, ServerConfig>;
      projectMcpExists = true;
    }
  }

  const disabled = await readDisabled();
  const servers: unknown[] = [];
  const add = (name: string, scope: Scope, cfg: ServerConfig, enabled: boolean) =>
    servers.push({ name, scope, enabled, config: cfg, ...analyze(cfg) });

  for (const [n, c] of Object.entries(userServers)) add(n, "user", c, true);
  for (const [n, c] of Object.entries(localServers)) add(n, "local", c, true);
  for (const [n, c] of Object.entries(projectServers)) add(n, "project", c, true);
  for (const [key, c] of Object.entries(disabled)) {
    if (key.startsWith("user:")) add(key.slice(5), "user", c, false);
    else if (projectDir && key.startsWith(`project:${projectDir}:`))
      add(key.slice(`project:${projectDir}:`.length), "project", c, false);
    else if (projectDir && key.startsWith(`local:${projectDir}:`))
      add(key.slice(`local:${projectDir}:`.length), "local", c, false);
  }

  // Flag duplicate names (a configured server shadows a claude.ai connector or
  // another scope — common source of confusion).
  const counts = new Map<string, number>();
  for (const s of servers as { name: string }[]) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
  for (const s of servers as { name: string; duplicate?: boolean }[])
    if ((counts.get(s.name) ?? 0) > 1) s.duplicate = true;

  return NextResponse.json({ projectDir, projectMcpExists, servers });
}

// Read/modify/write the mcpServers map for a given scope.
async function mutateScope(
  scope: Scope,
  projectDir: string,
  fn: (servers: Record<string, ServerConfig>) => void,
) {
  if (scope === "project") {
    const p = path.join(projectDir, ".mcp.json");
    const pj = (await readJson(p)) ?? {};
    pj.mcpServers = (pj.mcpServers as Record<string, ServerConfig>) ?? {};
    fn(pj.mcpServers as Record<string, ServerConfig>);
    await writeJsonBackup(p, pj);
    return;
  }
  const cj = (await readJson(userClaudeJson())) ?? {};
  if (scope === "user") {
    cj.mcpServers = (cj.mcpServers as Record<string, ServerConfig>) ?? {};
    fn(cj.mcpServers as Record<string, ServerConfig>);
  } else {
    cj.projects = (cj.projects as Record<string, unknown>) ?? {};
    const projects = cj.projects as Record<string, { mcpServers?: Record<string, ServerConfig> }>;
    projects[projectDir] = projects[projectDir] ?? {};
    projects[projectDir].mcpServers = projects[projectDir].mcpServers ?? {};
    fn(projects[projectDir].mcpServers as Record<string, ServerConfig>);
  }
  await writeJsonBackup(userClaudeJson(), cj);
}

async function getServerConfig(
  scope: Scope,
  projectDir: string,
  name: string,
): Promise<ServerConfig | null> {
  let found: ServerConfig | null = null;
  await mutateScope(scope, projectDir, (servers) => {
    found = servers[name] ?? null;
  });
  return found;
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action: "add" | "update" | "remove" | "disable" | "enable" | "setAlwaysLoad";
    scope: Scope;
    name: string;
    projectDir?: string;
    config?: ServerConfig;
    value?: boolean;
  };
  const { action, scope, name } = body;
  const projectDir = body.projectDir ?? "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if ((scope === "project" || scope === "local") && !projectDir)
    return NextResponse.json({ error: "projectDir required for this scope" }, { status: 400 });

  try {
    switch (action) {
      case "add":
      case "update": {
        if (!body.config || typeof body.config !== "object")
          return NextResponse.json({ error: "config object required" }, { status: 400 });
        await mutateScope(scope, projectDir, (servers) => {
          servers[name] = body.config as ServerConfig;
        });
        break;
      }
      case "remove": {
        await mutateScope(scope, projectDir, (servers) => {
          delete servers[name];
        });
        const disabled = await readDisabled();
        delete disabled[disabledKey(scope, name, projectDir)];
        await writeDisabled(disabled);
        break;
      }
      case "disable": {
        const cfg = await getServerConfig(scope, projectDir, name);
        if (!cfg) return NextResponse.json({ error: "server not found" }, { status: 404 });
        const disabled = await readDisabled();
        disabled[disabledKey(scope, name, projectDir)] = cfg;
        await writeDisabled(disabled);
        await mutateScope(scope, projectDir, (servers) => {
          delete servers[name];
        });
        break;
      }
      case "enable": {
        const disabled = await readDisabled();
        const key = disabledKey(scope, name, projectDir);
        const cfg = disabled[key];
        if (!cfg) return NextResponse.json({ error: "no disabled config found" }, { status: 404 });
        await mutateScope(scope, projectDir, (servers) => {
          servers[name] = cfg;
        });
        delete disabled[key];
        await writeDisabled(disabled);
        break;
      }
      case "setAlwaysLoad": {
        await mutateScope(scope, projectDir, (servers) => {
          if (!servers[name]) return;
          if (body.value) (servers[name] as ServerConfig).alwaysLoad = true;
          else delete (servers[name] as ServerConfig).alwaysLoad;
        });
        break;
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
