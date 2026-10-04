"use client";
import { Card } from "../primitives";
import { KVInput } from "../KVInput";
import { InfoIcon } from "../Tooltip";

// A binding value is an action name, or null to unbind a default key.
type Binding = { context: string; bindings: Record<string, string | null> };

function fromObject(obj: Record<string, unknown>): Binding[] {
  const arr = (obj.bindings as Binding[] | undefined) ?? [];
  return arr.map((b) => ({ context: b.context, bindings: { ...b.bindings } }));
}

function toObject(bindings: Binding[]): Record<string, unknown> {
  return {
    $schema: "https://www.schemastore.org/claude-code-keybindings.json",
    bindings: bindings
      .filter((b) => Object.keys(b.bindings).length > 0)
      .map((b) => ({ context: b.context, bindings: b.bindings })),
  };
}

// Every keybinding context Claude Code recognises, with its common actions.
// Map a key to null (type `null`) to unbind a default.
const contexts = [
  {
    name: "Global",
    tooltip: "Applies everywhere in the app. Actions: app:interrupt, app:exit, app:redraw, app:toggleTodos, app:toggleTranscript, voice:pushToTalk.",
    keyPlaceholder: "ctrl+t",
    valuePlaceholder: "app:toggleTodos",
  },
  {
    name: "Chat",
    tooltip: "Main chat input area. Actions: chat:submit, chat:newline, chat:cancel, chat:cycleMode, chat:modelPicker, chat:fastMode, chat:thinkingToggle, chat:externalEditor, chat:stash, chat:undo, chat:imagePaste, chat:killAgents, chat:queueSubmit, chat:sendNow, chat:clearInput, chat:clearScreen.",
    keyPlaceholder: "ctrl+e",
    valuePlaceholder: "chat:externalEditor",
  },
  {
    name: "Autocomplete",
    tooltip: "The @-file / slash-command autocomplete menu is open. Actions: autocomplete:accept, autocomplete:dismiss, autocomplete:next, autocomplete:previous.",
    keyPlaceholder: "tab",
    valuePlaceholder: "autocomplete:accept",
  },
  {
    name: "Confirmation",
    tooltip: "Permission and confirmation dialogs. Actions: confirm:yes, confirm:no, confirm:next, confirm:previous, confirm:toggle, confirm:cycleMode, confirm:nextField, confirm:previousField.",
    keyPlaceholder: "y",
    valuePlaceholder: "confirm:yes",
  },
  {
    name: "Transcript",
    tooltip: "Transcript viewer (ctrl+o). Actions: transcript:exit, transcript:toggleShowAll.",
    keyPlaceholder: "q",
    valuePlaceholder: "transcript:exit",
  },
  {
    name: "HistorySearch",
    tooltip: "History search mode (ctrl+r). Actions: historySearch:accept, historySearch:cancel, historySearch:execute, historySearch:next, historySearch:cycleScope.",
    keyPlaceholder: "ctrl+r",
    valuePlaceholder: "historySearch:next",
  },
  {
    name: "Task",
    tooltip: "A task is running in the foreground. Actions: task:background.",
    keyPlaceholder: "ctrl+b",
    valuePlaceholder: "task:background",
  },
  {
    name: "Scroll",
    tooltip: "Conversation scrolling and text selection in fullscreen mode. Actions: scroll:lineUp, scroll:lineDown, scroll:pageUp, scroll:pageDown, scroll:halfPageUp, scroll:halfPageDown, scroll:top, scroll:bottom, selection:copy, selection:clear.",
    keyPlaceholder: "pageup",
    valuePlaceholder: "scroll:pageUp",
  },
  {
    name: "Agents",
    tooltip: "Agent view (`claude agents`). Actions: agents:find, agents:nextGroup, agents:previousGroup, agents:rename, agents:switchView, agents:togglePin.",
    keyPlaceholder: "r",
    valuePlaceholder: "agents:rename",
  },
  {
    name: "Footer",
    tooltip: "Footer indicator navigation (tasks, teams, diff, artifacts). Actions: footer:next, footer:previous, footer:up, footer:down, footer:openSelected, footer:dismiss, footer:clearSelection.",
    keyPlaceholder: "enter",
    valuePlaceholder: "footer:openSelected",
  },
  {
    name: "ModelPicker",
    tooltip: "Model picker effort level. Actions: modelPicker:increaseEffort, modelPicker:decreaseEffort, modelPicker:thisSessionOnly.",
    keyPlaceholder: "right",
    valuePlaceholder: "modelPicker:increaseEffort",
  },
  {
    name: "EffortSlider",
    tooltip: "Effort slider opened by /effort. Actions: effortSlider:increaseEffort, effortSlider:decreaseEffort, effortSlider:thisSessionOnly, effortSlider:toggleUltracode.",
    keyPlaceholder: "right",
    valuePlaceholder: "effortSlider:increaseEffort",
  },
  {
    name: "DiffDialog",
    tooltip: "Diff viewer navigation. Actions: diff:nextFile, diff:previousFile, diff:nextSource, diff:previousSource, diff:viewDetails, diff:back, diff:dismiss.",
    keyPlaceholder: "n",
    valuePlaceholder: "diff:nextFile",
  },
  {
    name: "DiffPanel",
    tooltip: "The diff panel is open. Actions: app:cycleDiffBase, app:diffFileListUp, app:diffFileListDown, app:toggleDiffNoiseFilter, app:toggleDiffPreSession.",
    keyPlaceholder: "b",
    valuePlaceholder: "app:cycleDiffBase",
  },
  {
    name: "MessageSelector",
    tooltip: "Rewind and summarize dialog message selection. Actions: messageSelector:up, messageSelector:down, messageSelector:top, messageSelector:bottom, messageSelector:select.",
    keyPlaceholder: "k",
    valuePlaceholder: "messageSelector:up",
  },
  {
    name: "Select",
    tooltip: "Generic select/list components. Actions: select:next, select:previous, select:accept, select:cancel, select:first, select:last, select:pageUp, select:pageDown.",
    keyPlaceholder: "j",
    valuePlaceholder: "select:next",
  },
  {
    name: "Tabs",
    tooltip: "Tab navigation components. Actions: tabs:next, tabs:previous.",
    keyPlaceholder: "ctrl+tab",
    valuePlaceholder: "tabs:next",
  },
  {
    name: "Attachments",
    tooltip: "Image attachment navigation in select dialogs. Actions: attachments:next, attachments:previous, attachments:remove, attachments:exit.",
    keyPlaceholder: "x",
    valuePlaceholder: "attachments:remove",
  },
  {
    name: "Settings",
    tooltip: "Settings menu. Actions: settings:search, settings:retry.",
    keyPlaceholder: "/",
    valuePlaceholder: "settings:search",
  },
  {
    name: "Help",
    tooltip: "Help menu is visible. Actions: help:dismiss.",
    keyPlaceholder: "q",
    valuePlaceholder: "help:dismiss",
  },
  {
    name: "ThemePicker",
    tooltip: "Theme picker dialog. Actions: theme:toggleSyntaxHighlighting.",
    keyPlaceholder: "s",
    valuePlaceholder: "theme:toggleSyntaxHighlighting",
  },
  {
    name: "Plugin",
    tooltip: "Plugin dialog (browse, discover, manage). Actions: plugin:install, plugin:toggle, plugin:favorite.",
    keyPlaceholder: "i",
    valuePlaceholder: "plugin:install",
  },
  {
    name: "Pane",
    tooltip: "A pane drawn by a mod has keyboard focus. Actions: Keys your mod receives while its pane is focused.",
    keyPlaceholder: "esc",
    valuePlaceholder: "…",
  },
  {
    name: "PaneField",
    tooltip: "An input field or select in a mod pane has keyboard focus. Actions: Keys your mod receives while a field is focused.",
    keyPlaceholder: "esc",
    valuePlaceholder: "…",
  },
];

export function KeybindingsForm({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const bindings = fromObject(values);
  // null (unbind) is shown and typed as the literal text "null".
  const byCtx: Record<string, Record<string, string>> = {};
  for (const b of bindings) {
    byCtx[b.context] = Object.fromEntries(
      Object.entries(b.bindings).map(([k, v]) => [k, v === null ? "null" : String(v)]),
    );
  }

  const updateCtx = (context: string, next: Record<string, string>) => {
    const others = bindings.filter((b) => b.context !== context);
    const stored = Object.fromEntries(
      Object.entries(next).map(([k, v]) => [k, v.trim() === "null" ? null : v]),
    );
    const merged: Binding[] = [...others, { context, bindings: stored }];
    onChange(toObject(merged));
  };

  return (
    <Card className="p-5 space-y-5">
      {contexts.map((ctx) => (
        <fieldset
          key={ctx.name}
          className="border border-[color:var(--border)] rounded-lg p-4 bg-[color:var(--bg-elev)]/40"
        >
          <legend className="px-2 text-xs font-medium tracking-wide uppercase text-[color:var(--fg-muted)] inline-flex items-center gap-1.5">
            {ctx.name}
            <InfoIcon content={ctx.tooltip} />
          </legend>
          <KVInput
            values={byCtx[ctx.name] ?? {}}
            onChange={(next) => updateCtx(ctx.name, next)}
            keyPlaceholder={ctx.keyPlaceholder}
            valuePlaceholder={ctx.valuePlaceholder}
          />
        </fieldset>
      ))}
    </Card>
  );
}
