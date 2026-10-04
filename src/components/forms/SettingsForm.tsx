"use client";
import { useState } from "react";
import { settingsSchema } from "@/lib/schemas/settings";
import type { Field } from "@/lib/schemas/types";
import { settingsPresets } from "@/lib/presets/settings";
import { FieldRenderer } from "../Field";
import { HooksEditor } from "./HooksEditor";
import { Card, SectionHeader, TextInput } from "../primitives";
import { Sparkles, Plus, Search } from "lucide-react";
import { motion } from "framer-motion";
import { deepMerge } from "@/lib/utils";

// Keep only the fields (and the groups holding them) that match the query.
function filterFields(fields: Field[], q: string): Field[] {
  const out: Field[] = [];
  for (const f of fields) {
    const self = `${f.key} ${f.label} ${f.tooltip}`.toLowerCase().includes(q);
    if (f.type === "group") {
      if (self) out.push(f);
      else {
        const kids = filterFields(f.fields, q);
        if (kids.length > 0) out.push({ ...f, fields: kids });
      }
    } else if (self) out.push(f);
  }
  return out;
}

export function SettingsForm({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const fields = q ? filterFields(settingsSchema.fields, q) : settingsSchema.fields;
  const showHooks = !q || "hooks".includes(q) || q.includes("hook");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
      <Card className="p-5 space-y-5">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--fg-faint)] pointer-events-none"
          />
          <TextInput
            value={query}
            onChange={setQuery}
            placeholder="Filter settings — try “sandbox”, “worktree”, “notif”…"
            className="pl-9"
          />
        </div>
        {fields.map((f) => (
          // Remount when the filter toggles so groups pick up the right
          // open/closed state instead of keeping the filtered one.
          <div key={`${f.key}:${q ? "f" : "a"}`} className="space-y-5">
            <FieldRenderer field={f} values={values} onChange={onChange} forceOpen={Boolean(q)} />
            {f.key === "hooks_group" && showHooks && <HooksEditor values={values} onChange={onChange} />}
          </div>
        ))}
        {q && showHooks && !fields.some((f) => f.key === "hooks_group") && (
          <HooksEditor values={values} onChange={onChange} />
        )}
        {q && fields.length === 0 && !showHooks && (
          <p className="text-xs text-[color:var(--fg-faint)] py-6 text-center">
            No setting matches “{query}”.
          </p>
        )}
      </Card>

      <Card className="p-4 self-start sticky top-4">
        <SectionHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={13} className="text-[color:var(--accent)]" />
              Community presets
            </span>
          }
          description="Click to merge into your current draft. Existing values are preserved; arrays are unioned."
        />
        <div className="space-y-2">
          {settingsPresets.map((p) => (
            <motion.button
              key={p.id}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                onChange(deepMerge(values, p.patch))
              }
              className="w-full text-left px-3 py-2.5 rounded-lg border border-[color:var(--border)] hover:border-[color:var(--accent)]/50 hover:bg-[color:var(--accent-soft)] transition group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[color:var(--fg)]">{p.title}</span>
                <Plus
                  size={13}
                  className="text-[color:var(--fg-faint)] group-hover:text-[color:var(--accent)] transition"
                />
              </div>
              <div className="text-[11px] text-[color:var(--fg-muted)] mt-0.5 leading-relaxed">
                {p.description}
              </div>
              <div className="text-[10px] text-[color:var(--fg-faint)] mt-1 font-mono">
                {p.source}
              </div>
            </motion.button>
          ))}
        </div>
      </Card>
    </div>
  );
}
