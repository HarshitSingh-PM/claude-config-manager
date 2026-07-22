"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gauge, RefreshCw } from "lucide-react";

type Meter = {
  usedPct: number;
  remainingPct: number;
  tokensUsed: number | null;
  tokensRemaining: number | null;
  resetAt: number | null;
};
type Usage = {
  available: boolean;
  updatedAt?: number;
  fiveHour?: Meter;
  weekly?: Meter;
  fableWeekly?: Meter;
  opusWeekly?: Meter;
  sonnetWeekly?: Meter;
};

// "3h 33m", "2d 4h", "<1m"
function untilReset(resetAt: number | null, now: number): string | null {
  if (!resetAt) return null;
  let ms = resetAt - now;
  if (ms <= 0) return "now";
  const d = Math.floor(ms / 86_400_000);
  ms -= d * 86_400_000;
  const h = Math.floor(ms / 3_600_000);
  ms -= h * 3_600_000;
  const m = Math.floor(ms / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

// Remaining-based color: healthy → low → critical.
function toneFor(remainingPct: number): { bar: string; text: string } {
  if (remainingPct <= 10) return { bar: "var(--danger)", text: "text-[color:var(--danger)]" };
  if (remainingPct <= 25) return { bar: "var(--warning)", text: "text-[color:var(--warning)]" };
  return { bar: "var(--accent)", text: "text-[color:var(--accent)]" };
}

function MeterRow({
  label,
  meter,
  now,
  emphasize,
}: {
  label: string;
  meter: Meter | undefined;
  now: number;
  emphasize?: boolean;
}) {
  if (!meter) return null;
  const tone = toneFor(meter.remainingPct);
  const reset = untilReset(meter.resetAt, now);
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`t-label font-medium ${emphasize ? "text-[color:var(--fg)]" : "text-[color:var(--fg-muted)]"}`}>
          {label}
        </span>
        <span className="inline-flex items-baseline gap-1.5">
          <span className={`font-mono ${emphasize ? "text-[15px]" : "text-[13px]"} font-semibold ${tone.text}`}>
            {meter.remainingPct}%
          </span>
          <span className="t-label text-[color:var(--fg-faint)]">left</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--bg-elev-2)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${meter.remainingPct}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${tone.bar}, var(--accent-2))` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between t-label text-[color:var(--fg-faint)]">
        <span>{meter.usedPct}% of limit used</span>
        {reset && <span>resets in {reset}</span>}
      </div>
    </div>
  );
}

export function UsageWidget() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const ref = useRef<HTMLDivElement | null>(null);

  const load = () =>
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d: Usage) => setUsage(d))
      .catch(() => setUsage({ available: false }));

  // Poll usage every 60s; tick the clock every 30s for live countdowns.
  useEffect(() => {
    load();
    const a = setInterval(load, 60_000);
    const b = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);

  // Close popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Nothing to show if the local Claude usage cache isn't present.
  if (usage && !usage.available) return null;

  const five = usage?.fiveHour;
  const headline = five?.remainingPct ?? null;
  const tone = five ? toneFor(five.remainingPct) : { bar: "var(--accent)", text: "text-[color:var(--fg-muted)]" };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Claude usage — 5h, weekly, and per-model limits"
        aria-label="Claude usage limits"
        className="inline-flex items-center gap-1.5 t-label font-medium text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition px-2.5 h-9 rounded-[10px] border border-[color:var(--border)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--bg-elev-2)]"
      >
        <Gauge size={14} className={headline != null ? tone.text : ""} />
        {headline != null ? (
          <span className="tabular-nums">
            <span className={`font-mono font-semibold ${tone.text}`}>{headline}%</span>
            <span className="hidden md:inline text-[color:var(--fg-faint)]"> · 5h</span>
          </span>
        ) : (
          <span className="hidden md:inline">Usage</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="absolute right-0 top-full z-40 mt-2 w-[300px] rounded-[var(--radius)] border border-[color:var(--border-strong)] bg-[color:var(--bg-elev-3)] p-4 shadow-[var(--shadow-lg)]"
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5 t-eyebrow text-[color:var(--fg-muted)]">
                <Gauge size={12} /> Usage remaining
              </div>
              <button
                onClick={load}
                title="Refresh"
                className="rounded-md p-1 text-[color:var(--fg-faint)] transition hover:text-[color:var(--fg)]"
              >
                <RefreshCw size={12} />
              </button>
            </div>

            {!usage ? (
              <div className="py-6 text-center t-small text-[color:var(--fg-faint)]">Loading…</div>
            ) : (
              <div className="divide-y divide-[color:var(--border)]">
                <MeterRow label="5-hour window" meter={usage.fiveHour} now={now} emphasize />
                <MeterRow label="Weekly (all models)" meter={usage.weekly} now={now} />
                <MeterRow label="Fable 5 · weekly" meter={usage.fableWeekly} now={now} />
                {usage.opusWeekly && usage.opusWeekly.usedPct > 0 && (
                  <MeterRow label="Opus · weekly" meter={usage.opusWeekly} now={now} />
                )}
              </div>
            )}

            <div className="mt-2.5 t-label leading-relaxed text-[color:var(--fg-faint)]">
              % of each plan limit, from the Claude app&apos;s usage cache
              (account-wide, model-cost-weighted — not raw API tokens).
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
