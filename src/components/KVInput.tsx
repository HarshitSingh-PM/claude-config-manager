"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { TextInput } from "./primitives";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function KVInput({
  values,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const [dk, setDk] = useState("");
  const [dv, setDv] = useState("");

  const add = () => {
    const k = dk.trim();
    if (!k) return;
    if (values[k] !== undefined) return;
    onChange({ ...values, [k]: dv });
    setDk("");
    setDv("");
  };

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {Object.entries(values).map(([k, v]) => (
          <motion.div
            key={k}
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
          >
            <TextInput
              value={k}
              monospaced
              onChange={(nk) => {
                if (!nk.trim() || nk === k) return;
                const next: Record<string, string> = {};
                for (const [ek, ev] of Object.entries(values)) {
                  next[ek === k ? nk : ek] = ev;
                }
                onChange(next);
              }}
            />
            <TextInput
              value={v}
              monospaced
              onChange={(nv) => onChange({ ...values, [k]: nv })}
            />
            <button
              onClick={() => {
                const next = { ...values };
                delete next[k];
                onChange(next);
              }}
              aria-label="Remove"
              className="opacity-60 hover:opacity-100 text-[color:var(--fg-muted)] hover:text-[color:var(--danger)] transition"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <TextInput value={dk} onChange={setDk} placeholder={keyPlaceholder} monospaced />
        <TextInput value={dv} onChange={setDv} placeholder={valuePlaceholder} monospaced />
        <button
          onClick={add}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 h-7 rounded-md bg-[color:var(--accent)]/15 text-[color:var(--accent)] border border-[color:var(--accent)]/30 hover:bg-[color:var(--accent)]/25 transition"
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}
