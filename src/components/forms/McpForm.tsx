"use client";
import { mcpServerSchema } from "@/lib/schemas/mcp";
import { FieldRenderer } from "../Field";
import { Card, IconButton } from "../primitives";
import { Plus, Trash2, ServerCog } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

type ServerEntry = {
  name: string;
  type: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  alwaysLoad?: boolean;
  /** The original on-disk entry — preserved so keys this form doesn't model
   *  (cwd, timeout, disabled, …) survive an edit. */
  raw?: Record<string, unknown>;
};

function fromObject(obj: Record<string, unknown>): ServerEntry[] {
  const servers = (obj.mcpServers as Record<string, Record<string, unknown>> | undefined) ?? {};
  return Object.entries(servers).map(([name, v]) => ({
    name,
    type: ((v.type as ServerEntry["type"]) ?? "stdio"),
    command: v.command as string | undefined,
    args: v.args as string[] | undefined,
    url: v.url as string | undefined,
    headers: v.headers as Record<string, string> | undefined,
    env: v.env as Record<string, string> | undefined,
    alwaysLoad: v.alwaysLoad as boolean | undefined,
    raw: v,
  }));
}

// `original` is the full previous file object — top-level keys we don't model
// ($schema, …) ride along, as do unmodelled per-server keys via `raw`. Fields
// the form DOES own are written from current form state (or removed when the
// user cleared them), regardless of the selected transport, so switching
// transport back and forth never destroys the other transport's config.
function toObject(servers: ServerEntry[], original: Record<string, unknown>): Record<string, unknown> {
  const mcpServers: Record<string, Record<string, unknown>> = {};
  for (const s of servers) {
    if (!s.name.trim()) continue;
    const entry: Record<string, unknown> = { ...(s.raw ?? {}), type: s.type };
    const put = (k: string, v: unknown, keep: boolean) => {
      if (keep) entry[k] = v;
      else delete entry[k];
    };
    put("command", s.command, Boolean(s.command));
    put("args", s.args, Boolean(s.args?.length));
    put("url", s.url, Boolean(s.url));
    put("headers", s.headers, Boolean(s.headers && Object.keys(s.headers).length));
    put("env", s.env, Boolean(s.env && Object.keys(s.env).length));
    put("alwaysLoad", true, Boolean(s.alwaysLoad));
    mcpServers[s.name] = entry;
  }
  return { ...original, mcpServers };
}

export function McpForm({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const servers = fromObject(values);
  const [expanded, setExpanded] = useState<string | null>(servers[0]?.name ?? null);

  const addServer = () => {
    const base = "server";
    let i = 1;
    let name = base;
    while (servers.some((s) => s.name === name)) {
      i += 1;
      name = `${base}-${i}`;
    }
    const next = [...servers, { name, type: "stdio" } as ServerEntry];
    onChange(toObject(next, values));
    setExpanded(name);
  };

  const removeServer = (name: string) => {
    onChange(toObject(servers.filter((s) => s.name !== name), values));
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium inline-flex items-center gap-1.5">
            <ServerCog size={14} className="text-[color:var(--accent)]" />
            MCP Servers
          </h3>
          <p className="text-xs text-[color:var(--fg-muted)] mt-0.5">
            Tools from these servers become available to Claude as mcp__&lt;name&gt;__&lt;tool&gt;.
          </p>
        </div>
        <button
          onClick={addServer}
          className="inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-md bg-[color:var(--accent)]/15 text-[color:var(--accent)] border border-[color:var(--accent)]/30 hover:bg-[color:var(--accent)]/25 transition"
        >
          <Plus size={13} /> Add server
        </button>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {servers.map((s) => {
            const open = expanded === s.name;
            return (
              <motion.div
                key={s.name}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="border border-[color:var(--border)] rounded-lg overflow-hidden"
              >
                {/* header is a div with a nested toggle button — a <button>
                    wrapping the remove IconButton is invalid HTML and made
                    the delete click also toggle/expand the panel */}
                <div className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[color:var(--bg-elev-2)] transition">
                  <button
                    className="flex-1 flex items-center gap-2 text-left"
                    onClick={() => setExpanded(open ? null : s.name)}
                  >
                    <span className="font-mono text-[12.5px] text-[color:var(--fg)]">{s.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)] border border-[color:var(--border)] px-1.5 py-0.5 rounded">
                      {s.type}
                    </span>
                  </button>
                  <IconButton
                    label="Remove"
                    variant="danger"
                    onClick={() => removeServer(s.name)}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 border-t border-[color:var(--border)] space-y-3">
                        {mcpServerSchema.fields.map((f) => (
                          <FieldRenderer
                            key={f.key}
                            field={f}
                            values={s as unknown as Record<string, unknown>}
                            onChange={(nv) => {
                              // Build the entry from the form values directly —
                              // a key ABSENT from nv means the user cleared it,
                              // which a diff-based patch could never express.
                              const rec = nv as Record<string, unknown>;
                              const newName = String(rec.name ?? s.name).trim() || s.name;
                              const updated: ServerEntry = {
                                name: newName,
                                type: ((rec.type as ServerEntry["type"]) ?? "stdio"),
                                command: rec.command as string | undefined,
                                args: rec.args as string[] | undefined,
                                url: rec.url as string | undefined,
                                headers: rec.headers as Record<string, string> | undefined,
                                env: rec.env as Record<string, string> | undefined,
                                alwaysLoad: rec.alwaysLoad as boolean | undefined,
                                raw: s.raw,
                              };
                              const next = servers.map((x) => (x.name === s.name ? updated : x));
                              onChange(toObject(next, values));
                              if (newName !== s.name) setExpanded(newName);
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {servers.length === 0 && (
          <div className="text-center py-10 text-xs text-[color:var(--fg-faint)]">
            No MCP servers configured. Click <span className="text-[color:var(--accent)]">Add server</span> to add one.
          </div>
        )}
      </div>
    </Card>
  );
}
