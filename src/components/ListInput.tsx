"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Removable, TextInput } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";

export function ListInput({
  values,
  onChange,
  placeholder,
  suggestions,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const unusedSuggestions = (suggestions ?? []).filter((s) => !values.includes(s));

  const add = (v: string) => {
    const t = v.trim();
    if (!t) return;
    if (values.includes(t)) return;
    onChange([...values, t]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {values.map((v, i) => (
          <motion.div
            key={v + "_" + i}
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
          >
            <Removable onRemove={() => onChange(values.filter((x) => x !== v))}>
              <TextInput
                value={v}
                onChange={(nv) => onChange(values.map((x) => (x === v ? nv : x)))}
                monospaced
              />
            </Removable>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TextInput
            value={draft}
            onChange={setDraft}
            placeholder={placeholder}
            monospaced
          />
        </div>
        <button
          onClick={() => add(draft)}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 h-7 rounded-md bg-[color:var(--accent)]/15 text-[color:var(--accent)] border border-[color:var(--accent)]/30 hover:bg-[color:var(--accent)]/25 transition"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="text-[11px] text-[color:var(--fg-faint)]">Suggestions:</span>
          {unusedSuggestions.slice(0, 12).map((s) => (
            <button
              key={s}
              onClick={() => add(s)}
              className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
