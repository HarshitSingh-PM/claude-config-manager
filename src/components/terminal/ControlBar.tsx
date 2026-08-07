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
  { label: "Fable 5", arg: "fable", desc: "Anthropic's most capable model — deepest reasoning, premium cost." },
  { label: "Opus 5", arg: "opus", desc: "Most capable everyday model — best for hard tasks." },
  { label: "Sonnet 5", arg: "sonnet", desc: "Balanced quality/speed — a strong everyday default." },
  { label: "Haiku 4.5", arg: "haiku", desc: "Fastest & cheapest — great for simple, high-volume work." },
  { label: "Opus Plan", arg: "opusplan", desc: "Opus while planning, Sonnet to execute — quality where it counts, cheaper to run." },
  { label: "Opus 1M", arg: "opus[1m]", desc: "Opus with a 1M-token context — for very large codebases (uses more of your limit)." },
  { label: "Default", arg: "default", desc: "Clear the override — use your account default." },
];
const EFFORTS = [
  { label: "Low", arg: "low", desc: "Fewer reasoning tokens — fastest & cheapest. Good for routine edits." },
  { label: "Medium", arg: "medium", desc: "Moderate reasoning — a balanced default." },
  { label: "High", arg: "high", desc: "More reasoning — better on tricky problems, slower & pricier." },
  { label: "X-High", arg: "xhigh", desc: "Deep reasoning — for complex, multi-step work." },
  { label: "Max", arg: "max", desc: "Maximum reasoning — highest quality, slowest & most tokens." },
];

function Dropdown({
  icon,
  label,
  hint,
  items,
  onPick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  items: { label: string; arg: string; desc: string }[];
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
        title={hint}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-2 text-[11px] text-[color:var(--fg-muted)] transition hover:text-[color:var(--fg)] disabled:opacity-40"
      >
        {icon}
        <span>{label}</span>
        <ChevronDown size={11} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-1 w-[248px] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elev-2)] py-1 shadow-xl">
          {items.map((it) => (
            <button
              key={it.arg}
              onClick={() => {
                onPick(it.arg);
                setOpen(false);
              }}
              className="group/it flex w-full flex-col px-3 py-1.5 text-left transition hover:bg-[color:var(--accent-soft)]"
            >
              <span className="flex items-center text-[11px] text-[color:var(--fg)]">
                {it.label}
                <span className="ml-auto font-mono text-[9px] text-[color:var(--fg-faint)]">
                  {it.arg}
                </span>
              </span>
              <span className="mt-0.5 text-[10px] leading-snug text-[color:var(--fg-faint)] group-hover/it:text-[color:var(--fg-muted)]">
                {it.desc}
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
  title,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
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
        hint="Which model runs in the focused session. Bigger models are smarter but slower and use more of your usage limit."
        items={MODELS}
        onPick={(a) => cmd(`/model ${a}`)}
        disabled={disabled}
      />
      <Dropdown
        icon={<Gauge size={12} />}
        label="Effort"
        hint="How much the model reasons before answering. Higher effort improves hard-problem quality but is slower and spends more tokens."
        items={EFFORTS}
        onPick={(a) => cmd(`/effort ${a}`)}
        disabled={disabled}
      />
      <QuickBtn
        icon={<ShieldHalf size={12} />}
        label="Permission ⇧⇥"
        title="Cycle the permission mode (Shift+Tab): Manual → Accept edits → Plan. Looser modes = fewer prompts and faster flow, but Claude acts with less oversight."
        onClick={() => onSend("\x1b[Z")}
        disabled={disabled}
      />
      <QuickBtn
        icon={<Brain size={12} />}
        label="Thinking ⌥T"
        title="Toggle extended thinking (Option+T). On = deeper reasoning on complex tasks (more tokens); off = faster, leaner replies."
        onClick={() => onSend("\x1bt")}
        disabled={disabled}
      />

      <span className="mx-1 h-4 w-px bg-[color:var(--border)]" />

      <QuickBtn icon={<Layers size={12} />} label="/context" title="Show the context-window usage breakdown — see what's filling the window and how much room is left." onClick={() => cmd("/context")} disabled={disabled} />
      <QuickBtn icon={<Layers size={12} />} label="/compact" title="Summarize & compress the conversation to reclaim context space — improves speed/quality when the window is getting full." onClick={() => cmd("/compact")} disabled={disabled} />
      <QuickBtn icon={<Trash2 size={12} />} label="/clear" title="Start a fresh conversation (keeps project memory) — the cleanest way to reset a bloated context." onClick={() => cmd("/clear")} disabled={disabled} />
      <QuickBtn icon={<BookOpen size={12} />} label="/help" title="List all available slash commands in the session." onClick={() => cmd("/help")} disabled={disabled} />

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
