"use client";
import { useEffect, useState } from "react";
import { Tooltip } from "./Tooltip";

type Info = { covered: string; installed: string | null };

const cmp = (a: string, b: string) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
};

/** Header chip: Claude Code version this app's schemas cover vs. what's installed. */
export function VersionBadge() {
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    fetch("/api/claude-version")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);
  if (!info) return null;
  const newer = info.installed && cmp(info.installed, info.covered) > 0;
  const tone = newer ? "var(--warning)" : "var(--success)";
  return (
    <Tooltip
      content={
        info.installed
          ? newer
            ? `Your Claude Code (${info.installed}) is newer than the config coverage in this app (${info.covered}). Newer keys still round-trip untouched; update Claude Config to edit them with forms.`
            : `Config forms cover Claude Code ${info.covered}. Installed: ${info.installed}.`
          : `Config forms cover Claude Code ${info.covered}. The claude CLI was not found on PATH.`
      }
    >
      <span
        className="hidden xl:inline-flex items-center gap-1.5 t-label font-mono px-2 py-1 rounded-md border"
        style={{ color: tone, borderColor: `color-mix(in srgb, ${tone} 35%, transparent)`, background: `color-mix(in srgb, ${tone} 9%, transparent)` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
        Claude Code {info.installed ?? info.covered}
      </span>
    </Tooltip>
  );
}
