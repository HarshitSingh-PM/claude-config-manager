"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ServerCog,
  Plus,
  Trash2,
  Pencil,
  Power,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  KeyRound,
  Globe,
  TerminalSquare,
  Copy,
  Check,
  Zap,
  Info,
} from "lucide-react";
import { Card, Select, Textarea, Toggle } from "./primitives";

type Scope = "user" | "local" | "project";
type Transport = "stdio" | "http" | "sse" | "ws";
type Auth = "none" | "env-var" | "header-token" | "dynamic-headers" | "oauth";

type McpServer = {
  name: string;
  scope: Scope;
  enabled: boolean;
  config: Record<string, unknown>;
  transport: Transport;
  target: string;
  alwaysLoad: boolean;
  envKeys: string[];
  headerKeys: string[];
  headersHelper: boolean;
  auth: Auth;
  issues: string[];
  duplicate?: boolean;
};

const TEMPLATES: Record<Transport, Record<string, unknown>> = {
  stdio: { command: "npx", args: ["-y", "your-mcp-server"], env: {} },
  http: { type: "http", url: "https://mcp.example.com/mcp", headers: {} },
  sse: { type: "sse", url: "https://mcp.example.com/sse", headers: {} },
  ws: { type: "ws", url: "wss://mcp.example.com/socket", headers: {} },
};

const AUTH_LABEL: Record<Auth, string> = {
  none: "no auth",
  "env-var": "env-var auth",
  "header-token": "header token",
  "dynamic-headers": "dynamic headers",
  oauth: "OAuth",
};

const AUTH_GUIDANCE: Record<Auth, string> = {
  none: "No authentication detected.",
  "env-var": "Authenticates with environment variables passed to the process. Set the token via the env map (or shell).",
  "header-token":
    "Uses a static auth header. If the server rejects it, Claude reports the connection FAILED (no OAuth fallback) — verify the token, or remove the header to fall back to OAuth.",
  "dynamic-headers":
    "Generates headers at connect time via headersHelper (runs a shell command — only after you accept workspace trust at project/local scope).",
  oauth:
    "Remote server with no static auth — authenticate by running /mcp in Claude Code and completing the OAuth login. Auth errors are not auto-retried.",
};

const scopeBadge: Record<Scope, { label: string; cls: string }> = {
  user: { label: "user", cls: "border-[color:var(--accent)]/40 text-[color:var(--accent)]" },
  project: { label: "project", cls: "border-[color:var(--success)]/40 text-[color:var(--success)]" },
  local: { label: "local", cls: "border-[color:var(--fg-faint)]/40 text-[color:var(--fg-muted)]" },
};

function mask(v: string): string {
  if (!v) return "";
  if (v.length <= 6) return "••••";
  return `${v.slice(0, 3)}…${v.slice(-3)}`;
}

export function McpShell({ projectDir }: { projectDir: string }) {
  const [servers, setServers] = useState<McpServer[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setServers(null);
    fetch(`/api/mcp?projectDir=${encodeURIComponent(projectDir)}`)
      .then((r) => r.json())
      .then((d: { servers: McpServer[] }) => !cancelled && setServers(d.servers ?? []))
      .catch(() => !cancelled && setServers([]));
    return () => {
      cancelled = true;
    };
  }, [projectDir, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const act = useCallback(
    async (payload: Record<string, unknown>) => {
      await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, projectDir }),
      });
      refresh();
    },
    [projectDir, refresh],
  );

  const { enabled, disabled } = useMemo(() => {
    const list = servers ?? [];
    return {
      enabled: list.filter((s) => s.enabled),
      disabled: list.filter((s) => !s.enabled),
    };
  }, [servers]);

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <ServerCog size={15} className="text-[color:var(--accent)]" />
            MCP servers
          </h2>
          <p className="text-[11px] text-[color:var(--fg-faint)] mt-1 max-w-2xl leading-relaxed">
            See, enable/disable, add, and remove the Model Context Protocol servers Claude Code
            connects to — across user, project, and local scopes. Project &amp; local scopes apply to{" "}
            <span className="font-mono text-[color:var(--fg-muted)]">{projectDir || "(no project set)"}</span>.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-md bg-[color:var(--accent)] text-black font-medium hover:bg-[color:var(--accent-2)] transition shrink-0"
        >
          <Plus size={13} /> Add server
        </button>
      </div>

      {/* Context-saving explainer */}
      <Card className="px-4 py-3 flex items-start gap-2.5">
        <Info size={14} className="text-[color:var(--accent)] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[color:var(--fg-muted)] leading-relaxed">
          <span className="text-[color:var(--fg)] font-medium">Saving context:</span> by default Claude
          Code defers MCP tools (tool search), so adding servers barely costs context.{" "}
          <span className="font-mono">alwaysLoad</span> forces a server&apos;s tools into context every
          turn — turn it off to save context. <span className="text-[color:var(--fg)] font-medium">Disable</span> a
          server to stop it loading entirely; the app stashes its config so you can re-enable it later.
        </p>
      </Card>

      {adding && (
        <AddEditPanel
          mode="add"
          projectDir={projectDir}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}

      {servers === null ? (
        <Card className="p-10 text-center text-xs text-[color:var(--fg-muted)]">Loading MCP servers…</Card>
      ) : servers.length === 0 ? (
        <Card className="p-10 text-center">
          <ServerCog size={26} className="mx-auto text-[color:var(--fg-faint)] mb-3" />
          <p className="text-sm text-[color:var(--fg-muted)]">No MCP servers configured.</p>
          <p className="text-[11px] text-[color:var(--fg-faint)] mt-1">
            Click <span className="font-medium">Add server</span>, or run{" "}
            <span className="font-mono">claude mcp add</span> in your terminal.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {enabled.map((s) => (
              <ServerCard
                key={`${s.scope}:${s.name}`}
                server={s}
                projectDir={projectDir}
                onAct={act}
                onSaved={refresh}
              />
            ))}
          </div>
          {disabled.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)] mb-2 mt-5">
                Disabled ({disabled.length}) — stashed, not loaded
              </div>
              <div className="space-y-2">
                {disabled.map((s) => (
                  <ServerCard
                    key={`${s.scope}:${s.name}`}
                    server={s}
                    projectDir={projectDir}
                    onAct={act}
                    onSaved={refresh}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ServerCard({
  server,
  projectDir,
  onAct,
  onSaved,
}: {
  server: McpServer;
  projectDir: string;
  onAct: (p: Record<string, unknown>) => Promise<void>;
  onSaved: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const s = server;
  const TIcon = s.transport === "stdio" ? TerminalSquare : Globe;

  const base = { scope: s.scope, name: s.name };

  return (
    <Card className={`px-3.5 py-3 ${!s.enabled ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-0.5 text-[color:var(--fg-faint)] hover:text-[color:var(--fg)] transition shrink-0"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                s.enabled ? "bg-[color:var(--success)]" : "bg-[color:var(--fg-faint)]"
              }`}
            />
            <span className="text-sm font-medium font-mono truncate">{s.name}</span>
            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${scopeBadge[s.scope].cls}`}>
              {scopeBadge[s.scope].label}
            </span>
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-[color:var(--border)] text-[color:var(--fg-muted)] inline-flex items-center gap-1">
              <TIcon size={9} /> {s.transport}
            </span>
            {s.auth !== "none" && (
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-[color:var(--border)] text-[color:var(--fg-muted)] inline-flex items-center gap-1">
                {s.auth === "oauth" ? <ShieldCheck size={9} /> : <KeyRound size={9} />} {AUTH_LABEL[s.auth]}
              </span>
            )}
            {s.alwaysLoad && (
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-[color:var(--warning)]/40 text-[color:var(--warning)] inline-flex items-center gap-1">
                <Zap size={9} /> alwaysLoad
              </span>
            )}
            {s.duplicate && (
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-[color:var(--warning)]/40 text-[color:var(--warning)]">
                duplicate name
              </span>
            )}
          </div>
          <div className="text-[11px] font-mono text-[color:var(--fg-faint)] mt-1 truncate">{s.target}</div>
          {s.issues.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {s.issues.map((iss, i) => (
                <div key={i} className="text-[10.5px] text-[color:var(--warning)] inline-flex items-center gap-1.5">
                  <AlertTriangle size={10} /> {iss}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onAct({ action: s.enabled ? "disable" : "enable", ...base })}
            title={s.enabled ? "Disable (stash & unload)" : "Enable (restore)"}
            className={`h-7 w-7 inline-flex items-center justify-center rounded-md transition ${
              s.enabled
                ? "text-[color:var(--fg-muted)] hover:text-[color:var(--warning)] hover:bg-[color:var(--warning)]/10"
                : "text-[color:var(--success)] hover:bg-[color:var(--success)]/10"
            }`}
          >
            <Power size={14} />
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            title="Edit JSON"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] hover:bg-[color:var(--bg-elev-2)] transition"
          >
            <Pencil size={13} />
          </button>
          {confirmDel ? (
            <span className="inline-flex items-center gap-1">
              <button
                onClick={() => onAct({ action: "remove", ...base })}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--danger)]/15 text-[color:var(--danger)]"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="text-[10px] px-1.5 py-0.5 rounded text-[color:var(--fg-muted)]"
              >
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              title="Remove permanently"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[color:var(--fg-faint)] hover:text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10 transition"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 pt-3 border-t border-[color:var(--border)]">
          <AddEditPanel
            mode="edit"
            projectDir={projectDir}
            initial={s}
            inline
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              onSaved();
            }}
          />
        </div>
      )}

      {expanded && !editing && (
        <div className="mt-3 pt-3 border-t border-[color:var(--border)] space-y-3 pl-[26px]">
          {/* Auth / diagnostics */}
          <div>
            <div className="text-[9px] uppercase tracking-wide text-[color:var(--fg-faint)] mb-1">
              Authentication
            </div>
            <p className="text-[11px] text-[color:var(--fg-muted)] leading-relaxed">{AUTH_GUIDANCE[s.auth]}</p>
          </div>
          {(s.envKeys.length > 0 || s.headerKeys.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {s.envKeys.length > 0 && (
                <KeyList label="env vars" items={s.envKeys} config={s.config} field="env" />
              )}
              {s.headerKeys.length > 0 && (
                <KeyList label="headers" items={s.headerKeys} config={s.config} field="headers" />
              )}
            </div>
          )}
          {/* CLI fixes */}
          <div>
            <div className="text-[9px] uppercase tracking-wide text-[color:var(--fg-faint)] mb-1.5">
              Fix / inspect from the terminal
            </div>
            <div className="space-y-1.5">
              <CliCmd cmd="/mcp" note="authenticate (OAuth) & reconnect" />
              <CliCmd cmd={`claude mcp get ${s.name}`} note="status: connected / pending / failed" />
              {s.scope === "project" && (
                <CliCmd cmd="claude mcp reset-project-choices" note="reset .mcp.json approval prompts" />
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function KeyList({
  label,
  items,
  config,
  field,
}: {
  label: string;
  items: string[];
  config: Record<string, unknown>;
  field: "env" | "headers";
}) {
  const map = (config[field] as Record<string, string>) ?? {};
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-[color:var(--fg-faint)] mb-1">{label}</div>
      <div className="space-y-0.5">
        {items.map((k) => (
          <div key={k} className="text-[10.5px] font-mono flex items-center justify-between gap-2">
            <span className="text-[color:var(--fg-muted)] truncate">{k}</span>
            <span className="text-[color:var(--fg-faint)] shrink-0">{mask(String(map[k] ?? ""))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CliCmd({ cmd, note }: { cmd: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          navigator.clipboard?.writeText(cmd);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="inline-flex items-center gap-1.5 text-[11px] font-mono bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded px-2 py-1 hover:border-[color:var(--accent)]/40 transition"
      >
        {copied ? <Check size={10} className="text-[color:var(--success)]" /> : <Copy size={10} />}
        {cmd}
      </button>
      <span className="text-[10px] text-[color:var(--fg-faint)]">{note}</span>
    </div>
  );
}

function AddEditPanel({
  mode,
  projectDir,
  initial,
  inline,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  projectDir: string;
  initial?: McpServer;
  inline?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [scope, setScope] = useState<Scope>(initial?.scope ?? "user");
  const [transport, setTransport] = useState<Transport>(initial?.transport ?? "stdio");
  const [json, setJson] = useState<string>(
    JSON.stringify(initial?.config ?? TEMPLATES.stdio, null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onTransport = (t: Transport) => {
    setTransport(t);
    if (mode === "add") setJson(JSON.stringify(TEMPLATES[t], null, 2));
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Server name is required.");
    if ((scope === "project" || scope === "local") && !projectDir)
      return setError("Set a project directory (in the Config tab) to use project/local scope.");
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(json);
    } catch {
      return setError("Config is not valid JSON.");
    }
    setSaving(true);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode === "add" ? "add" : "update", scope, name: name.trim(), config, projectDir }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Save failed");
      else onSaved();
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={mode === "edit"}
            placeholder="github"
            className="mt-1 w-full bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md px-2.5 py-1.5 text-xs font-mono disabled:opacity-60 focus:border-[color:var(--accent)] transition"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">Scope</label>
          <div className="mt-1">
            <Select
              value={scope}
              onChange={(v) => setScope(v as Scope)}
              options={[
                { value: "user", label: "user — all projects" },
                { value: "project", label: "project — .mcp.json (shared)" },
                { value: "local", label: "local — this project, private" },
              ]}
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">Transport</label>
          <div className="mt-1">
            <Select
              value={transport}
              onChange={(v) => onTransport(v as Transport)}
              options={[
                { value: "stdio", label: "stdio (local process)" },
                { value: "http", label: "http (remote)" },
                { value: "sse", label: "sse (remote streaming)" },
                { value: "ws", label: "ws (websocket)" },
              ]}
            />
          </div>
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">
          Server config (JSON)
        </label>
        <div className="mt-1">
          <Textarea value={json} onChange={setJson} rows={9} monospaced />
        </div>
      </div>
      {error && (
        <div className="text-[11px] text-[color:var(--danger)] inline-flex items-center gap-1.5">
          <AlertTriangle size={11} /> {error}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-xs px-3 h-7 rounded-md bg-[color:var(--accent)] text-black font-medium hover:bg-[color:var(--accent-2)] transition disabled:opacity-40"
        >
          {saving ? "Saving…" : mode === "add" ? "Add server" : "Save changes"}
        </button>
        <button
          onClick={onClose}
          className="text-xs px-2.5 h-7 rounded-md text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  if (inline) return body;
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Plus size={14} className="text-[color:var(--accent)]" /> Add MCP server
      </h3>
      {body}
    </Card>
  );
}
