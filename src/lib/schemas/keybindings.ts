import type { Schema } from "./types";

export const keybindingsSchema: Schema = {
  id: "keybindings",
  title: "keybindings.json",
  description:
    "Per-context keyboard shortcuts. Each binding maps a keystroke to an action — or to null to unbind.",
  format: "json",
  fields: [
    {
      type: "kv",
      key: "Chat",
      label: "Chat bindings",
      tooltip:
        "Active inside the chat input. Common: chat:externalEditor, chat:modelPicker, chat:fastMode, chat:thinkingToggle, chat:cycleMode.",
      keyPlaceholder: "ctrl+e",
      valuePlaceholder: "chat:externalEditor",
    },
    {
      type: "kv",
      key: "Global",
      label: "Global bindings",
      tooltip:
        "App-wide. Common: app:interrupt, app:exit, app:toggleTodos, app:toggleTranscript.",
      keyPlaceholder: "ctrl+t",
      valuePlaceholder: "app:toggleTodos",
    },
    {
      type: "kv",
      key: "Confirmation",
      label: "Confirmation bindings",
      tooltip: "Active inside permission/confirm dialogs.",
      keyPlaceholder: "y",
      valuePlaceholder: "confirm:yes",
    },
  ],
};
