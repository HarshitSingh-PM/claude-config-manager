"use client";
import { Card } from "../primitives";
import { KVInput } from "../KVInput";
import { InfoIcon } from "../Tooltip";

type Binding = { context: string; bindings: Record<string, string> };

function fromObject(obj: Record<string, unknown>): Binding[] {
  const arr = (obj.bindings as Array<{ context: string; bindings: Record<string, string> }> | undefined) ?? [];
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

const contexts = [
  {
    name: "Chat",
    tooltip:
      "Active inside the chat input. Common actions: chat:externalEditor, chat:modelPicker, chat:fastMode, chat:thinkingToggle, chat:cycleMode.",
  },
  {
    name: "Global",
    tooltip: "Active app-wide. Common: app:interrupt, app:exit, app:toggleTodos, app:toggleTranscript.",
  },
  {
    name: "Confirmation",
    tooltip: "Active inside permission/confirm dialogs.",
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
  const byCtx: Record<string, Record<string, string>> = {};
  for (const b of bindings) byCtx[b.context] = b.bindings;

  const updateCtx = (context: string, next: Record<string, string>) => {
    const others = bindings.filter((b) => b.context !== context);
    const merged: Binding[] = [...others, { context, bindings: next }];
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
            keyPlaceholder="ctrl+e"
            valuePlaceholder="chat:externalEditor"
          />
        </fieldset>
      ))}
    </Card>
  );
}
