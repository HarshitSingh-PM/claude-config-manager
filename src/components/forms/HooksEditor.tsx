"use client";
import { useState } from "react";
import {
  hookEvents,
  hookMatcherHints,
  hookToolEvents,
  type HookEvent,
} from "@/lib/schemas/settings";
import { IconButton, NumberInput, Select, TextInput, Textarea, Toggle } from "../primitives";
import { KVInput } from "../KVInput";
import { ListInput } from "../ListInput";
import { InfoIcon } from "../Tooltip";
import { Plus, Trash2, Webhook, ChevronRight } from "lucide-react";

type Handler = Record<string, unknown> & { type?: string };
type MatcherGroup = { matcher?: string; hooks?: Handler[] } & Record<string, unknown>;
type HooksMap = Record<string, MatcherGroup[]>;

const handlerTypes = [
  { value: "command", label: "command — run a shell command" },
  { value: "http", label: "http — POST the event to a URL" },
  { value: "mcp_tool", label: "mcp_tool — call an MCP tool" },
  { value: "prompt", label: "prompt — ask a Claude model" },
  { value: "agent", label: "agent — spawn a verifying subagent" },
];

// Keys that belong to one handler type only; dropped when the type changes so
// a command hook never carries a stale `url`.
const typeKeys: Record<string, string[]> = {
  command: ["command", "args", "async", "asyncRewake", "shell"],
  http: ["url", "headers", "allowedEnvVars"],
  mcp_tool: ["server", "tool", "input"],
  prompt: ["prompt", "model"],
  agent: ["prompt", "model"],
};

function asGroups(v: unknown): MatcherGroup[] {
  return Array.isArray(v) ? (v.filter((g) => g && typeof g === "object") as MatcherGroup[]) : [];
}

function Row({ label, tip, children }: { label: string; tip?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-[11px] font-medium text-[color:var(--fg-muted)]">{label}</label>
        {tip && <InfoIcon content={tip} />}
      </div>
      {children}
    </div>
  );
}

function HandlerEditor({
  handler,
  event,
  onChange,
  onRemove,
}: {
  handler: Handler;
  event: HookEvent;
  onChange: (h: Handler) => void;
  onRemove: () => void;
}) {
  const type = typeof handler.type === "string" ? handler.type : "command";
  const set = (k: string, v: unknown) => {
    const next: Handler = { ...handler };
    const empty =
      v === undefined ||
      v === "" ||
      v === false ||
      (Array.isArray(v) && v.length === 0) ||
      (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);
    if (empty) delete next[k];
    else next[k] = v;
    onChange(next);
  };
  const setType = (t: string) => {
    const keep = new Set(typeKeys[t] ?? []);
    const next: Handler = {};
    for (const [k, v] of Object.entries(handler)) {
      const typed = Object.values(typeKeys).some((ks) => ks.includes(k));
      if (!typed || keep.has(k)) next[k] = v;
    }
    next.type = t;
    onChange(next);
  };
  const s = (k: string) => (typeof handler[k] === "string" ? (handler[k] as string) : "");
  const inputJson =
    handler.input && typeof handler.input === "object" ? JSON.stringify(handler.input, null, 2) : "";
  const [inputDraft, setInputDraft] = useState(inputJson);
  const [inputError, setInputError] = useState(false);

  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev-2)]/50 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select value={type} onChange={setType} options={handlerTypes} />
        </div>
        <IconButton label="Remove handler" variant="danger" onClick={onRemove}>
          <Trash2 size={13} />
        </IconButton>
      </div>

      {type === "command" && (
        <>
          <Row label="Command" tip="Shell command to run. It receives the event JSON on stdin; exit code 2 blocks. Use absolute paths or $CLAUDE_PROJECT_DIR.">
            <TextInput value={s("command")} onChange={(v) => set("command", v)} placeholder='"$CLAUDE_PROJECT_DIR"/.claude/hooks/lint.sh' monospaced />
          </Row>
          <Row label="Args (exec form)" tip="When set, `command` is spawned directly with these arguments — no shell involved.">
            <ListInput values={Array.isArray(handler.args) ? (handler.args as string[]) : []} onChange={(v) => set("args", v)} placeholder="--fix" />
          </Row>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Row label="Shell">
              <Select
                value={s("shell")}
                onChange={(v) => set("shell", v)}
                options={[
                  { value: "", label: "(default)" },
                  { value: "bash", label: "bash" },
                  { value: "powershell", label: "powershell" },
                ]}
              />
            </Row>
            <Row label="Run in background" tip="async: don't block Claude while the hook runs.">
              <Toggle checked={Boolean(handler.async)} onChange={(v) => set("async", v)} />
            </Row>
            <Row label="Wake Claude on failure" tip="asyncRewake: run in the background and wake Claude if the hook exits with code 2.">
              <Toggle checked={Boolean(handler.asyncRewake)} onChange={(v) => set("asyncRewake", v)} />
            </Row>
          </div>
        </>
      )}

      {type === "http" && (
        <>
          <Row label="URL" tip="The event JSON is POSTed here. The response body uses the same JSON output format as command hooks.">
            <TextInput value={s("url")} onChange={(v) => set("url", v)} placeholder="http://localhost:8080/hooks/pre-tool-use" monospaced />
          </Row>
          <Row label="Headers" tip="Values may reference $VAR — only variables listed under allowed env vars are resolved.">
            <KVInput
              values={(handler.headers as Record<string, string> | undefined) ?? {}}
              onChange={(v) => set("headers", v)}
              keyPlaceholder="Authorization"
              valuePlaceholder="Bearer $MY_TOKEN"
            />
          </Row>
          <Row label="Allowed env vars" tip="Environment variables that may be interpolated into header values.">
            <ListInput
              values={Array.isArray(handler.allowedEnvVars) ? (handler.allowedEnvVars as string[]) : []}
              onChange={(v) => set("allowedEnvVars", v)}
              placeholder="MY_TOKEN"
            />
          </Row>
        </>
      )}

      {type === "mcp_tool" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Row label="MCP server" tip="Name of a configured MCP server. Plugin servers use plugin:<plugin>:<server>.">
              <TextInput value={s("server")} onChange={(v) => set("server", v)} placeholder="my_server" monospaced />
            </Row>
            <Row label="Tool">
              <TextInput value={s("tool")} onChange={(v) => set("tool", v)} placeholder="security_scan" monospaced />
            </Row>
          </div>
          <Row label="Tool input (JSON)" tip='Arguments for the tool. String values support ${path} substitution from the event JSON, e.g. "${tool_input.file_path}".'>
            <Textarea
              value={inputDraft}
              rows={3}
              placeholder={'{ "file_path": "${tool_input.file_path}" }'}
              onChange={(text) => {
                setInputDraft(text);
                if (!text.trim()) {
                  setInputError(false);
                  set("input", undefined);
                  return;
                }
                try {
                  const parsed: unknown = JSON.parse(text);
                  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    setInputError(false);
                    set("input", parsed);
                  } else setInputError(true);
                } catch {
                  setInputError(true);
                }
              }}
            />
            {inputError && (
              <div className="mt-1 text-[11px] text-[color:var(--danger)]">Not saved yet — must be a JSON object.</div>
            )}
          </Row>
        </>
      )}

      {(type === "prompt" || type === "agent") && (
        <>
          <Row label="Prompt" tip="Sent to the model for a decision. $ARGUMENTS is replaced with the event JSON.">
            <Textarea
              value={s("prompt")}
              onChange={(v) => set("prompt", v)}
              rows={3}
              placeholder="Check whether every task in $ARGUMENTS is complete. Respond with a decision."
            />
          </Row>
          <Row label="Model" tip="Model used for the evaluation. Defaults to the background model.">
            <TextInput value={s("model")} onChange={(v) => set("model", v)} placeholder="haiku" monospaced />
          </Row>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {hookToolEvents.includes(event) && (
          <Row label="Only if (permission rule)" tip='Narrow further by tool arguments using one permission rule, e.g. Bash(git *) or Edit(*.ts).'>
            <TextInput value={s("if")} onChange={(v) => set("if", v)} placeholder="Bash(git *)" monospaced />
          </Row>
        )}
        <Row label="Timeout (seconds)" tip="Defaults: 600 for command, http and mcp_tool; 30 for prompt; 60 for agent.">
          <NumberInput value={handler.timeout as number | undefined} onChange={(v) => set("timeout", v)} placeholder="600" min={1} />
        </Row>
        <Row label="Spinner message" tip="Shown in the spinner while the hook runs.">
          <TextInput value={s("statusMessage")} onChange={(v) => set("statusMessage", v)} placeholder="Linting…" />
        </Row>
      </div>
    </div>
  );
}

export function HooksEditor({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const hooks: HooksMap =
    values.hooks && typeof values.hooks === "object" && !Array.isArray(values.hooks)
      ? (values.hooks as HooksMap)
      : {};
  const configured = Object.keys(hooks).filter((e) => asGroups(hooks[e]).length > 0);
  const [open, setOpen] = useState<string | null>(configured[0] ?? null);
  const [adding, setAdding] = useState("");

  const write = (next: HooksMap) => {
    const cleaned: HooksMap = {};
    for (const [e, groups] of Object.entries(next)) if (groups.length > 0) cleaned[e] = groups;
    const out = { ...values };
    if (Object.keys(cleaned).length > 0) out.hooks = cleaned;
    else delete out.hooks;
    onChange(out);
  };
  const setGroups = (event: string, groups: MatcherGroup[]) => write({ ...hooks, [event]: groups });

  const known = new Map(hookEvents.map((e) => [e.value as string, e]));
  const addable = hookEvents.filter((e) => !configured.includes(e.value));

  return (
    <fieldset className="border border-[color:var(--border)] rounded-lg p-4 bg-[color:var(--bg-elev)]/40">
      <legend className="px-2 text-xs font-medium tracking-wide uppercase text-[color:var(--fg-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <Webhook size={12} className="text-[color:var(--accent)]" />
          Hooks
          <InfoIcon
            content="Each event holds matcher groups; each group holds one or more handlers. All matching handlers run in parallel."
            significance="Command hooks: exit 0 = continue, exit 2 = block (stderr goes to Claude). Always use absolute paths or $CLAUDE_PROJECT_DIR."
          />
          {configured.length > 0 && (
            <span className="normal-case tracking-normal text-[10px] text-[color:var(--accent)]">
              {configured.length} {configured.length === 1 ? "event" : "events"}
            </span>
          )}
        </span>
      </legend>

      <div className="space-y-2">
        {configured.map((event) => {
          const groups = asGroups(hooks[event]);
          const meta = known.get(event);
          const hint = hookMatcherHints[event as HookEvent];
          const isOpen = open === event;
          return (
            <div key={event} className="border border-[color:var(--border)] rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 hover:bg-[color:var(--bg-elev-2)] transition">
                <button
                  type="button"
                  className="flex-1 flex items-center gap-2 text-left"
                  onClick={() => setOpen(isOpen ? null : event)}
                >
                  <ChevronRight size={13} className={isOpen ? "rotate-90 transition-transform" : "transition-transform"} />
                  <span className="font-mono text-[12.5px] text-[color:var(--fg)]">{event}</span>
                  <span className="text-[10px] text-[color:var(--fg-faint)]">
                    {groups.reduce((n, g) => n + (Array.isArray(g.hooks) ? g.hooks.length : 0), 0)} handler(s)
                  </span>
                </button>
                <IconButton label="Remove event" variant="danger" onClick={() => setGroups(event, [])}>
                  <Trash2 size={13} />
                </IconButton>
              </div>
              {isOpen && (
                <div className="p-3 border-t border-[color:var(--border)] space-y-3">
                  {meta && <p className="text-[11px] text-[color:var(--fg-muted)]">{meta.tooltip}</p>}
                  {groups.map((g, gi) => {
                    const handlers = Array.isArray(g.hooks) ? g.hooks : [];
                    const setGroup = (ng: MatcherGroup) => setGroups(event, groups.map((x, i) => (i === gi ? ng : x)));
                    return (
                      <div key={gi} className="rounded-lg border border-dashed border-[color:var(--border-strong)] p-3 space-y-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            {hint ? (
                              <Row
                                label={`Matcher — ${hint.what}`}
                                tip="Empty or * matches everything. Letters, digits, _ and | are exact names (Edit|Write); anything else is a JavaScript regex."
                              >
                                <TextInput
                                  value={typeof g.matcher === "string" ? g.matcher : ""}
                                  onChange={(v) => {
                                    const ng = { ...g };
                                    if (v) ng.matcher = v;
                                    else delete ng.matcher;
                                    setGroup(ng);
                                  }}
                                  placeholder={hint.examples[0]}
                                  monospaced
                                />
                                <div className="flex flex-wrap gap-1 pt-1.5">
                                  {hint.examples.map((ex) => (
                                    <button
                                      key={ex}
                                      type="button"
                                      onClick={() => setGroup({ ...g, matcher: ex })}
                                      className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 transition"
                                    >
                                      {ex}
                                    </button>
                                  ))}
                                </div>
                              </Row>
                            ) : (
                              <p className="text-[11px] text-[color:var(--fg-faint)]">
                                This event has no matcher — it fires on every occurrence.
                              </p>
                            )}
                          </div>
                          <IconButton
                            label="Remove group"
                            variant="danger"
                            onClick={() => setGroups(event, groups.filter((_, i) => i !== gi))}
                          >
                            <Trash2 size={13} />
                          </IconButton>
                        </div>
                        {handlers.map((h, hi) => (
                          <HandlerEditor
                            key={hi}
                            handler={h}
                            event={event as HookEvent}
                            onChange={(nh) => setGroup({ ...g, hooks: handlers.map((x, i) => (i === hi ? nh : x)) })}
                            onRemove={() => setGroup({ ...g, hooks: handlers.filter((_, i) => i !== hi) })}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setGroup({ ...g, hooks: [...handlers, { type: "command", command: "" }] })}
                          className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--accent)] hover:underline"
                        >
                          <Plus size={12} /> Add handler
                        </button>
                      </div>
                    );
                  })}
                  {hint && (
                    <button
                      type="button"
                      onClick={() => setGroups(event, [...groups, { hooks: [{ type: "command", command: "" }] }])}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--accent)] hover:underline"
                    >
                      <Plus size={12} /> Add matcher group
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {configured.length === 0 && (
          <p className="text-[11px] text-[color:var(--fg-faint)]">
            No hooks configured in this scope. Pick an event to add one.
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1">
            <Select
              value={adding}
              onChange={setAdding}
              options={[
                { value: "", label: "Choose an event…" },
                ...addable.map((e) => ({ value: e.value, label: `${e.label} — ${e.tooltip}` })),
              ]}
            />
          </div>
          <button
            type="button"
            disabled={!adding}
            onClick={() => {
              setGroups(adding, [{ hooks: [{ type: "command", command: "" }] }]);
              setOpen(adding);
              setAdding("");
            }}
            className="inline-flex items-center gap-1.5 text-xs px-3 h-9 rounded-md bg-[color:var(--accent)]/15 text-[color:var(--accent)] border border-[color:var(--accent)]/30 hover:bg-[color:var(--accent)]/25 transition disabled:opacity-40"
          >
            <Plus size={13} /> Add hook
          </button>
        </div>
      </div>
    </fieldset>
  );
}
