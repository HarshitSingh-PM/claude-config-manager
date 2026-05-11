"use client";
import { motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elev)]/60 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  right,
}: {
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h3 className="text-sm font-medium text-[color:var(--fg)]">{title}</h3>
        {description ? (
          <p className="text-xs text-[color:var(--fg-muted)] mt-0.5 leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
  monospaced,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  monospaced?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md px-3 py-1.5 text-sm",
        "placeholder:text-[color:var(--fg-faint)]",
        "focus:border-[color:var(--accent)] transition",
        monospaced && "font-mono text-[12.5px]",
        className,
      )}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  value: number | string | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value === undefined ? "" : value}
      placeholder={placeholder}
      min={min}
      max={max}
      onChange={(e) => {
        const s = e.target.value;
        if (s === "") onChange(undefined);
        else onChange(Number(s));
      }}
      className="w-32 bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md px-3 py-1.5 text-sm focus:border-[color:var(--accent)] transition"
    />
  );
}

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 6,
  monospaced = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  monospaced?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        "w-full bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md px-3 py-2 text-sm",
        "placeholder:text-[color:var(--fg-faint)] focus:border-[color:var(--accent)] transition resize-y",
        monospaced && "font-mono text-[12.5px] leading-relaxed",
      )}
    />
  );
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        checked
          ? "bg-[color:var(--accent)]"
          : "bg-[color:var(--border-strong)] hover:bg-[#3a3a42]",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 40 }}
        className={cn(
          "absolute top-0.5 inline-block h-4 w-4 rounded-full bg-white shadow",
          checked ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; description?: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md pl-3 pr-8 py-1.5 text-sm focus:border-[color:var(--accent)] transition"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[color:var(--bg-elev)]">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--fg-muted)] pointer-events-none"
      />
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "warning" | "success" | "danger";
}) {
  const colors = {
    default: "text-[color:var(--fg-muted)] border-[color:var(--border)]",
    accent: "text-[color:var(--accent)] border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]",
    warning: "text-[color:var(--warning)] border-[color:var(--warning)]/40",
    success: "text-[color:var(--success)] border-[color:var(--success)]/40",
    danger: "text-[color:var(--danger)] border-[color:var(--danger)]/40",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10.5px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded-md border",
        colors[tone],
      )}
    >
      {children}
    </span>
  );
}

export function IconButton({
  onClick,
  label,
  children,
  variant = "ghost",
  disabled,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  variant?: "ghost" | "danger" | "primary";
  disabled?: boolean;
}) {
  const v = {
    ghost:
      "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] hover:bg-[color:var(--bg-elev-2)]",
    danger: "text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10",
    primary: "bg-[color:var(--accent)] text-black hover:bg-[color:var(--accent-2)]",
  }[variant];
  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center h-7 w-7 rounded-md transition disabled:opacity-40 disabled:cursor-not-allowed",
        v,
      )}
    >
      {children}
    </button>
  );
}

export function Removable({
  onRemove,
  children,
}: {
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="group flex items-center gap-2">
      <div className="flex-1">{children}</div>
      <button
        onClick={onRemove}
        aria-label="Remove"
        className="opacity-60 hover:opacity-100 text-[color:var(--fg-muted)] hover:text-[color:var(--danger)] transition"
      >
        <X size={14} />
      </button>
    </div>
  );
}
