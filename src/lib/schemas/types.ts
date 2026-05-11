export type FieldBase = {
  key: string;
  label: string;
  tooltip: string;
  significance?: string;
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
};

export type FieldKV = FieldBase & {
  type: "kv";
  keyPlaceholder?: string;
  valuePlaceholder?: string;
};

export type FieldGroup = FieldBase & {
  type: "group";
  fields: Field[];
};

export type Field =
  | FieldString
  | FieldNumber
  | FieldBoolean
  | FieldSelect
  | FieldList
  | FieldKV
  | FieldGroup;

export type Schema = {
  id: string;
  title: string;
  description: string;
  format: "json" | "markdown";
  fields: Field[];
};
