import type { Schema } from "./types";

export const claudeMdSchema: Schema = {
  id: "claudemd",
  title: "CLAUDE.md",
  description:
    "Markdown memory file. Use @path/to/file to import other files (max depth 5). Pick a preset on the right to start.",
  format: "markdown",
  fields: [
    {
      type: "string",
      key: "_body",
      label: "Content",
      tooltip:
        "Plain markdown. Community wisdom: keep under 200 lines. Lead with WHY, then WHAT/HOW. Don't use this as a linter — that's hooks' job.",
      multiline: true,
      rows: 28,
      placeholder:
        "# Project notes\n\nStack: ...\n\nConventions:\n- ...",
    },
  ],
};
