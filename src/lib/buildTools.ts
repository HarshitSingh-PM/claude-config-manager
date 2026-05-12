import type { ReactNode } from "react";

export type BuildTool = {
  id: string;
  label: string;
  description: string;
  // Hint for the icon component — resolved in the component layer.
  iconKey: "rocket" | "package" | "globe" | "terminal";
  status: "ready" | "soon";
};

export const buildTools: BuildTool[] = [
  {
    id: "saas",
    label: "SaaS tool development",
    description:
      "Assemble a Claude Code prompt that scaffolds a SaaS product with multi-tenancy, auth, billing, and best practices baked in.",
    iconKey: "rocket",
    status: "ready",
  },
  // Slots for future tools — show as disabled in the sidebar so people know
  // more is coming and can vote with stars/issues for what to build first.
  {
    id: "browser-ext",
    label: "Browser extension",
    description: "MV3 extension scaffold with content script, background worker, and options page.",
    iconKey: "globe",
    status: "soon",
  },
  {
    id: "cli",
    label: "CLI tool",
    description: "Command-line tool scaffold with arg parsing, config files, and shell completions.",
    iconKey: "terminal",
    status: "soon",
  },
  {
    id: "npm-lib",
    label: "npm library",
    description: "Library scaffold with dual ESM/CJS build, types, and tested public API.",
    iconKey: "package",
    status: "soon",
  },
];

// Used as the "section icon" — Build is distinct from the config tabs.
export type ReactNodeLike = ReactNode;
