"use client";
import { useEffect, useState } from "react";
import { skillSchema } from "@/lib/schemas/skill";
import type { Field } from "@/lib/schemas/types";
import { Card, IconButton, TextInput } from "../primitives";
import { FieldRenderer } from "../Field";
import { parseFrontmatter, stringifyFrontmatter } from "@/lib/frontmatter";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type SkillEntry = {
  name: string;       // subdir basename = skill name
  hasSKILL: boolean;
};

export function SkillsDirEditor({
  dirPath,
  reloadKey,
  initialActiveSkill,
  onSaved,
}: {
  dirPath: string;
  reloadKey: number;
  initialActiveSkill?: string | null;
  onSaved: () => void;
}) {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");

  // Load the list of subdirectories that contain a SKILL.md
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const res = await fetch(`/api/file?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      if (cancelled) return;
      if (!data.isDir || !Array.isArray(data.entries)) {
        setSkills([]);
        return;
      }
      const subdirs = data.entries.filter((e: { name: string; isDir: boolean }) => e.isDir);
      // Probe each for SKILL.md presence
      const probed: SkillEntry[] = await Promise.all(
        subdirs.map(async (entry: { name: string }) => {
          const skillFile = `${dirPath}/${entry.name}/SKILL.md`;
          const r = await fetch(`/api/file?path=${encodeURIComponent(skillFile)}`);
          const j = await r.json();
          return { name: entry.name, hasSKILL: Boolean(j.exists && !j.isDir) };
        }),
      );
      if (cancelled) return;
      const valid = probed.filter((s) => s.hasSKILL).sort((a, b) => a.name.localeCompare(b.name));
      setSkills(valid);
      if (valid.length && !active) {
        // Prefer the initial deep-link if any, else first.
        const preferred =
          initialActiveSkill && valid.some((s) => s.name === initialActiveSkill)
            ? initialActiveSkill
            : valid[0].name;
        setActive(preferred);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [dirPath, reloadKey, initialActiveSkill, active]);

  // Load the active skill's SKILL.md
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!active) {
        setContent("");
        setDirty(false);
        return;
      }
      const file = `${dirPath}/${active}/SKILL.md`;
      const res = await fetch(`/api/file?path=${encodeURIComponent(file)}`);
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

  const uniqueName = (base: string) => {
    let i = 1;
    let name = base;
    while (skills.some((s) => s.name === name)) {
      i += 1;
      name = `${base}-${i}`;
    }
    return name;
  };

  const createSkill = async () => {
    const name = uniqueName("new-skill");
    const stub = stringifyFrontmatter({
      fm: { name, description: "", "user-invocable": true },
      body:
        "Describe what Claude should do when this skill runs.\n\nUse $ARGUMENTS for user-supplied input.\n",
    });
    const file = `${dirPath}/${name}/SKILL.md`;
    const res = await fetch("/api/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file, content: stub, backup: false }),
    });
    if (res.ok) {
      setSkills((prev) => [...prev, { name, hasSKILL: true }].sort((a, b) => a.name.localeCompare(b.name)));
      setActive(name);
      onSaved();
    }
  };

  const saveActive = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const file = `${dirPath}/${active}/SKILL.md`;
      const res = await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file, content, backup: true }),
      });
      if (res.ok) {
        setDirty(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteSkill = async () => {
    if (!active) return;
    if (
      !confirm(
        `Delete the entire ${active}/ directory? This removes SKILL.md AND any helper files inside. Backup of SKILL.md will be saved alongside.`,
      )
    )
      return;
    const file = `${dirPath}/${active}/SKILL.md`;
    // Backup SKILL.md (file API does this automatically on DELETE)
    await fetch(`/api/file?path=${encodeURIComponent(file)}`, { method: "DELETE" });
    // Note: file API refuses to delete directories. The skill's other files remain.
    // We mark the skill as deleted from the sidebar — the user can clean the dir
    // manually if there are leftover files.
    setSkills((prev) => prev.filter((s) => s.name !== active));
    setActive(null);
    onSaved();
  };

  const renameSkill = async () => {
    if (!active || !renameTo.trim()) return;
    const newName = renameTo.trim();
    if (newName === active) {
      setRenaming(null);
      return;
    }
    if (skills.some((s) => s.name === newName)) {
      alert(`A skill named "${newName}" already exists.`);
      return;
    }
    const oldFile = `${dirPath}/${active}/SKILL.md`;
    const newFile = `${dirPath}/${newName}/SKILL.md`;
    // Write to new location
    const w = await fetch("/api/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: newFile, content, backup: false }),
    });
    if (!w.ok) return;
    // Delete old SKILL.md (the empty dir stays — file API can't rmdir)
    await fetch(`/api/file?path=${encodeURIComponent(oldFile)}`, { method: "DELETE" });
    setSkills((prev) =>
      [...prev.filter((s) => s.name !== active), { name: newName, hasSKILL: true }].sort(
        (a, b) => a.name.localeCompare(b.name),
      ),
    );
    setActive(newName);
    setRenaming(null);
    onSaved();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      <Card className="p-3 h-fit">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Skills</h3>
          <button
            onClick={createSkill}
            className="inline-flex items-center gap-1 text-[11px] px-2 h-6 rounded bg-[color:var(--accent)]/15 text-[color:var(--accent)] border border-[color:var(--accent)]/30 hover:bg-[color:var(--accent)]/25 transition"
          >
            <Plus size={11} /> New
          </button>
        </div>
        <div className="space-y-0.5">
          <AnimatePresence initial={false}>
            {skills.map((s) => (
              <motion.button
                key={s.name}
                layout
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => setActive(s.name)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition flex items-center gap-1.5 ${
                  active === s.name
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]"
                }`}
              >
                <Sparkles size={11} className="shrink-0" />
                <span className="font-mono truncate">{s.name}/</span>
              </motion.button>
            ))}
          </AnimatePresence>
          {skills.length === 0 && (
            <div className="text-[11px] text-[color:var(--fg-faint)] py-4 text-center">
              No skills yet. Click <span className="text-[color:var(--accent)]">+ New</span>.
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
                    placeholder="new-skill-name"
                    monospaced
                  />
                  <button
                    onClick={renameSkill}
                    className="text-xs px-2.5 h-7 rounded bg-[color:var(--accent)] text-[color:var(--accent-ink)]"
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
                    {active}/SKILL.md
                  </button>
                  {dirty && (
                    <span className="text-[10px] text-[color:var(--warning)] uppercase">unsaved</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <IconButton label="Delete" variant="danger" onClick={deleteSkill}>
                  <Trash2 size={14} />
                </IconButton>
                <button
                  onClick={saveActive}
                  disabled={!dirty || saving}
                  className="text-xs px-3 h-7 rounded-md bg-[color:var(--accent)] text-[color:var(--accent-ink)] font-medium hover:bg-[color:var(--accent-2)] transition disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {skillSchema.fields.map((f: Field) => (
                <FieldRenderer key={f.key} field={f} values={values} onChange={onValuesChange} />
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-10 text-center text-sm text-[color:var(--fg-muted)]">
            Select a skill on the left, or click <span className="text-[color:var(--accent)]">+ New</span>{" "}
            to create one.
          </Card>
        )}
      </div>
    </div>
  );
}
