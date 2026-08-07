"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { TextInput } from "./primitives";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// One row. The key edits into LOCAL state and commits on blur — committing on
// every keystroke remounts the row (the map is keyed by the key itself, focus
// is lost per character) and an intermediate name colliding with another key
// silently merges the two entries.
function KVRow({
  k,
  v,
  values,
  onChange,
}: {
  k: string;
  v: string;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  // Rows are keyed by `k`, so a successful rename remounts the row and this
  // initializer picks up the new key — no sync effect needed.
  const [keyDraft, setKeyDraft] = useState(k);

  const commitKey = () => {
    const nk = keyDraft.trim();
    if (!nk || nk === k) {
      setKeyDraft(k); // revert empty / unchanged
      return;
    }
    if (values[nk] !== undefined) {
      setKeyDraft(k); // collision — refuse instead of silently merging
      return;
    }
    const next: Record<string, string> = {};
    for (const [ek, ev] of Object.entries(values)) {
      next[ek === k ? nk : ek] = ev;
    }
    onChange(next);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12 }}
      className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
    >
      <div onBlur={commitKey} onKeyDown={(e) => e.key === "Enter" && commitKey()}>
        <TextInput value={keyDraft} onChange={setKeyDraft} monospaced />
      </div>
      <TextInput value={v} monospaced onChange={(nv) => onChange({ ...values, [k]: nv })} />
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
  );
}

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
          <KVRow key={k} k={k} v={v} values={values} onChange={onChange} />
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
