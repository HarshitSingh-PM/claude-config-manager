"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  Sparkles,
  Download,
  RotateCcw,
  ChevronDown,
  Rocket,
  Code2,
  Layers,
  Award,
  Workflow,
} from "lucide-react";
import { Card, TextInput, Textarea, Toggle, Select } from "../primitives";
import { InfoIcon } from "../Tooltip";
import {
  type SaaSFormValues,
  DEFAULT_VALUES,
  assemblePrompt,
  promptStats,
} from "@/lib/saas/promptAssembler";
import {
  multiTenancy,
  frontend,
  apiStyle,
  backend,
  database,
  orm,
  auth,
  billing,
  hosting,
  email,
  storage,
  jobs,
  observability,
  featureFlags,
  analytics,
  unitTest,
  e2eTest,
  lint,
  packageManager,
  scaleTarget,
  features as featuresField,
  type Field,
  type Option,
} from "@/lib/saas/catalog";

export function SaaSPromptForm() {
  const [values, setValues] = useState<SaaSFormValues>(DEFAULT_VALUES);
  const [justCopied, setJustCopied] = useState(false);

  const prompt = useMemo(() => assemblePrompt(values), [values]);
  const stats = promptStats(prompt);

  const set = <K extends keyof SaaSFormValues>(key: K, v: SaaSFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const download = () => {
    const blob = new Blob([prompt], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${values.name.trim().toLowerCase().replace(/\s+/g, "-") || "saas-prompt"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    if (!confirm("Reset all fields to defaults?")) return;
    setValues(DEFAULT_VALUES);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
      {/* ─── LEFT — form sections ─────────────────────── */}
      <div className="space-y-4 min-w-0">
        <Section icon={<Rocket size={14} />} title="Product" defaultOpen>
          <Field2
            label="Product name"
            tooltip="Working name. Shows up as project + repo name in the generated plan."
          >
            <TextInput
              value={values.name}
              onChange={(v) => set("name", v)}
              placeholder="e.g. Pulse Analytics"
            />
          </Field2>
          <Field2
            label="Problem you're solving"
            tooltip="One sentence — what pain do users hire your product for?"
            significance="Without a tight problem statement, Claude builds CRUD and not a product."
          >
            <Textarea
              value={values.problem}
              onChange={(v) => set("problem", v)}
              rows={2}
              monospaced={false}
              placeholder="Marketing teams can't see which paid campaigns actually generated qualified pipeline."
            />
          </Field2>
          <Field2
            label="Ideal customer (ICP)"
            tooltip="Specific role + company size + sophistication. Concrete > generic."
            significance="Drives every UX choice — admin dashboards vs. consumer onboarding look completely different."
          >
            <TextInput
              value={values.icp}
              onChange={(v) => set("icp", v)}
              placeholder="B2B SaaS marketing managers at 20–200-person companies running 5+ paid channels."
            />
          </Field2>
          <Field2
            label="Value proposition"
            tooltip="The reason a user pays. One sentence."
          >
            <TextInput
              value={values.valueProp}
              onChange={(v) => set("valueProp", v)}
              placeholder="Attribute pipeline revenue back to specific ads in under 60 seconds."
            />
          </Field2>
          <SelectField
            field={scaleTarget}
            value={values.scaleTarget}
            onChange={(v) => set("scaleTarget", v)}
          />
          <Field2
            label="Out of scope (one per line)"
            tooltip="Hard rails — things Claude should NOT build. Pre-empts scope creep."
            significance="Without this Claude tends to add half-built dashboards, exports, or AI features. List them here to stop it."
          >
            <Textarea
              value={values.outOfScope}
              onChange={(v) => set("outOfScope", v)}
              rows={3}
              monospaced={false}
              placeholder={"Mobile app\nMulti-currency billing for v1\nSlack integration"}
            />
          </Field2>
        </Section>

        <Section icon={<Code2 size={14} />} title="Stack">
          <SelectField field={frontend} value={values.frontend} onChange={(v) => set("frontend", v)} />
          <SelectField field={apiStyle} value={values.apiStyle} onChange={(v) => set("apiStyle", v)} />
          <SelectField field={backend} value={values.backend} onChange={(v) => set("backend", v)} />
          <SelectField field={database} value={values.database} onChange={(v) => set("database", v)} />
          <SelectField field={multiTenancy} value={values.tenancy} onChange={(v) => set("tenancy", v)} />
          <SelectField field={orm} value={values.orm} onChange={(v) => set("orm", v)} />
          <SelectField field={auth} value={values.auth} onChange={(v) => set("auth", v)} />
          <SelectField field={billing} value={values.billing} onChange={(v) => set("billing", v)} />
          <SelectField field={hosting} value={values.hosting} onChange={(v) => set("hosting", v)} />
          <SelectField field={email} value={values.email} onChange={(v) => set("email", v)} />
          <SelectField field={storage} value={values.storage} onChange={(v) => set("storage", v)} />
          <SelectField field={jobs} value={values.jobs} onChange={(v) => set("jobs", v)} />
          <SelectField field={observability} value={values.observability} onChange={(v) => set("observability", v)} />
          <SelectField field={featureFlags} value={values.featureFlags} onChange={(v) => set("featureFlags", v)} />
          <SelectField field={analytics} value={values.analytics} onChange={(v) => set("analytics", v)} />
        </Section>

        <Section icon={<Layers size={14} />} title="Features to scaffold">
          <p className="text-[11px] text-[color:var(--fg-muted)] -mt-1 mb-2 leading-relaxed">
            Pick the slices you want included. Each one expands into specific scaffold work
            inside the generated plan.
          </p>
          <div className="space-y-1.5">
            {featuresField.options.map((opt) => {
              const checked = values.features.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    const next = checked
                      ? values.features.filter((x) => x !== opt.value)
                      : [...values.features, opt.value];
                    set("features", next);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-md border transition flex items-start gap-2.5 ${
                    checked
                      ? "border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]/40"
                      : "border-[color:var(--border)] hover:border-[color:var(--border-strong)]"
                  }`}
                >
                  <div
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                      checked
                        ? "bg-[color:var(--accent)] border-[color:var(--accent)]"
                        : "border-[color:var(--border-strong)]"
                    }`}
                  >
                    {checked && <Check size={11} className="text-black" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[color:var(--fg)] flex items-center gap-1.5">
                      {opt.label}
                      {opt.recommended && (
                        <span className="text-[9px] uppercase text-[color:var(--accent)] border border-[color:var(--accent)]/40 px-1 py-px rounded">
                          recommended
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-[color:var(--fg-muted)] mt-0.5 leading-snug">
                      {opt.tradeoff}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        <Section icon={<Award size={14} />} title="Quality bar">
          <Field2
            label="TypeScript strict"
            tooltip="If true, the prompt asks Claude to enable `strict: true` and `noUncheckedIndexedAccess`."
            significance="Strongly recommended. Catches a wide class of bugs at edit time."
          >
            <div className="flex items-center gap-3">
              <Toggle checked={values.tsStrict} onChange={(v) => set("tsStrict", v)} />
              <span className="text-xs text-[color:var(--fg-muted)]">
                {values.tsStrict ? "strict + noUncheckedIndexedAccess" : "non-strict"}
              </span>
            </div>
          </Field2>
          <Field2
            label="Test coverage target"
            tooltip="Concrete coverage goal Claude will aim for in lib/ tests."
          >
            <TextInput
              value={values.coverageTarget}
              onChange={(v) => set("coverageTarget", v)}
              placeholder="60% lines on lib/"
            />
          </Field2>
          <Field2 label="Commit style" tooltip="Format Claude uses for commit messages.">
            <Select
              value={values.commitStyle}
              onChange={(v) => set("commitStyle", v)}
              options={[
                { value: "Conventional Commits", label: "Conventional Commits" },
                { value: "plain English (imperative)", label: "Plain English" },
                { value: "Gitmoji", label: "Gitmoji" },
              ]}
            />
          </Field2>
          <Field2 label="Accessibility level" tooltip="WCAG conformance target.">
            <Select
              value={values.a11y}
              onChange={(v) => set("a11y", v)}
              options={[
                { value: "WCAG 2.2 AA", label: "WCAG 2.2 AA (recommended)" },
                { value: "WCAG 2.2 AAA", label: "WCAG 2.2 AAA (strict)" },
                { value: "no specific target", label: "(no target)" },
              ]}
            />
          </Field2>
          <Field2
            label="PR size cap"
            tooltip="Soft / hard limit Claude tries to stay under for any single PR."
          >
            <TextInput
              value={values.prSizeCap}
              onChange={(v) => set("prSizeCap", v)}
              placeholder="soft 400 lines, hard 800"
            />
          </Field2>
          <Field2 label="Lint / format" tooltip="Tooling Claude will configure.">
            <Select
              value={values.lint}
              onChange={(v) => set("lint", v)}
              options={lint.options.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field2>
          <Field2 label="Unit testing" tooltip="Framework for in-process tests.">
            <Select
              value={values.unitTest}
              onChange={(v) => set("unitTest", v)}
              options={unitTest.options.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field2>
          <Field2 label="E2E testing" tooltip="Browser-driven test framework.">
            <Select
              value={values.e2eTest}
              onChange={(v) => set("e2eTest", v)}
              options={e2eTest.options.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field2>
          <Field2 label="Package manager" tooltip="">
            <Select
              value={values.packageManager}
              onChange={(v) => set("packageManager", v)}
              options={packageManager.options.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field2>
        </Section>

        <Section icon={<Workflow size={14} />} title="Output contract">
          <Field2
            label="Plan first, then implement"
            tooltip="Claude will write a plan.md listing every file + commit it intends to create, and STOP for your approval before writing code."
            significance="Strongly recommended. Catches stack mismatches and scope creep before they cost tokens."
          >
            <div className="flex items-center gap-3">
              <Toggle checked={values.planFirst} onChange={(v) => set("planFirst", v)} />
              <span className="text-xs text-[color:var(--fg-muted)]">
                {values.planFirst ? "plan.md required before code" : "skip planning"}
              </span>
            </div>
          </Field2>
          <Field2
            label="One commit per vertical slice"
            tooltip="Each feature becomes its own atomic commit. Lint + tests must pass before the commit lands."
            significance="Makes review possible and lets you bisect if something breaks."
          >
            <div className="flex items-center gap-3">
              <Toggle
                checked={values.commitPerSlice}
                onChange={(v) => set("commitPerSlice", v)}
              />
              <span className="text-xs text-[color:var(--fg-muted)]">
                {values.commitPerSlice ? "atomic slice commits" : "free-form commits"}
              </span>
            </div>
          </Field2>
          <Field2
            label="Custom notes (free form)"
            tooltip="Anything not covered above. Compliance constraints, design system, target region, etc."
          >
            <Textarea
              value={values.customNotes}
              onChange={(v) => set("customNotes", v)}
              rows={4}
              monospaced={false}
              placeholder={"e.g.\n- Must support EU data residency (database in eu-west-1)\n- Use the design system at github.com/acme/design-tokens\n- No third-party analytics — privacy-first by mandate"}
            />
          </Field2>
        </Section>
      </div>

      {/* ─── RIGHT — sticky preview ───────────────────── */}
      <div className="space-y-3 xl:sticky xl:top-4 self-start min-w-0">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-[color:var(--accent)]" />
              <h3 className="text-sm font-medium">Assembled prompt</h3>
              <InfoIcon
                content="Real-time preview of the prompt Claude will receive. Copy it and paste into a fresh Claude Code session."
                significance="The structure (role → product → stack → rules → features → acceptance → output contract) is what makes Claude scaffold reliably."
              />
            </div>
            <div className="text-[10px] text-[color:var(--fg-faint)] font-mono">
              {stats.lines} lines · {stats.words} words · {stats.chars.toLocaleString()} chars
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={copy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 h-8 rounded-md bg-[color:var(--accent)] text-[color:var(--accent-ink)] font-medium hover:bg-[color:var(--accent-2)] transition"
            >
              {justCopied ? (
                <>
                  <Check size={13} /> Copied
                </>
              ) : (
                <>
                  <Copy size={13} /> Copy to clipboard
                </>
              )}
            </button>
            <button
              onClick={download}
              aria-label="Download as .md"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 h-8 rounded-md border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
              title="Download as .md"
            >
              <Download size={13} />
            </button>
            <button
              onClick={reset}
              aria-label="Reset to defaults"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 h-8 rounded-md border border-[color:var(--border)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
              title="Reset to defaults"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          <pre className="font-mono text-[11px] leading-relaxed bg-[#0d0d10] border border-[color:var(--border)] rounded-md p-3 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words text-[color:var(--fg)]">
            {prompt}
          </pre>
        </Card>

        <Card className="p-3">
          <p className="text-[11px] text-[color:var(--fg-muted)] leading-relaxed">
            <span className="text-[color:var(--accent)] font-medium">Workflow:</span> open
            an empty repo, run <code className="font-mono text-[10.5px]">claude</code>, paste
            this prompt. Claude will write a <code>plan.md</code> first. Review it, push back
            on anything that&apos;s off, then approve to start implementation.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Section wrapper with collapsible header
// ──────────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  defaultOpen,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <Card className="p-0 overflow-hidden">
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-[color:var(--bg-elev-2)]/40 transition"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-[color:var(--accent)]">{icon}</span>
          {title}
        </div>
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.15 }}>
          <ChevronDown size={14} className="text-[color:var(--fg-faint)]" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function Field2({
  label,
  tooltip,
  significance,
  children,
}: {
  label: string;
  tooltip: string;
  significance?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-xs font-medium text-[color:var(--fg)]">{label}</label>
        <InfoIcon content={tooltip} significance={significance} />
      </div>
      {children}
    </div>
  );
}

function SelectField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  const current = field.options.find((o) => o.value === value);
  return (
    <Field2 label={field.label} tooltip={field.description}>
      <Select
        value={value}
        onChange={onChange}
        options={field.options.map((o: Option) => ({
          value: o.value,
          label: o.recommended ? `${o.label} · recommended` : o.label,
        }))}
      />
      {current && (
        <p className="text-[10.5px] text-[color:var(--fg-muted)] mt-1.5 leading-snug">
          <span className="text-[color:var(--fg-faint)]">Tradeoff:</span> {current.tradeoff}
        </p>
      )}
    </Field2>
  );
}
