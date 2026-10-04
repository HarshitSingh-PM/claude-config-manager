/** Where Claude Code honors a key. Rendered as a small chip next to the label. */
export type FieldScope = "user" | "managed";

export type FieldBase = {
  key: string;
  label: string;
  tooltip: string;
  significance?: string;
  /** Set when the key is ignored outside a particular settings source. */
  scope?: FieldScope;
  hidden?: (values: Record<string, unknown>) => boolean;
};

export type FieldString = FieldBase & {
  type: "string";
  placeholder?: string;
  default?: string;
  multiline?: boolean;
  rows?: number;
};

export type FieldNumber = FieldBase & {
  type: "number";
  default?: number;
  min?: number;
  max?: number;
  placeholder?: string;
};

export type FieldBoolean = FieldBase & {
  type: "boolean";
  /** What Claude Code does when the key is unset — shown as the toggle state. */
  default?: boolean;
};

export type FieldSelect = FieldBase & {
  type: "select";
  options: { value: string; label: string; description?: string }[];
  default?: string;
};

export type FieldList = FieldBase & {
  type: "list";
  itemPlaceholder?: string;
  default?: string[];
  suggestions?: string[];
  /** Items are stored as `{ [objectKey]: "value" }` objects instead of bare
   *  strings (e.g. allowedMcpServers → `{ "serverName": "github" }`). Entries
   *  of any other shape are preserved untouched. */
  objectKey?: string;
};

export type FieldKV = FieldBase & {
  type: "kv";
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** `boolean` stores true/false instead of strings (e.g. enabledPlugins). */
  valueType?: "string" | "boolean";
};

/** Free-form JSON value (object or array) for keys too structured for a form. */
export type FieldJson = FieldBase & {
  type: "json";
  placeholder?: string;
  rows?: number;
};

export type FieldGroup = FieldBase & {
  type: "group";
  fields: Field[];
  /** Start collapsed. Groups holding a set value always start open. */
  collapsed?: boolean;
};

export type Field =
  | FieldString
  | FieldNumber
  | FieldBoolean
  | FieldSelect
  | FieldList
  | FieldKV
  | FieldJson
  | FieldGroup;

export type Schema = {
  id: string;
  title: string;
  description: string;
  format: "json" | "markdown";
  fields: Field[];
};
