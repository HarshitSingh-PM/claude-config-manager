"use client";
import { useMemo, useState } from "react";
import {
  credentialCategories,
  credentialServices,
  type CredentialService,
  type CredentialVar,
} from "@/lib/credentialsCatalog";
import { Card, TextInput, Toggle } from "../primitives";
import { InfoIcon, Tooltip } from "../Tooltip";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Search,
  Eye,
  EyeOff,
  ShieldAlert,
  ExternalLink,
  Plus,
  X,
} from "lucide-react";
import { KVInput } from "../KVInput";

/**
 * Edits only the `env` block of the underlying settings.json values object.
 * Receives the entire values object so it can preserve every other key intact.
 */
export function CredentialsForm({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const env = useMemo(
    () => (values.env as Record<string, string> | undefined) ?? {},
    [values.env],
  );

  const setEnv = (next: Record<string, string>) => {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(next)) {
      if (k.trim() && v !== undefined && v !== null) cleaned[k] = v;
    }
    if (Object.keys(cleaned).length === 0) {
      const { env: _drop, ...rest } = values;
      void _drop;
      onChange(rest as Record<string, unknown>);
      return;
    }
    onChange({ ...values, env: cleaned });
  };

  // A service is "enabled" if any of its required (or any) vars are present in env
  const serviceEnabled = (s: CredentialService): boolean =>
    s.vars.some((v) => env[v.name] !== undefined);

  // Group services by category and apply search + category filter
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CredentialService["category"] | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return credentialServices.filter((s) => {
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (!q) return true;
      if (s.name.toLowerCase().includes(q)) return true;
      if (s.description.toLowerCase().includes(q)) return true;
      if (s.vars.some((v) => v.name.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [search, categoryFilter]);

  const enabledCount = credentialServices.filter(serviceEnabled).length;

  // Find env keys NOT mapped to any service so users can see/edit them too
  const knownVarNames = new Set(
    credentialServices.flatMap((s) => s.vars.map((v) => v.name)),
  );
  const customEnv = Object.fromEntries(
    Object.entries(env).filter(([k]) => !knownVarNames.has(k)),
  );

  return (
    <div className="space-y-5">
      {/* ─── Header & warnings ───────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-[color:var(--accent-soft)] border border-[color:var(--accent)]/30 flex items-center justify-center">
            <KeyRound size={16} className="text-[color:var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Credentials</h3>
              <span className="text-[11px] text-[color:var(--fg-muted)]">
                {enabledCount} configured / {credentialServices.length} services
              </span>
            </div>
            <p className="text-[11.5px] text-[color:var(--fg-muted)] mt-1 leading-relaxed">
              These save into the <span className="font-mono text-[color:var(--accent)]">env</span> block of{" "}
              <span className="font-mono text-[color:var(--accent)]">~/.claude/settings.json</span> — set once
              here, exported into every Bash command and MCP server Claude Code runs, in every project.
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 p-3 rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/[0.06]">
          <ShieldAlert size={14} className="text-[color:var(--warning)] mt-0.5 shrink-0" />
          <div className="text-[11px] text-[color:var(--fg-muted)] leading-relaxed">
            <span className="text-[color:var(--warning)] font-medium">Stored in plain text on disk.</span> Fine
            for personal-laptop API keys; not appropriate for high-blast-radius prod secrets. For those, use
            an <span className="font-mono">apiKeyHelper</span> command that fetches from your OS keychain or
            1Password CLI at runtime instead.
          </div>
        </div>
      </Card>

      {/* ─── Search + category filter ────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--fg-faint)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services or env var names…"
            className="w-full bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md pl-8 pr-3 py-1.5 text-xs focus:border-[color:var(--accent)] transition"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <CategoryChip
            label="All"
            active={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
            count={credentialServices.length}
          />
          {credentialCategories.map((c) => {
            const count = credentialServices.filter((s) => s.category === c.id).length;
            if (!count) return null;
            return (
              <CategoryChip
                key={c.id}
                label={`${c.emoji} ${c.label}`}
                active={categoryFilter === c.id}
                onClick={() => setCategoryFilter(c.id)}
                count={count}
              />
            );
          })}
        </div>
      </div>

      {/* ─── Services list ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AnimatePresence initial={false}>
          {filtered.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              env={env}
              enabled={serviceEnabled(s)}
              setEnv={setEnv}
            />
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <Card className="p-10 text-center text-xs text-[color:var(--fg-muted)]">
          No services match{" "}
          <span className="font-mono text-[color:var(--fg)]">&quot;{search}&quot;</span>. Try a different keyword
          or use the Custom env section below.
        </Card>
      )}

      {/* ─── Custom env vars ──────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Plus size={14} className="text-[color:var(--accent)]" />
            <h3 className="text-sm font-medium">Custom env vars</h3>
            <InfoIcon
              content="Any env vars you set here are exported alongside the credentials above. Same target file."
              significance="Use for tools not in the catalog, or for project-agnostic settings like NODE_ENV, EDITOR, TERM, etc."
            />
          </div>
          <span className="text-[11px] text-[color:var(--fg-muted)]">
            {Object.keys(customEnv).length} unmapped
          </span>
        </div>
        <KVInput
          values={customEnv}
          onChange={(next) => {
            // Merge: keep all known-service vars, replace custom set
            const merged: Record<string, string> = {};
            for (const [k, v] of Object.entries(env)) {
              if (knownVarNames.has(k)) merged[k] = v;
            }
            for (const [k, v] of Object.entries(next)) merged[k] = v;
            setEnv(merged);
          }}
          keyPlaceholder="MY_CUSTOM_VAR"
          valuePlaceholder="value"
        />
      </Card>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`text-[11px] px-2.5 py-1 rounded-md border transition flex items-center gap-1.5 ${
        active
          ? "bg-[color:var(--accent-soft)] border-[color:var(--accent)]/50 text-[color:var(--accent)]"
          : "border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] hover:border-[color:var(--border-strong)]"
      }`}
    >
      <span>{label}</span>
      <span className="text-[10px] opacity-60">{count}</span>
    </motion.button>
  );
}

function ServiceCard({
  service,
  env,
  enabled,
  setEnv,
}: {
  service: CredentialService;
  env: Record<string, string>;
  enabled: boolean;
  setEnv: (next: Record<string, string>) => void;
}) {
  const [expanded, setExpanded] = useState(enabled);
  const filledCount = service.vars.filter((v) => env[v.name]).length;

  const toggle = (on: boolean) => {
    if (on) {
      // Pre-seed required vars as empty strings so they appear in the form (and in env on save)
      const next = { ...env };
      for (const v of service.vars) {
        if (v.required && next[v.name] === undefined) next[v.name] = "";
      }
      setEnv(next);
      setExpanded(true);
    } else {
      if (
        filledCount > 0 &&
        !confirm(`Remove all ${service.name} credentials from ~/.claude/settings.json?`)
      ) {
        return;
      }
      const next = { ...env };
      for (const v of service.vars) delete next[v.name];
      setEnv(next);
      setExpanded(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`border rounded-xl transition ${
        enabled
          ? "border-[color:var(--accent)]/30 bg-[color:var(--accent-soft)]/20"
          : "border-[color:var(--border)] bg-[color:var(--bg-elev)]/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3 p-3.5">
        <button
          onClick={() => setExpanded((x) => !x)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[color:var(--fg)]">{service.name}</span>
            {enabled && (
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-[color:var(--accent)]/40 text-[color:var(--accent)]">
                {filledCount}/{service.vars.length}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[color:var(--fg-muted)] mt-0.5 leading-snug truncate">
            {service.description}
          </p>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip content={`Open docs to get your ${service.name} token`}>
            <a
              href={service.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[color:var(--fg-faint)] hover:text-[color:var(--accent)] transition"
            >
              <ExternalLink size={13} />
            </a>
          </Tooltip>
          <Toggle checked={enabled} onChange={toggle} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-[color:var(--border)]/60">
              {service.vars.map((v) => (
                <VarRow
                  key={v.name}
                  v={v}
                  value={env[v.name] ?? ""}
                  onChange={(nv) => {
                    const next = { ...env };
                    if (nv === "" && !v.required) {
                      delete next[v.name];
                    } else {
                      next[v.name] = nv;
                    }
                    setEnv(next);
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function VarRow({
  v,
  value,
  onChange,
}: {
  v: CredentialVar;
  value: string;
  onChange: (next: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const mask = v.sensitive && !revealed;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-2 items-start">
      <div className="pt-1.5">
        <div className="flex items-center gap-1.5">
          <code className="text-[11px] font-mono text-[color:var(--fg)]">{v.name}</code>
          {v.required && (
            <span className="text-[9px] uppercase text-[color:var(--warning)]">req</span>
          )}
        </div>
        <div className="text-[10.5px] text-[color:var(--fg-muted)] mt-0.5 leading-snug">
          <span className="text-[color:var(--fg)]">{v.label}.</span> {v.description}
        </div>
      </div>
      <div className="relative">
        {mask ? (
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={v.placeholder}
            className="w-full bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md px-3 py-1.5 pr-9 text-sm font-mono focus:border-[color:var(--accent)] transition placeholder:text-[color:var(--fg-faint)]"
          />
        ) : (
          <TextInput
            value={value}
            onChange={onChange}
            placeholder={v.placeholder}
            monospaced
            className="pr-9"
          />
        )}
        {v.sensitive && (
          <button
            onClick={() => setRevealed((x) => !x)}
            aria-label={revealed ? "Hide" : "Reveal"}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--fg-faint)] hover:text-[color:var(--accent)] transition"
          >
            {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
        {value && (
          <button
            onClick={() => onChange("")}
            aria-label="Clear"
            className={`absolute ${v.sensitive ? "right-7" : "right-2"} top-1/2 -translate-y-1/2 text-[color:var(--fg-faint)] hover:text-[color:var(--danger)] transition`}
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
