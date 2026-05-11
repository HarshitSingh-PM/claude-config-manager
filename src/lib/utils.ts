import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function setDeep(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  if (!path.includes(".")) {
    if (value === undefined || value === "" || value === null) {
      const next = { ...obj };
      delete next[path];
      return next;
    }
    return { ...obj, [path]: value };
  }
  const [head, ...rest] = path.split(".");
  const child = (obj[head] as Record<string, unknown> | undefined) ?? {};
  return { ...obj, [head]: setDeep(child, rest.join("."), value) };
}

export function getDeep(obj: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return obj[path];
  const [head, ...rest] = path.split(".");
  const child = obj[head] as Record<string, unknown> | undefined;
  if (!child) return undefined;
  return getDeep(child, rest.join("."));
}

export function deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...target };
  for (const k of Object.keys(source)) {
    const sv = source[k];
    const tv = out[k];
    if (
      sv &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      out[k] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else if (Array.isArray(sv) && Array.isArray(tv)) {
      const set = new Set([...(tv as unknown[]), ...sv]);
      out[k] = Array.from(set);
    } else {
      out[k] = sv;
    }
  }
  return out as T;
}

export function safeParseJson(s: string): Record<string, unknown> {
  try {
    if (!s.trim()) return {};
    const v = JSON.parse(s);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

export function stringifyConfig(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2) + "\n";
}
