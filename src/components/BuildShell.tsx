"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Package, Globe, Terminal, Hammer, Lock } from "lucide-react";
import { buildTools, type BuildTool } from "@/lib/buildTools";
import { Card } from "./primitives";
import { Reveal, Stagger, fadeUp, SPRING } from "./motion";
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
    <div className="max-w-[1440px] mx-auto px-6 py-9">
      {/* ─── Intro banner ─────────────────────────────────── */}
      <Reveal className="mb-6">
      <Card variant="gradient" className="p-5 flex items-start gap-3.5">
        <div className="h-11 w-11 shrink-0 rounded-[var(--radius)] bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-[#04120c] flex items-center justify-center shadow-[0_4px_16px_var(--accent-glow)]">
          <Hammer size={20} />
        </div>
        <div>
          <h3 className="t-h2">Build mode</h3>
          <p className="t-small text-[color:var(--fg-muted)] mt-1 leading-relaxed max-w-2xl">
            Guided prompt builders. Pick the kind of thing you&apos;re building, fill in the form,
            and get a well-structured prompt that you paste into Claude Code. Encodes the
            best practices so you don&apos;t have to remember them.
          </p>
        </div>
      </Card>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
        {/* ─── Sidebar: tools ─────────────────────────────── */}
        <Card className="p-2.5 h-fit">
          <div className="t-eyebrow text-[color:var(--fg-faint)] px-2 py-1.5">
            Builders
          </div>
          <Stagger className="space-y-0.5" stagger={0.04}>
            {buildTools.map((t) => {
              const disabled = t.status !== "ready";
              const isActive = t.id === active.id;
              return (
                <motion.button
                  key={t.id}
                  variants={fadeUp}
                  onClick={() => !disabled && setActiveId(t.id)}
                  disabled={disabled}
                  whileTap={disabled ? undefined : { scale: 0.97 }}
                  whileHover={disabled ? { x: [0, -2, 2, -2, 0] } : { x: 2 }}
                  transition={SPRING}
                  className={`relative w-full text-left px-2.5 py-2 rounded-md transition-colors flex items-start gap-2 ${
                    isActive
                      ? "text-[color:var(--accent)]"
                      : disabled
                        ? "text-[color:var(--fg-faint)] cursor-not-allowed opacity-60"
                        : "text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="build-active-pill"
                      className="absolute inset-0 rounded-md bg-[color:var(--accent-soft)]"
                      transition={SPRING}
                    />
                  )}
                  <span className="relative shrink-0 mt-0.5">{iconFor(t.iconKey)}</span>
                  <span className="relative flex-1 min-w-0">
                    <span className="t-small font-medium block truncate">{t.label}</span>
                    {disabled && (
                      <span className="t-label inline-flex items-center gap-1 mt-0.5 text-[color:var(--fg-faint)]">
                        <Lock size={10} /> coming soon
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </Stagger>
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
