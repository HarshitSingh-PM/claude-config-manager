export type StatusLineTemplate = {
  id: string;
  title: string;
  source: string;
  description: string;
  widgets: string[];     // widget ids in render order
  separator: string;
  refreshInterval?: number;  // seconds
};

export const statusLineTemplates: StatusLineTemplate[] = [
  {
    id: "minimal",
    title: "Minimal",
    source: "built-in",
    description: "Model, context %, session cost. Three values, low noise.",
    widgets: ["model", "context-percent", "session-cost"],
    separator: " · ",
  },
  {
    id: "productivity",
    title: "Productivity",
    source: "ccstatusline-style",
    description: "Visual context bar, cost, duration, current dir, git branch + dirty state.",
    widgets: [
      "model",
      "context-bar",
      "session-cost",
      "session-duration",
      "cwd",
      "git-branch",
      "git-dirty",
    ],
    separator: " │ ",
  },
  {
    id: "ccusage",
    title: "Cost-conscious (ccusage)",
    source: "ccusage statusline pattern",
    description: "Session cost + daily total + active 5h block + burn rate. Needs `ccusage` installed.",
    widgets: [
      "model",
      "session-cost",
      "daily-cost",
      "block-cost",
      "burn-rate",
      "context-percent",
    ],
    separator: " │ ",
  },
  {
    id: "quota",
    title: "Quota watcher",
    source: "claude-powerline / leeguooooo patterns",
    description: "Pro/Max users: track your 5-hour and 7-day quotas alongside model + context.",
    widgets: [
      "model",
      "context-bar",
      "5h-bar",
      "7d-bar",
      "session-cost",
    ],
    separator: " │ ",
  },
  {
    id: "kitchen-sink",
    title: "Kitchen sink",
    source: "built-in",
    description: "Everything useful, in one line. Will get long on narrow terminals.",
    widgets: [
      "model",
      "version",
      "context-bar",
      "session-cost",
      "session-duration",
      "lines-changed",
      "cwd",
      "git-branch",
      "git-dirty",
      "git-ahead-behind",
      "output-style",
      "time",
    ],
    separator: " │ ",
    refreshInterval: 5,
  },
];
