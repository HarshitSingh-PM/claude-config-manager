"use client";
import { useEffect, useState } from "react";
import { agentSchema } from "@/lib/schemas/agent";
import { commandSchema } from "@/lib/schemas/command";
import { outputStyleSchema } from "@/lib/schemas/outputStyle";
import type { Schema, Field } from "@/lib/schemas/types";
import { Card, IconButton, TextInput } from "../primitives";
import { FieldRenderer } from "../Field";
import { parseFrontmatter, stringifyFrontmatter } from "@/lib/frontmatter";
import { Plus, Trash2, FileText, FilePlus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { agentTemplates } from "@/lib/presets/agents";
import { commandTemplates } from "@/lib/presets/commands";
import { outputStyleTemplates } from "@/lib/presets/outputStyles";

type Kind = "agents-dir" | "commands-dir" | "output-styles-dir";

const schemaFor: Record<Kind, Schema> = {
  "agents-dir": agentSchema,
  "commands-dir": commandSchema,
  "output-styles-dir": outputStyleSchema,
};

type Template = {
  id: string;
  title: string;
  source: string;
  description: string;
  fm: Record<string, unknown>;
  body: string;
};

const templatesFor: Record<Kind, Template[]> = {
  "agents-dir": agentTemplates,
  "commands-dir": commandTemplates,
  "output-styles-dir": outputStyleTemplates,
};

const blankFor: Record<Kind, { fileNameBase: string; fm: Record<string, unknown>; body: string }> = {
  "agents-dir": {
    fileNameBase: "agent",
    fm: { name: "agent", description: "", model: "sonnet", effort: "medium" },
    body: "You are a …\n\nYour job is to …\n",
  },
  "commands-dir": {
    fileNameBase: "command",
    fm: { name: "command", description: "", "argument-hint": "" },
    body: "Describe what the user wants: $ARGUMENTS\n\nThen do the work.\n",
  },
  "output-styles-dir": {
    fileNameBase: "style",
    fm: { name: "style", description: "", "keep-coding-instructions": true },
    body: "Respond …\n",
  },
};

export function DirEditor({
  dirPath,
  kind,
  reloadKey,
  onSaved,
}: {
  dirPath: string;
  kind: Kind;
  reloadKey: number;
  onSaved: () => void;
}) {
  const schema = schemaFor[kind];
  const templates = templatesFor[kind];
  const [files, setFiles] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [pickingTemplate, setPickingTemplate] = useState(false);

  // Load directory listing
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const res = await fetch(`/api/file?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      if (cancelled) return;
      if (data.isDir && Array.isArray(data.entries)) {
        const md = data.entries
          .filter((e: { name: string; isDir: boolean }) => !e.isDir && e.name.endsWith(".md"))
          .map((e: { name: string }) => e.name) as string[];
        setFiles(md.sort());
        if (md.length && !active) {
          setActive(md[0]);
        }
      } else {
        setFiles([]);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [dirPath, reloadKey, active]);

  // Load active file
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!active) {
        setContent("");
        setDirty(false);
        return;
      }
      const filePath = `${dirPath}/${active}`;
      const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (cancelled) return;
      setContent(typeof data.content === "string" ? data.content : "");
      setDirty(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [active, dirPath]);

  const { fm, body } = parseFrontmatter(content);
  const values: Record<string, unknown> = { ...fm, _body: body };

  const onValuesChange = (next: Record<string, unknown>) => {
    const { _body, ...rest } = next;
    const newContent = stringifyFrontmatter({
      fm: rest,
      body: typeof _body === "string" ? _body : "",
    });
    setContent(newContent);
    setDirty(true);
  };

  const uniqueFileName = (base: string) => {
    let i = 1;
    let name = `${base}.md`;
    while (files.includes(name)) {
      i += 1;
      name = `${base}-${i}.md`;
    }
    return name;
  };

  const createFromTemplate = async (tpl: Template | null) => {
    const source =
      tpl ??
      ({
        ...blankFor[kind],
        title: "blank",
        source: "blank",
        description: "blank",
        id: "blank",
      } as unknown as Template);
    const base =
      (tpl?.fm.name as string | undefined) ?? blankFor[kind].fileNameBase;
    const name = uniqueFileName(base);
    const stub = stringifyFrontmatter({
      fm: tpl ? { ...tpl.fm, name: name.replace(/\.md$/, "") } : { ...(source.fm), name: name.replace(/\.md$/, "") },
      body: source.body,
    });
    const filePath = `${dirPath}/${name}`;
    const res = await fetch("/api/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content: stub, backup: false }),
    });
    if (res.ok) {
      setFiles((f) => [...f, name].sort());
      setActive(name);
      setPickingTemplate(false);
      onSaved();
    }
  };

  const saveActive = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const filePath = `${dirPath}/${active}`;
      const res = await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content, backup: true }),
      });
      if (res.ok) {
        setDirty(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteActive = async () => {
    if (!active) return;
    if (!confirm(`Delete ${active}? A backup will be saved alongside.`)) return;
    const filePath = `${dirPath}/${active}`;
    const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setFiles((f) => f.filter((n) => n !== active));
      setActive(null);
      onSaved();
    }
  };

  const renameActive = async () => {
    if (!active || !renameTo.trim()) return;
    const newName = renameTo.endsWith(".md") ? renameTo : `${renameTo}.md`;
    if (newName === active) {
      setRenaming(null);
      return;
    }
    const oldPath = `${dirPath}/${active}`;
    const newPath = `${dirPath}/${newName}`;
    const w = await fetch("/api/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: newPath, content, backup: false }),
    });
    if (!w.ok) return;
    await fetch(`/api/file?path=${encodeURIComponent(oldPath)}`, { method: "DELETE" });
    setFiles((f) => [...f.filter((n) => n !== active), newName].sort());
    setActive(newName);
    setRenaming(null);
    onSaved();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
      <Card className="p-3 h-fit">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Files</h3>
          <button
            onClick={() => setPickingTemplate(true)}
            className="inline-flex items-center gap-1 text-[11px] px-2 h-6 rounded bg-[color:var(--accent)]/15 text-[color:var(--accent)] border border-[color:var(--accent)]/30 hover:bg-[color:var(--accent)]/25 transition"
          >
            <Plus size={11} /> New
          </button>
        </div>
        <div className="space-y-0.5">
          <AnimatePresence initial={false}>
            {files.map((f) => (
              <motion.button
                key={f}
                layout
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => setActive(f)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition flex items-center gap-1.5 ${
                  active === f
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]"
                }`}
              >
                <FileText size={12} className="shrink-0" />
                <span className="truncate">{f}</span>
              </motion.button>
            ))}
          </AnimatePresence>
          {files.length === 0 && (
            <div className="text-[11px] text-[color:var(--fg-faint)] py-4 text-center">
              No files yet. Click <span className="text-[color:var(--accent)]">+ New</span>.
            </div>
          )}
        </div>
      </Card>

      <div>
        {active ? (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4 gap-2">
              {renaming === active ? (
                <div className="flex items-center gap-2 flex-1">
                  <TextInput
                    value={renameTo}
                    onChange={setRenameTo}
                    placeholder="new-name.md"
                    monospaced
                  />
                  <button
                    onClick={renameActive}
                    className="text-xs px-2.5 h-7 rounded bg-[color:var(--accent)] text-black"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => setRenaming(null)}
                    className="text-xs px-2.5 h-7 rounded border border-[color:var(--border)] text-[color:var(--fg-muted)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setRenaming(active);
                      setRenameTo(active);
                    }}
                    className="font-mono text-sm text-[color:var(--fg)] hover:text-[color:var(--accent)]"
                  >
                    {active}
                  </button>
                  {dirty && (
                    <span className="text-[10px] text-[color:var(--warning)] uppercase">
                      unsaved
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <IconButton label="Delete" variant="danger" onClick={deleteActive}>
                  <Trash2 size={14} />
                </IconButton>
                <button
                  onClick={saveActive}
                  disabled={!dirty || saving}
                  className="text-xs px-3 h-7 rounded-md bg-[color:var(--accent)] text-black font-medium hover:bg-[color:var(--accent-2)] transition disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {schema.fields.map((f: Field) => (
                <FieldRenderer
                  key={f.key}
                  field={f}
                  values={values}
                  onChange={onValuesChange}
                />
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-10 text-center text-sm text-[color:var(--fg-muted)]">
            Select a file on the left, or click{" "}
            <button
              onClick={() => setPickingTemplate(true)}
              className="text-[color:var(--accent)] underline-offset-2 hover:underline"
            >
              + New
            </button>{" "}
            to start from a template.
          </Card>
        )}
      </div>

      {/* ─── Template picker dialog ───────────────────────── */}
      <AnimatePresence>
        {pickingTemplate && (
          <TemplatePicker
            templates={templates}
            onPick={createFromTemplate}
            onClose={() => setPickingTemplate(false)}
            kind={kind}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TemplatePicker({
  templates,
  onPick,
  onClose,
  kind,
}: {
  templates: Template[];
  onPick: (t: Template | null) => void;
  onClose: () => void;
  kind: Kind;
}) {
  const kindLabel = kind === "agents-dir" ? "subagent" : kind === "commands-dir" ? "slash command" : "output style";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[color:var(--bg-elev)] border border-[color:var(--border)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
          <div>
            <h3 className="text-sm font-semibold">Pick a starter template</h3>
            <p className="text-[11px] text-[color:var(--fg-muted)] mt-0.5">
              Choose a community-vetted {kindLabel}, or start blank and write your own.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-3 max-h-[60vh] overflow-y-auto space-y-2">
          {templates.map((t) => (
            <motion.button
              key={t.id}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onPick(t)}
              className="w-full text-left px-4 py-3 rounded-lg border border-[color:var(--border)] hover:border-[color:var(--accent)]/50 hover:bg-[color:var(--accent-soft)] transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[color:var(--fg)]">{t.title}</span>
                <FilePlus size={13} className="text-[color:var(--fg-faint)]" />
              </div>
              <p className="text-[11.5px] text-[color:var(--fg-muted)] mt-1 leading-relaxed">
                {t.description}
              </p>
              <p className="text-[10px] text-[color:var(--fg-faint)] mt-1.5 font-mono">
                {t.source}
              </p>
            </motion.button>
          ))}
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onPick(null)}
            className="w-full text-left px-4 py-3 rounded-lg border border-dashed border-[color:var(--border)] hover:border-[color:var(--accent)]/50 hover:bg-[color:var(--accent-soft)] transition"
          >
            <span className="text-sm font-medium text-[color:var(--fg-muted)]">Blank file</span>
            <p className="text-[11.5px] text-[color:var(--fg-faint)] mt-1">
              Start with empty frontmatter and a minimal body.
            </p>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
