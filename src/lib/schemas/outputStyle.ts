import type { Schema } from "./types";

export const outputStyleSchema: Schema = {
  id: "outputStyle",
  title: "Output style",
  description: "One file under output-styles/. Frontmatter + body. Changes Claude's tone.",
  format: "markdown",
  fields: [
    {
      type: "string",
      key: "name",
      label: "Name",
      tooltip: "Shown in the /config style picker.",
      placeholder: "terse",
    },
    {
      type: "string",
      key: "description",
      label: "Description",
      tooltip: "Shown when selecting style.",
      placeholder: "Minimal responses, no extra explanation.",
    },
    {
      type: "boolean",
      key: "keep-coding-instructions",
      label: "Keep coding instructions",
      tooltip:
        "If true, your text is appended to the default system prompt. If false, it replaces it entirely.",
      default: true,
    },
    {
      type: "string",
      key: "_body",
      label: "Body",
      tooltip: "What Claude should do with its response.",
      multiline: true,
      rows: 12,
      placeholder: "Respond tersely. State the result, then stop.",
    },
  ],
};
