"use client";
import type { Field } from "@/lib/schemas/types";
import { getDeep, setDeep } from "@/lib/utils";
import { InfoIcon } from "./Tooltip";
import {
  NumberInput,
  Select,
  TextInput,
  Textarea,
  Toggle,
} from "./primitives";
import { ListInput } from "./ListInput";
import { KVInput } from "./KVInput";
import { motion } from "framer-motion";

export function FieldRenderer({
  field,
  values,
  onChange,
}: {
  field: Field;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  if (field.hidden && field.hidden(values)) return null;

  if (field.type === "group") {
    return (
      <fieldset className="border border-[color:var(--border)] rounded-lg p-4 bg-[color:var(--bg-elev)]/40">
        <legend className="px-2 text-xs font-medium tracking-wide uppercase text-[color:var(--fg-muted)]">
          <span className="inline-flex items-center gap-1.5">
            {field.label}
            <InfoIcon content={field.tooltip} significance={field.significance} />
          </span>
        </legend>
        <div className="space-y-4">
          {field.fields.map((f) => (
            <FieldRenderer key={f.key} field={f} values={values} onChange={onChange} />
          ))}
        </div>
      </fieldset>
    );
  }

  const current = getDeep(values, field.key);
  const update = (v: unknown) => onChange(setDeep(values, field.key, v));

  const label = (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="text-xs font-medium text-[color:var(--fg)]">{field.label}</label>
      <InfoIcon content={field.tooltip} significance={field.significance} />
    </div>
  );

  const wrap = (input: React.ReactNode) => (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      {label}
      {input}
    </motion.div>
  );

  switch (field.type) {
    case "string": {
      const v = (current as string | undefined) ?? "";
      if (field.multiline) {
        return wrap(
          <Textarea
            value={v}
            onChange={update}
            placeholder={field.placeholder}
            rows={field.rows ?? 6}
          />,
        );
      }
      return wrap(
        <TextInput value={v} onChange={update} placeholder={field.placeholder} monospaced />,
      );
    }
    case "number": {
      return wrap(
        <NumberInput
          value={current as number | undefined}
          onChange={update}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
        />,
      );
    }
    case "boolean": {
      const v = Boolean(current);
      return (
        <motion.div
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="flex items-start justify-between gap-3 py-1"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[color:var(--fg)]">{field.label}</span>
            <InfoIcon content={field.tooltip} significance={field.significance} />
          </div>
          <Toggle checked={v} onChange={update} />
        </motion.div>
      );
    }
    case "select": {
      return wrap(
        <Select value={(current as string | undefined) ?? ""} onChange={update} options={field.options} />,
      );
    }
    case "list": {
      return wrap(
        <ListInput
          values={(current as string[] | undefined) ?? []}
          onChange={(next) => update(next.length ? next : undefined)}
          placeholder={field.itemPlaceholder}
          suggestions={field.suggestions}
        />,
      );
    }
    case "kv": {
      return wrap(
        <KVInput
          values={(current as Record<string, string> | undefined) ?? {}}
          onChange={(next) => update(Object.keys(next).length ? next : undefined)}
          keyPlaceholder={field.keyPlaceholder}
          valuePlaceholder={field.valuePlaceholder}
        />,
      );
    }
  }
}
