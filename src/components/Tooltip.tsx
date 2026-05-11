"use client";
import * as RT from "@radix-ui/react-tooltip";
import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

export function Tooltip({
  content,
  significance,
  children,
}: {
  content: ReactNode;
  significance?: ReactNode;
  children: ReactNode;
}) {
  return (
    <RT.Provider delayDuration={120}>
      <RT.Root>
        <RT.Trigger asChild>{children}</RT.Trigger>
        <RT.Portal>
          <RT.Content className="tt-content" sideOffset={6}>
            <div>{content}</div>
            {significance ? (
              <div className="mt-1.5 pt-1.5 border-t border-[color:var(--border-strong)] text-[color:var(--fg-muted)]">
                <span className="text-[color:var(--accent)] font-medium">Why it matters:</span>{" "}
                {significance}
              </div>
            ) : null}
            <RT.Arrow className="tt-arrow" />
          </RT.Content>
        </RT.Portal>
      </RT.Root>
    </RT.Provider>
  );
}

export function InfoIcon({
  content,
  significance,
}: {
  content: ReactNode;
  significance?: ReactNode;
}) {
  return (
    <Tooltip content={content} significance={significance}>
      <button
        type="button"
        aria-label="Help"
        className="inline-flex items-center text-[color:var(--fg-faint)] hover:text-[color:var(--accent)] transition"
      >
        <HelpCircle size={14} strokeWidth={1.75} />
      </button>
    </Tooltip>
  );
}
