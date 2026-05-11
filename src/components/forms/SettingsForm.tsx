"use client";
import { settingsSchema } from "@/lib/schemas/settings";
import { settingsPresets } from "@/lib/presets/settings";
import { FieldRenderer } from "../Field";
import { Card, SectionHeader } from "../primitives";
import { Sparkles, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { deepMerge } from "@/lib/utils";

export function SettingsForm({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
      <Card className="p-5 space-y-5">
        {settingsSchema.fields.map((f) => (
          <FieldRenderer
            key={f.key}
            field={f}
            values={values}
            onChange={onChange}
          />
        ))}
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
