import yaml from "js-yaml";

export type FrontmatterDoc = {
  fm: Record<string, unknown>;
  body: string;
};

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(input: string): FrontmatterDoc {
  if (!input) return { fm: {}, body: "" };
  const m = input.match(FM_RE);
  if (!m) return { fm: {}, body: input };
  try {
    const fm = yaml.load(m[1]);
    if (fm && typeof fm === "object" && !Array.isArray(fm)) {
      return { fm: fm as Record<string, unknown>, body: m[2] ?? "" };
    }
  } catch {
    /* ignore — fall through */
  }
  return { fm: {}, body: input };
}

export function stringifyFrontmatter(doc: FrontmatterDoc): string {
  const entries = Object.entries(doc.fm).filter(([, v]) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
  if (entries.length === 0) return doc.body;
  const fmYaml = yaml
    .dump(Object.fromEntries(entries), { lineWidth: 120, noRefs: true })
    .trimEnd();
  return `---\n${fmYaml}\n---\n\n${doc.body.replace(/^\n+/, "")}`;
}
