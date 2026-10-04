"use client";
import { useState } from "react";
import type { Field, FieldGroup, FieldJson, FieldScope } from "@/lib/schemas/types";
import { getDeep, setDeep } from "@/lib/utils";
import { InfoIcon } from "./Tooltip";
import {
  NumberInput,
  Select,
  TextInput,
  Textarea,
  Toggle,
} from "./primitives";
import { ListInput } from "./ListInput";
import { KVInput } from "./KVInput";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

const scopeLabel: Record<FieldScope, { text: string; title: string }> = {
  user: {
    text: "user / managed",
    title: "Claude Code reads this key from user or managed settings only — it is ignored in project files.",
  },
  managed: {
    text: "managed only",
    title: "Only honored in managed (enterprise) settings.",
  },
};

function ScopeChip({ scope }: { scope?: FieldScope }) {
  if (!scope) return null;
  const s = scopeLabel[scope];
  return (
    <span
      title={s.title}
      className="text-[9.5px] uppercase tracking-wide px-1.5 py-px rounded border border-[color:var(--border)] text-[color:var(--fg-faint)]"
    >
      {s.text}
    </span>
  );
}

/** True when any leaf under this field has a value in `values`. */
export function fieldHasValue(field: Field, values: Record<string, unknown>): boolean {
  if (field.type === "group") return field.fields.some((f) => fieldHasValue(f, values));
  return getDeep(values, field.key) !== undefined;
}

function countSet(field: FieldGroup, values: Record<string, unknown>): number {
  let n = 0;
  for (const f of field.fields) {
    if (f.type === "group") n += countSet(f, values);
    else if (getDeep(values, f.key) !== undefined) n += 1;
  }
  return n;
}

function GroupField({
  field,
  values,
  onChange,
  forceOpen,
}: {
  field: FieldGroup;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  forceOpen?: boolean;
}) {
  const set = countSet(field, values);
  const [open, setOpen] = useState(() => !field.collapsed || set > 0);
  const shown = forceOpen || open;
  return (
    <fieldset className="border border-[color:var(--border)] rounded-lg p-4 bg-[color:var(--bg-elev)]/40">
      <legend className="px-2 text-xs font-medium tracking-wide uppercase text-[color:var(--fg-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={shown}
            className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-[color:var(--fg)] transition"
          >
            <ChevronRight
              size={12}
              className={shown ? "rotate-90 transition-transform" : "transition-transform"}
            />
            {field.label}
          </button>
          <InfoIcon content={field.tooltip} significance={field.significance} />
          {set > 0 && (
            <span className="normal-case tracking-normal text-[10px] text-[color:var(--accent)]">
              {set} set
            </span>
          )}
        </span>
      </legend>
      {shown ? (
        <div className="space-y-4">
          {field.fields.map((f) => (
            <FieldRenderer key={f.key} field={f} values={values} onChange={onChange} forceOpen={forceOpen} />
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] text-[color:var(--fg-faint)] hover:text-[color:var(--fg-muted)] transition"
        >
          {field.fields.length} settings — click to expand
        </button>
      )}
    </fieldset>
  );
}

function JsonField({
  field,
  current,
  update,
}: {
  field: FieldJson;
  current: unknown;
  update: (v: unknown) => void;
}) {
  const serialized = current === undefined ? "" : JSON.stringify(current);
  const [synced, setSynced] = useState(serialized);
  const [draft, setDraft] = useState(current === undefined ? "" : JSON.stringify(current, null, 2));
  const [error, setError] = useState<string | null>(null);
  // The value changed underneath us (preset merge, reload, raw-JSON edit) —
  // adopt it. Our own commits set `synced` first, so they don't reset the draft.
  if (serialized !== synced) {
    setSynced(serialized);
    setDraft(current === undefined ? "" : JSON.stringify(current, null, 2));
    setError(null);
  }

  const onEdit = (text: string) => {
    setDraft(text);
    if (!text.trim()) {
      setError(null);
      setSynced("");
      update(undefined);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed === null || typeof parsed !== "object") {
        setError("Must be a JSON object or array.");
        return;
      }
      setError(null);
      setSynced(JSON.stringify(parsed));
      update(parsed);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <Textarea value={draft} onChange={onEdit} placeholder={field.placeholder} rows={field.rows ?? 5} />
      {error && (
        <div className="mt-1 text-[11px] text-[color:var(--danger)]">
          Not saved yet — invalid JSON: {error}
        </div>
      )}
    </div>
  );
}

export function FieldRenderer({
  field,
  values,
  onChange,
  forceOpen,
}: {
  field: Field;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** Expand every group regardless of its collapsed state (used while filtering). */
  forceOpen?: boolean;
}) {
  if (field.hidden && field.hidden(values)) return null;

  if (field.type === "group") {
    return <GroupField field={field} values={values} onChange={onChange} forceOpen={forceOpen} />;
  }

  const current = getDeep(values, field.key);
  const update = (v: unknown) => onChange(setDeep(values, field.key, v));

  const label = (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="text-xs font-medium text-[color:var(--fg)]">{field.label}</label>
      <InfoIcon content={field.tooltip} significance={field.significance} />
      <ScopeChip scope={field.scope} />
    </div>
  );

  const wrap = (input: React.ReactNode) => (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      {label}
      {input}
    </motion.div>
  );

  switch (field.type) {
    case "string": {
      const v = typeof current === "string" ? current : "";
      if (field.multiline) {
        return wrap(
          <Textarea
            value={v}
            onChange={update}
            placeholder={field.placeholder}
            rows={field.rows ?? 6}
          />,
        );
      }
      return wrap(
        <TextInput value={v} onChange={update} placeholder={field.placeholder} monospaced />,
      );
    }
    case "number": {
      return wrap(
        <NumberInput
          value={current as number | undefined}
          onChange={update}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
        />,
      );
    }
    case "boolean": {
      // An unset key shows what Claude Code actually does by default, so a
      // default-on feature doesn't read as "off".
      const v = current === undefined ? Boolean(field.default) : Boolean(current);
      return (
        <motion.div
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="flex items-start justify-between gap-3 py-1"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-[color:var(--fg)]">{field.label}</span>
            <InfoIcon content={field.tooltip} significance={field.significance} />
            <ScopeChip scope={field.scope} />
            {current === undefined ? (
              <span className="text-[10px] text-[color:var(--fg-faint)]">default</span>
            ) : (
              <button
                type="button"
                onClick={() => update(undefined)}
                title="Remove this key so Claude Code uses its default"
                className="text-[10px] text-[color:var(--fg-faint)] hover:text-[color:var(--accent)] underline decoration-dotted transition"
              >
                reset
              </button>
            )}
          </div>
          <Toggle checked={v} onChange={update} />
        </motion.div>
      );
    }
    case "select": {
      const v = typeof current === "string" ? current : "";
      // A value written by hand or by a newer Claude Code that isn't in our
      // list still has to show — otherwise the select silently displays the
      // first option instead.
      const options =
        v && !field.options.some((o) => o.value === v)
          ? [...field.options, { value: v, label: `${v} (custom)` }]
          : field.options;
      return wrap(<Select value={v} onChange={update} options={options} />);
    }
    case "list": {
      // Frontmatter allows "Read, Grep" as a comma-separated string.
      const raw: unknown[] = Array.isArray(current)
        ? current
        : typeof current === "string"
          ? current.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
      const objectKey = field.objectKey;
      if (objectKey) {
        const isOurs = (x: unknown): x is Record<string, string> =>
          Boolean(x) && typeof x === "object" && typeof (x as Record<string, unknown>)[objectKey] === "string";
        const others = raw.filter((x) => !isOurs(x) && typeof x !== "string");
        const names = raw.flatMap((x) => (typeof x === "string" ? [x] : isOurs(x) ? [x[objectKey]] : []));
        return wrap(
          <>
            <ListInput
              values={names}
              onChange={(next) => {
                const out = [...next.map((n) => ({ [objectKey]: n })), ...others];
                update(out.length ? out : undefined);
              }}
              placeholder={field.itemPlaceholder}
              suggestions={field.suggestions}
            />
            {others.length > 0 && (
              <div className="mt-1 text-[11px] text-[color:var(--fg-faint)]">
                + {others.length} other {others.length === 1 ? "entry" : "entries"} kept as-is.
              </div>
            )}
          </>,
        );
      }
      return wrap(
        <ListInput
          values={raw.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))}
          onChange={(next) => update(next.length ? next : undefined)}
          placeholder={field.itemPlaceholder}
          suggestions={field.suggestions}
        />,
      );
    }
    case "kv": {
      const obj =
        current && typeof current === "object" && !Array.isArray(current)
          ? (current as Record<string, unknown>)
          : {};
      if (field.valueType === "boolean") {
        const shown: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) shown[k] = String(v);
        return wrap(
          <KVInput
            values={shown}
            onChange={(next) => {
              const out: Record<string, unknown> = {};
              // Anything other than an explicit "false" enables the entry, so
              // adding a row with an empty value turns it on.
              for (const [k, v] of Object.entries(next)) out[k] = v.trim().toLowerCase() !== "false";
              update(Object.keys(out).length ? out : undefined);
            }}
            keyPlaceholder={field.keyPlaceholder}
            valuePlaceholder={field.valuePlaceholder ?? "true"}
          />,
        );
      }
      return wrap(
        <KVInput
          values={obj as Record<string, string>}
          onChange={(next) => update(Object.keys(next).length ? next : undefined)}
          keyPlaceholder={field.keyPlaceholder}
          valuePlaceholder={field.valuePlaceholder}
        />,
      );
    }
    case "json": {
      return wrap(<JsonField field={field} current={current} update={update} />);
    }
  }
}
