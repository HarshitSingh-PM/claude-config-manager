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
    {
      type: "kv",
      key: "Autocomplete",
      label: "Autocomplete bindings",
      tooltip: "Active while the @-file / slash-command autocomplete popup is open.",
      keyPlaceholder: "tab",
      valuePlaceholder: "autocomplete:accept",
    },
    {
      type: "kv",
      key: "Transcript",
      label: "Transcript bindings",
      tooltip: "Active in the transcript view (ctrl+o).",
      keyPlaceholder: "j",
      valuePlaceholder: "scroll:down",
    },
    {
      type: "kv",
      key: "Tabs",
      label: "Tab bindings",
      tooltip: "Active when switching between session tabs.",
      keyPlaceholder: "ctrl+tab",
      valuePlaceholder: "tabs:next",
    },
    {
      type: "kv",
      key: "HistorySearch",
      label: "History search bindings",
      tooltip: "Active inside reverse history search (ctrl+r).",
      keyPlaceholder: "ctrl+r",
      valuePlaceholder: "historySearch:cycle",
    },
    {
      type: "kv",
      key: "DiffDialog",
      label: "Diff dialog bindings",
      tooltip: "Active while reviewing a diff.",
      keyPlaceholder: "n",
      valuePlaceholder: "diff:nextFile",
    },
    {
      type: "kv",
      key: "ModelPicker",
      label: "Model picker bindings",
      tooltip: "Active inside the model picker dialog.",
      keyPlaceholder: "enter",
      valuePlaceholder: "select:accept",
    },
  ],
};
