"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Cpu,
  Gauge,
  ShieldHalf,
  Brain,
  SlidersHorizontal,
  BookOpen,
  Trash2,
  Layers,
} from "lucide-react";

// A bottom control strip, mirroring the Claude Code desktop footer. Each control
// injects the exact keystrokes/slash-command a user would type into the FOCUSED
// pane's running `claude` session (see onSend). It's a *sender*: because we can't
// read the CLI's current state back out of the PTY, model/effort are pickers that
// issue a command, and permission mode is a cycle (Shift+Tab) — matching how the
// CLI itself works.

const MODELS = [
  { label: "Opus", arg: "opus" },
  { label: "Sonnet", arg: "sonnet" },
  { label: "Haiku", arg: "haiku" },
  { label: "Opus Plan", arg: "opusplan" },
  { label: "Opus 1M", arg: "opus[1m]" },
  { label: "Default", arg: "default" },
];
const EFFORTS = [
  { label: "Low", arg: "low" },
  { label: "Medium", arg: "medium" },
  { label: "High", arg: "high" },
  { label: "X-High", arg: "xhigh" },
  { label: "Max", arg: "max" },
];

function Dropdown({
  icon,
  label,
  items,
  onPick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  items: { label: string; arg: string }[];
  onPick: (arg: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-2 text-[11px] text-[color:var(--fg-muted)] transition hover:text-[color:var(--fg)] disabled:opacity-40"
      >
        {icon}
        <span>{label}</span>
        <ChevronDown size={11} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-1 min-w-[130px] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elev-2)] py-1 shadow-xl">
          {items.map((it) => (
            <button
              key={it.arg}
              onClick={() => {
                onPick(it.arg);
                setOpen(false);
              }}
              className="flex w-full items-center px-3 py-1.5 text-left text-[11px] text-[color:var(--fg-muted)] transition hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--accent)]"
            >
              {it.label}
              <span className="ml-auto font-mono text-[9px] text-[color:var(--fg-faint)]">
                {it.arg}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-2 text-[11px] text-[color:var(--fg-muted)] transition hover:text-[color:var(--fg)] disabled:opacity-40"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function ControlBar({
  onSend,
  targetLabel,
  disabled,
}: {
  // Writes a raw string to the focused session's PTY (verbatim, no added newline).
  onSend: (data: string) => void;
  targetLabel: string | null;
  disabled: boolean;
}) {
  const cmd = (c: string) => onSend(c + "\r");

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elev)]/60 px-2.5 py-2">
      <span className="mr-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)]">
        <SlidersHorizontal size={11} /> Claude
      </span>

      <Dropdown
        icon={<Cpu size={12} />}
        label="Model"
        items={MODELS}
        onPick={(a) => cmd(`/model ${a}`)}
        disabled={disabled}
      />
      <Dropdown
        icon={<Gauge size={12} />}
        label="Effort"
        items={EFFORTS}
        onPick={(a) => cmd(`/effort ${a}`)}
        disabled={disabled}
      />
      <QuickBtn
        icon={<ShieldHalf size={12} />}
        label="Permission ⇧⇥"
        onClick={() => onSend("\x1b[Z")}
        disabled={disabled}
      />
      <QuickBtn
        icon={<Brain size={12} />}
        label="Thinking ⌥T"
        onClick={() => onSend("\x1bt")}
        disabled={disabled}
      />

      <span className="mx-1 h-4 w-px bg-[color:var(--border)]" />

      <QuickBtn icon={<Layers size={12} />} label="/context" onClick={() => cmd("/context")} disabled={disabled} />
      <QuickBtn icon={<Layers size={12} />} label="/compact" onClick={() => cmd("/compact")} disabled={disabled} />
      <QuickBtn icon={<Trash2 size={12} />} label="/clear" onClick={() => cmd("/clear")} disabled={disabled} />
      <QuickBtn icon={<BookOpen size={12} />} label="/help" onClick={() => cmd("/help")} disabled={disabled} />

      <span className="ml-auto text-[10px] text-[color:var(--fg-faint)]">
        {targetLabel ? (
          <>→ sends to <span className="text-[color:var(--fg-muted)]">{targetLabel}</span></>
        ) : (
          "focus a pane"
        )}
      </span>
    </div>
  );
}
