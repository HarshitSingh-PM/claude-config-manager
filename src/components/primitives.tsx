"use client";
import { motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  interactive,
  variant = "default",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  /** Adds hover-lift + accent glow; use for clickable/navigational cards. */
  interactive?: boolean;
  /** "elevated" = stronger surface/shadow; "gradient" = accent hairline border. */
  variant?: "default" | "elevated" | "gradient";
  onClick?: () => void;
}) {
  const base =
    variant === "gradient"
      ? "rounded-[var(--radius)] border-gradient shadow-[var(--shadow-md)]"
      : variant === "elevated"
        ? "rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--bg-elev)] shadow-[var(--shadow-lg)] surface-hi"
        : "rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--bg-elev)]/80 backdrop-blur-md surface-hi shadow-[var(--shadow-md)]";
  if (interactive || onClick) {
    return (
      <motion.div
        onClick={onClick}
        whileHover={{ y: -3 }}
        whileTap={onClick ? { scale: 0.99 } : undefined}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className={cn(base, "surface-interactive", onClick && "cursor-pointer", className)}
      >
        {children}
      </motion.div>
    );
  }
  return <div className={cn(base, className)}>{children}</div>;
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
    <div className="flex items-start justify-between gap-3 mb-3.5">
      <div>
        <h3 className="t-title text-[color:var(--fg)]">{title}</h3>
        {description ? (
          <p className="t-small text-[color:var(--fg-muted)] mt-1 leading-relaxed">{description}</p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/* ─── Button: the shared action primitive ─────────────────────── */
export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  disabled,
  type = "button",
  className,
  title,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
  icon?: ReactNode;
}) {
  const sizes = {
    sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[var(--radius-sm)]",
    md: "h-9 px-3.5 text-sm gap-2 rounded-[var(--radius-sm)]",
  }[size];
  const variants = {
    primary:
      "text-[#04120c] font-semibold bg-[linear-gradient(100deg,var(--accent),var(--accent-2))] hover:brightness-110 shadow-[0_4px_16px_var(--accent-glow)]",
    secondary:
      "font-medium text-[color:var(--fg)] bg-[color:var(--bg-elev-2)] border border-[color:var(--border-strong)] hover:border-[color:var(--accent)]/50 hover:bg-[color:var(--bg-elev-3)]",
    ghost:
      "font-medium text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] hover:bg-[color:var(--bg-elev-2)]",
    danger:
      "font-medium text-[color:var(--danger)] border border-[color:var(--danger)]/40 hover:bg-[color:var(--danger)]/12",
  }[variant];
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={cn(
        "inline-flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100",
        sizes,
        variants,
        className,
      )}
    >
      {icon}
      {children}
    </motion.button>
  );
}

const inputBase =
  "w-full bg-[color:var(--bg-elev-2)] border border-[color:var(--border-strong)] rounded-[var(--radius-sm)] text-sm text-[color:var(--fg)] " +
  "placeholder:text-[color:var(--fg-faint)] transition-colors " +
  "hover:border-[color:var(--border-strong)] focus:border-[color:var(--accent)] focus:bg-[color:var(--bg-elev)]";

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
      className={cn(inputBase, "px-3 py-2", monospaced && "font-mono text-[13px]", className)}
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
      className={cn(inputBase, "w-32 px-3 py-2")}
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
      className={cn(inputBase, "px-3 py-2.5 resize-y", monospaced && "font-mono text-[13px] leading-relaxed")}
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
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={cn(
        "relative h-[22px] w-10 rounded-full transition-colors shrink-0",
        checked
          ? "bg-[linear-gradient(100deg,var(--accent),var(--accent-2))]"
          : "bg-[color:var(--border-strong)] hover:bg-[#3f4552]",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 40 }}
        className={cn(
          "absolute top-[3px] inline-block h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)]",
          checked ? "left-[21px]" : "left-[3px]",
        )}
      />
    </motion.button>
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
        className={cn(inputBase, "appearance-none pl-3 pr-9 py-2 cursor-pointer")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[color:var(--bg-elev)]">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
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
    default: "text-[color:var(--fg-muted)] border-[color:var(--border-strong)] bg-[color:var(--bg-elev-2)]",
    accent: "text-[color:var(--accent)] border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]",
    warning: "text-[color:var(--warning)] border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10",
    success: "text-[color:var(--success)] border-[color:var(--success)]/40 bg-[color:var(--success)]/10",
    danger: "text-[color:var(--danger)] border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md border",
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
    danger: "text-[color:var(--danger)] hover:bg-[color:var(--danger)]/12",
    primary:
      "text-[#04120c] bg-[linear-gradient(100deg,var(--accent),var(--accent-2))] hover:brightness-110",
  }[variant];
  return (
    <motion.button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.88 }}
      whileHover={disabled ? undefined : { scale: 1.08 }}
      transition={{ type: "spring", stiffness: 600, damping: 28 }}
      className={cn(
        "inline-flex items-center justify-center h-8 w-8 rounded-[var(--radius-sm)] transition disabled:opacity-40 disabled:cursor-not-allowed",
        v,
      )}
    >
      {children}
    </motion.button>
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
