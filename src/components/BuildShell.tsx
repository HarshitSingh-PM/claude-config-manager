"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Package, Globe, Terminal, Hammer, Lock } from "lucide-react";
import { buildTools, type BuildTool } from "@/lib/buildTools";
import { Card } from "./primitives";
import { SaaSPromptForm } from "./forms/SaaSPromptForm";

const iconFor = (key: BuildTool["iconKey"]) => {
  switch (key) {
    case "rocket":
      return <Rocket size={14} />;
    case "package":
      return <Package size={14} />;
    case "globe":
      return <Globe size={14} />;
    case "terminal":
      return <Terminal size={14} />;
  }
};

export function BuildShell() {
  const [activeId, setActiveId] = useState<string>("saas");
  const active = buildTools.find((t) => t.id === activeId) ?? buildTools[0];

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-6">
      {/* ─── Intro banner ─────────────────────────────────── */}
      <Card className="p-4 mb-5 flex items-start gap-3 bg-gradient-to-br from-[color:var(--accent-soft)]/40 to-transparent border-[color:var(--accent)]/30">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-[color:var(--accent)] text-black flex items-center justify-center">
          <Hammer size={16} />
        </div>
        <div>
          <h3 className="text-sm font-medium">Build mode</h3>
          <p className="text-[11.5px] text-[color:var(--fg-muted)] mt-0.5 leading-relaxed">
            Guided prompt builders. Pick the kind of thing you&apos;re building, fill in the form,
            and get a well-structured prompt that you paste into Claude Code. Encodes the
            best practices so you don&apos;t have to remember them.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
        {/* ─── Sidebar: tools ─────────────────────────────── */}
        <Card className="p-2.5 h-fit">
          <div className="text-[10px] font-medium tracking-wide uppercase text-[color:var(--fg-faint)] px-2 py-1.5">
            Builders
          </div>
          <div className="space-y-0.5">
            {buildTools.map((t) => {
              const disabled = t.status !== "ready";
              const isActive = t.id === active.id;
              return (
                <button
                  key={t.id}
                  onClick={() => !disabled && setActiveId(t.id)}
                  disabled={disabled}
                  className={`w-full text-left px-2.5 py-2 rounded-md transition flex items-start gap-2 ${
                    isActive
                      ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                      : disabled
                        ? "text-[color:var(--fg-faint)] cursor-not-allowed opacity-60"
                        : "text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]"
                  }`}
                >
                  <span className="shrink-0 mt-0.5">{iconFor(t.iconKey)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-xs font-medium block truncate">{t.label}</span>
                    {disabled && (
                      <span className="text-[10px] inline-flex items-center gap-1 mt-0.5 text-[color:var(--fg-faint)]">
                        <Lock size={9} /> coming soon
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* ─── Main: form ─────────────────────────────────── */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {active.id === "saas" ? (
                <SaaSPromptForm />
              ) : (
                <Card className="p-10 text-center text-sm text-[color:var(--fg-muted)]">
                  This builder is coming soon. Star the repo to track it.
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
