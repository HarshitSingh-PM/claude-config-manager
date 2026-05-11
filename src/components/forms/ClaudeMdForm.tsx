"use client";
import { claudeMdPresets } from "@/lib/presets/claudemd";
import { claudeMdSections } from "@/lib/presets/claudemdSections";
import { Card, SectionHeader, Textarea } from "../primitives";
import { Sparkles, FilePlus, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { InfoIcon, Tooltip } from "../Tooltip";

export function ClaudeMdForm({
  body,
  onChange,
}: {
  body: string;
  onChange: (body: string) => void;
}) {
  const lineCount = body.split("\n").length;
  const charCount = body.length;
  const tooLong = lineCount > 250;

  const appendSection = (text: string) => {
    const trimmed = body.trimEnd();
    const sep = trimmed ? "\n\n" : "";
    onChange(`${trimmed}${sep}${text.trim()}\n`);
  };

  const replaceWithPreset = (text: string) => {
    if (body.trim() && !confirm("Replace current CLAUDE.md content with this preset?")) {
      return;
    }
    onChange(text);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium">Content</h3>
            <InfoIcon
              content="Plain Markdown. Use @path/to/file to include other files (max depth 5)."
              significance="Lead with WHY, then WHAT/HOW. Keep under 200 lines. Don't use this as a linter — that's hooks' job."
            />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[color:var(--fg-faint)]">
            <span>{lineCount} lines</span>
            <span>{charCount.toLocaleString()} chars</span>
            {tooLong && (
              <span className="text-[color:var(--warning)]">
                ⚠ Over 200 lines — consider trimming
              </span>
            )}
          </div>
        </div>
        <Textarea
          value={body}
          onChange={onChange}
          rows={28}
          placeholder={`# Project name

## Project overview
One paragraph: what this project does, who uses it, what success looks like.

## Stack
- Language: TypeScript 5.6 (strict mode)
- Runtime: Node 20.9+
- Package manager: pnpm

## Commands
- Install: \`pnpm install\`
- Dev:     \`pnpm dev\`
- Test:    \`pnpm vitest run\`
- Lint:    \`pnpm lint\`

## Hard rules
- Never force-push to main
- Never commit secrets
- Never disable a failing test silently

────────────────────────────────────────
Use the "Add a section" panel on the right to drop in filled-in templates
for stack / testing / architecture / workflow / etc.`}
        />
      </Card>

      <div className="space-y-4 self-start xl:sticky xl:top-4">
        {/* ─── Add a section (append) ─────────────── */}
        <Card className="p-4">
          <SectionHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <FilePlus size={13} className="text-[color:var(--accent)]" />
                Add a section
              </span>
            }
            description="Appends a filled-in template to the bottom of your CLAUDE.md. Edit the example to match your project."
          />
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {claudeMdSections.map((s) => (
              <Tooltip
                key={s.id}
                content={s.description}
                significance="Click to append. Each section is a working example you can keep and edit."
              >
                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => appendSection(s.body)}
                  className="w-full text-left px-2.5 py-2 rounded-md border border-transparent hover:border-[color:var(--accent)]/40 hover:bg-[color:var(--accent-soft)] transition group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[color:var(--fg)]">{s.title}</span>
                    <FilePlus
                      size={11}
                      className="text-[color:var(--fg-faint)] group-hover:text-[color:var(--accent)] opacity-0 group-hover:opacity-100 transition"
                    />
                  </div>
                  <div className="text-[10.5px] text-[color:var(--fg-muted)] mt-0.5 leading-snug">
                    {s.description}
                  </div>
                </motion.button>
              </Tooltip>
            ))}
          </div>
        </Card>

        {/* ─── Full-doc presets (replace) ─────────── */}
        <Card className="p-4">
          <SectionHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <Sparkles size={13} className="text-[color:var(--accent)]" />
                Full presets
              </span>
            }
            description="Replaces the whole document. Use when starting fresh."
          />
          <div className="space-y-2">
            {claudeMdPresets.map((p) => (
              <motion.button
                key={p.id}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => replaceWithPreset(p.body)}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-[color:var(--border)] hover:border-[color:var(--accent)]/50 hover:bg-[color:var(--accent-soft)] transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[color:var(--fg)]">{p.title}</span>
                  <RefreshCw
                    size={10}
                    className="text-[color:var(--fg-faint)] opacity-60"
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
    </div>
  );
}
