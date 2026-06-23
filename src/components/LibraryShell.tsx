"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bot,
  Slash,
  Sparkles,
  Palette,
  Globe,
  FolderOpen,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Card } from "./primitives";
import { Reveal, Stagger, AnimatedNumber, fadeUp, SPRING } from "./motion";

type ItemType = "agent" | "command" | "skill" | "output-style";

type Item = {
  scope: "user" | "project-shared" | "project-local" | "enterprise";
  scopeLabel: string;
  type: ItemType;
  name: string;
  description: string;
  filePath: string;
  dirPath: string;
  fileName: string;
  targetId: string;
};

type Inventory = {
  items: Item[];
  counts: Record<ItemType, number>;
};

const TYPE_META: Record<ItemType, { label: string; icon: React.ReactNode; color: string }> = {
  agent: { label: "Subagents", icon: <Bot size={13} />, color: "var(--accent)" },
  command: { label: "Slash commands", icon: <Slash size={13} />, color: "var(--accent-2)" },
  skill: { label: "Skills", icon: <Sparkles size={13} />, color: "var(--success)" },
  "output-style": { label: "Output styles", icon: <Palette size={13} />, color: "var(--warning)" },
};

export function LibraryShell({
  projectDir,
  onOpenInConfig,
}: {
  projectDir: string;
  onOpenInConfig: (targetId: string, fileName: string) => void;
}) {
  const [data, setData] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch the inventory
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const u = projectDir
          ? `/api/inventory?projectDir=${encodeURIComponent(projectDir)}`
          : "/api/inventory";
        const res = await fetch(u);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Failed to load inventory");
        } else {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectDir, reloadKey]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.items.filter((it) => {
      if (typeFilter !== "all" && it.type !== typeFilter) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q) ||
        it.scopeLabel.toLowerCase().includes(q)
      );
    });
  }, [data, search, typeFilter]);

  const grouped = useMemo(() => {
    const m: Record<ItemType, Item[]> = {
      agent: [],
      command: [],
      skill: [],
      "output-style": [],
    };
    for (const it of filtered) m[it.type].push(it);
    return m;
  }, [filtered]);

  const allTotal = data
    ? data.counts.agent + data.counts.command + data.counts.skill + data.counts["output-style"]
    : 0;

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-5">
      {/* ─── Intro banner ─────────────────────────────────── */}
      <Reveal>
      <Card className="p-4 flex items-start gap-3 bg-gradient-to-br from-[color:var(--accent-soft)]/30 to-transparent border-[color:var(--accent)]/30">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-[color:var(--accent)] text-black flex items-center justify-center">
          <Sparkles size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Library</h3>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 h-7 rounded-md border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
          <p className="text-[11.5px] text-[color:var(--fg-muted)] mt-0.5 leading-relaxed">
            Everything configured for Claude Code on this machine, across user and project scopes —
            subagents, slash commands, skills, output styles. Click any row to jump to it in Config.
          </p>
        </div>
      </Card>
      </Reveal>

      {/* ─── Counter cards ────────────────────────────────── */}
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-3" stagger={0.06}>
        {(Object.keys(TYPE_META) as ItemType[]).map((t) => {
          const meta = TYPE_META[t];
          const count = data?.counts[t] ?? 0;
          const isActive = typeFilter === t;
          return (
            <motion.button
              key={t}
              variants={fadeUp}
              onClick={() => setTypeFilter(isActive ? "all" : t)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING}
              className={`group text-left p-3 rounded-xl border surface-interactive ${
                isActive
                  ? "border-[color:var(--accent)]/50 bg-[color:var(--accent-soft)]/40"
                  : "border-[color:var(--border)] bg-[color:var(--bg-elev)]/40"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)] mb-1.5">
                <motion.span
                  style={{ color: meta.color }}
                  animate={isActive ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                >
                  {meta.icon}
                </motion.span>
                {meta.label}
              </div>
              <div className="text-2xl font-semibold tracking-tight">
                {loading ? "—" : <AnimatedNumber value={count} />}
              </div>
            </motion.button>
          );
        })}
      </Stagger>

      {/* ─── Search + filter ──────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--fg-faint)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, description, scope…"
            className="w-full bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md pl-8 pr-3 py-1.5 text-xs focus:border-[color:var(--accent)] transition"
          />
        </div>
        <button
          onClick={() => setTypeFilter("all")}
          className={`text-[11px] px-2.5 py-1 rounded-md border transition ${
            typeFilter === "all"
              ? "bg-[color:var(--accent-soft)] border-[color:var(--accent)]/50 text-[color:var(--accent)]"
              : "border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
          }`}
        >
          All <span className="text-[10px] opacity-60">{allTotal}</span>
        </button>
      </div>

      {/* ─── Body ─────────────────────────────────────────── */}
      {loading ? (
        <Card className="p-10 text-center text-xs text-[color:var(--fg-muted)]">
          Loading inventory…
        </Card>
      ) : error ? (
        <Card className="p-10 text-center text-xs text-[color:var(--danger)]">{error}</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-xs text-[color:var(--fg-muted)]">
          {data && allTotal === 0 ? (
            <>
              Nothing configured yet. Add agents in the{" "}
              <span className="text-[color:var(--accent)]">Config</span> tab to populate this view.
            </>
          ) : (
            <>
              No items match. Adjust your filters.
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-5">
          {(Object.keys(TYPE_META) as ItemType[]).map((t) => {
            const items = grouped[t];
            if (items.length === 0) return null;
            const meta = TYPE_META[t];
            return (
              <section key={t}>
                <div className="flex items-center gap-1.5 mb-2 text-xs">
                  <span style={{ color: meta.color }}>{meta.icon}</span>
                  <span className="font-medium text-[color:var(--fg)]">{meta.label}</span>
                  <span className="text-[color:var(--fg-faint)]">{items.length}</span>
                </div>
                <Card className="p-0 overflow-hidden">
                  <div className="divide-y divide-[color:var(--border)]">
                    <AnimatePresence initial={false}>
                      {items.map((it) => (
                        <ItemRow
                          key={`${it.targetId}:${it.fileName}`}
                          item={it}
                          onOpen={() => onOpenInConfig(it.targetId, it.fileName)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const scopeIcon =
    item.scope === "user" ? <Globe size={10} /> : <FolderOpen size={10} />;
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      whileHover={{ x: 4 }}
      transition={{ type: "spring", stiffness: 500, damping: 34 }}
      onClick={onOpen}
      className="w-full text-left px-4 py-3 hover:bg-[color:var(--bg-elev-2)]/50 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[color:var(--fg)]">{item.name}</span>
            <span className="text-[9px] uppercase tracking-wide inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[color:var(--border)] text-[color:var(--fg-muted)]">
              {scopeIcon}
              {item.scopeLabel}
            </span>
            <code className="text-[10px] font-mono text-[color:var(--fg-faint)]">
              {item.fileName}
            </code>
          </div>
          {item.description && (
            <p className="text-[11.5px] text-[color:var(--fg-muted)] mt-1 leading-relaxed line-clamp-2">
              {item.description}
            </p>
          )}
        </div>
        <div className="shrink-0 inline-flex items-center gap-1 text-[10px] text-[color:var(--fg-faint)] group-hover:text-[color:var(--accent)] transition">
          Edit <ExternalLink size={10} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </motion.button>
  );
}
