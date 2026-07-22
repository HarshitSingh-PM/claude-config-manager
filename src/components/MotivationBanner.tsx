"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

// A quick jolt of momentum shown when the app comes into view — on first open
// and each time the window is restored from minimized (via the Page Visibility
// API, which flips to "hidden" on minimize and back to "visible" on restore).
const LINES = [
  "Ship it. You can refactor tomorrow.",
  "Every bug you fix is a lesson you keep.",
  "Small commits, steady progress.",
  "The best code is the code that ships.",
  "You've solved harder problems than this.",
  "Read the error. It's trying to help.",
  "Make it work, make it right, make it fast.",
  "Green tests, clear mind.",
  "Delete more than you add today.",
  "Future-you will thank present-you for that comment.",
  "One function at a time.",
  "Progress over perfection.",
  "The compiler is a harsh but fair mentor.",
  "Name it well and half the battle's won.",
  "Rubber-duck it — the answer's already in you.",
  "Great software is just relentless iteration.",
  "Curiosity compiles.",
  "Trust the process, verify the output.",
];

export function MotivationBanner() {
  const [line, setLine] = useState<string | null>(null);
  const lastShown = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    const now = Date.now();
    if (now - lastShown.current < 5000) return; // debounce rapid focus flips
    lastShown.current = now;
    setLine(LINES[Math.floor(Math.random() * LINES.length)]);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLine(null), 4600);
  }, []);

  useEffect(() => {
    show(); // first open
    const onVis = () => {
      if (document.visibilityState === "visible") show();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [show]);

  return (
    <AnimatePresence>
      {line && (
        <motion.div
          initial={{ opacity: 0, y: -18, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -18, x: "-50%" }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="fixed left-1/2 top-3 z-[60] flex items-center gap-2.5 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--bg-elev-3)]/90 px-4 py-2 shadow-[var(--shadow-lg)] backdrop-blur-md"
          role="status"
        >
          <motion.span
            initial={{ rotate: -20, scale: 0.7 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 14 }}
            className="text-[color:var(--accent)]"
          >
            <Sparkles size={15} />
          </motion.span>
          <span className="t-small font-medium text-[color:var(--fg)]">{line}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
