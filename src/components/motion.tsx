"use client";
// Shared animation vocabulary for the whole app. One place so every view
// fades, staggers, lifts, and counts the same way. All of it honours
// prefers-reduced-motion (AppShell wraps the tree in <MotionConfig
// reducedMotion="user">, and the imperative helpers below check it too).
import {
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
  animate,
  type Variants,
  type Transition,
  type HTMLMotionProps,
} from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── shared timing presets ──────────────────────────────────────────
export const SPRING: Transition = { type: "spring", stiffness: 500, damping: 35 };
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 600, damping: 40 };
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 260, damping: 26 };
export const EASE_OUT: Transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

// Spread onto any motion element for consistent tactile feedback.
export const PRESS = { whileTap: { scale: 0.96 } } as const;
export const LIFT = {
  whileHover: { y: -3 },
  whileTap: { scale: 0.985 },
  transition: SPRING,
} as const;

// ─── entrance variants (parent staggers, child fades up) ────────────
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: EASE_OUT },
};

export function staggerParent(stagger = 0.05, delayChildren = 0.02): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  };
}

// A self-contained stagger container — children should be <StaggerItem>.
export function Stagger({
  children,
  className,
  stagger = 0.05,
  delayChildren = 0.02,
  ...rest
}: { children: ReactNode; className?: string; stagger?: number; delayChildren?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={staggerParent(stagger, delayChildren)}
      initial="hidden"
      animate="show"
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & HTMLMotionProps<"div">) {
  return (
    <motion.div variants={fadeUp} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

// One-shot fade-up on mount, with an optional delay. For headers/sections
// that aren't part of a stagger group.
export function Reveal({
  children,
  className,
  delay = 0,
  y = 8,
  ...rest
}: { children: ReactNode; className?: string; delay?: number; y?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...EASE_OUT, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ─── count-up number ────────────────────────────────────────────────
// Animates from the previous value to the new one. Render numeric KPIs
// with this; compose units/suffixes around it (e.g. <AnimatedNumber/> MB).
export function AnimatedNumber({
  value,
  duration = 0.9,
  decimals = 0,
  format,
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => {
    const n = decimals > 0 ? Number(v.toFixed(decimals)) : Math.round(v);
    return format ? format(n) : n.toLocaleString();
  });
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, duration, reduce, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

// ─── skeleton shimmer ───────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "block rounded-md bg-[color:var(--bg-elev-2)] animate-[ccm-shimmer_1.5s_ease-in-out_infinite] bg-[length:200%_100%]",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--bg-elev-2) 0%, var(--border) 40%, var(--bg-elev-2) 80%)",
      }}
    />
  );
}

// A soft pulsing dot to mark "live"/active state — green by default.
export function LivePulse({ className, color = "var(--success)" }: { className?: string; color?: string }) {
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)}>
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
        style={{ backgroundColor: color }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}
