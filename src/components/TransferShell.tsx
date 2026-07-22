"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Download,
  Upload,
  Lock,
  ShieldCheck,
  FileDown,
  FolderSearch,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Loader2,
} from "lucide-react";
import { Card, SectionHeader, Textarea, Badge } from "./primitives";
import { cn } from "@/lib/utils";

interface CategoryPreview {
  key: string;
  label: string;
  hint: string;
  fileCount: number;
  totalBytes: number;
}

interface InspectFile {
  path: string;
  size: number;
  state: "new" | "changed" | "same";
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function PassInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="new-password"
      className="w-full bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md px-3 py-1.5 text-sm placeholder:text-[color:var(--fg-faint)] focus:border-[color:var(--accent)] transition"
    />
  );
}

function PrimaryButton({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-md bg-[color:var(--accent)] text-[color:var(--accent-ink)] font-medium hover:bg-[color:var(--accent-2)] transition disabled:opacity-40"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

const STATE_TONE: Record<InspectFile["state"], "success" | "warning" | "default"> = {
  new: "success",
  changed: "warning",
  same: "default",
};

export default function TransferShell() {
  // ------- export state -------
  const [cats, setCats] = useState<CategoryPreview[]>([]);
  const [include, setInclude] = useState<Record<string, boolean>>({});
  const [extraText, setExtraText] = useState("");
  const [extrasInfo, setExtrasInfo] = useState<{ count: number; bytes: number; skipped: { path: string; reason: string }[] } | null>(null);
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [exBusy, setExBusy] = useState(false);
  const [exMsg, setExMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const extraPaths = useMemo(
    () => extraText.split("\n").map((s) => s.trim()).filter(Boolean),
    [extraText],
  );

  const loadPreview = useCallback(async (paths: string[]) => {
    setPreviewBusy(true);
    try {
      const res = await fetch("/api/transfer/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, extraPaths: paths }),
      });
      const data = await res.json();
      if (res.ok) {
        setCats(data.categories || []);
        setInclude((prev) => {
          const next = { ...prev };
          for (const c of data.categories || []) {
            if (!(c.key in next)) next[c.key] = c.fileCount > 0;
          }
          return next;
        });
        setExtrasInfo({
          count: data.extras?.files?.length ?? 0,
          bytes: data.extras?.totalBytes ?? 0,
          skipped: data.extras?.skipped ?? [],
        });
      }
    } catch {
      /* server unreachable; the page-level error states cover this */
    } finally {
      setPreviewBusy(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPreview([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCount = cats.filter((c) => include[c.key]).reduce((a, c) => a + c.fileCount, 0);
  const selectedBytes = cats.filter((c) => include[c.key]).reduce((a, c) => a + c.totalBytes, 0);

  const doExport = useCallback(async () => {
    setExMsg(null);
    if (pass1.length < 8) {
      setExMsg({ ok: false, text: "Passphrase must be at least 8 characters." });
      return;
    }
    if (pass1 !== pass2) {
      setExMsg({ ok: false, text: "Passphrases don't match." });
      return;
    }
    setExBusy(true);
    try {
      const res = await fetch("/api/transfer/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: pass1, include, extraPaths }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setExMsg({ ok: false, text: err.error || `Export failed (${res.status}).` });
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      const name = m?.[1] || "claude-setup.ccsync";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      const count = res.headers.get("X-File-Count") || "?";
      setExMsg({ ok: true, text: `Encrypted bundle with ${count} files downloaded as ${name}. Move it to the other laptop however you like — it's sealed.` });
    } catch (err) {
      setExMsg({ ok: false, text: String(err) });
    } finally {
      setExBusy(false);
    }
  }, [pass1, pass2, include, extraPaths]);

  // ------- import state -------
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileB64, setFileB64] = useState<string | null>(null);
  const [imPass, setImPass] = useState("");
  const [imBusy, setImBusy] = useState(false);
  const [imMsg, setImMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inspect, setInspect] = useState<{ createdAt: string; hostname: string; files: InspectFile[] } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<{ restored: string[]; backedUp: string[]; backupDir: string | null; errors: { path: string; error: string }[] } | null>(null);

  const onFile = useCallback((f: File | null) => {
    setInspect(null);
    setApplied(null);
    setImMsg(null);
    if (!f) {
      setFileName(null);
      setFileB64(null);
      return;
    }
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      setFileB64(s.slice(s.indexOf(",") + 1));
    };
    reader.readAsDataURL(f);
  }, []);

  const doInspect = useCallback(async () => {
    if (!fileB64 || !imPass) return;
    setImBusy(true);
    setImMsg(null);
    setApplied(null);
    try {
      const res = await fetch("/api/transfer/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "inspect", passphrase: imPass, dataBase64: fileB64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImMsg({ ok: false, text: data.error || `Inspect failed (${res.status}).` });
        setInspect(null);
        return;
      }
      setInspect(data);
      setPicked(new Set((data.files as InspectFile[]).filter((f) => f.state !== "same").map((f) => f.path)));
    } catch (err) {
      setImMsg({ ok: false, text: String(err) });
    } finally {
      setImBusy(false);
    }
  }, [fileB64, imPass]);

  const doApply = useCallback(async () => {
    if (!fileB64 || !imPass || picked.size === 0) return;
    setImBusy(true);
    setImMsg(null);
    try {
      const res = await fetch("/api/transfer/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "apply", passphrase: imPass, dataBase64: fileB64, selectPaths: [...picked] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImMsg({ ok: false, text: data.error || `Restore failed (${res.status}).` });
        return;
      }
      setApplied(data);
      setImMsg({
        ok: data.errors.length === 0,
        text: data.errors.length === 0
          ? `Restored ${data.restored.length} files.${data.backupDir ? ` Overwritten originals were backed up first.` : ""}`
          : `Restored ${data.restored.length}, but ${data.errors.length} failed — see below.`,
      });
    } catch (err) {
      setImMsg({ ok: false, text: String(err) });
    } finally {
      setImBusy(false);
    }
  }, [fileB64, imPass, picked]);

  const togglePick = (p: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-9 space-y-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-[color:var(--accent-ink)] shadow-[0_4px_16px_var(--accent-glow)]">
          <ArrowLeftRight size={20} />
        </span>
        <div>
          <h2 className="t-h1">Transfer</h2>
          <p className="t-small text-[color:var(--fg-muted)] mt-0.5">
            Move your whole Claude setup to another machine in one encrypted file.
          </p>
        </div>
      </div>

      <Card variant="elevated" className="p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck size={16} className="text-[color:var(--success)] mt-0.5 shrink-0" />
          <div className="t-small text-[color:var(--fg-muted)] leading-relaxed space-y-1.5">
            <p>
              <span className="text-[color:var(--fg)]">How it works:</span> export creates a single{" "}
              <span className="font-mono">.ccsync</span> file sealed with AES-256-GCM (key derived from your
              passphrase with scrypt). MCP API keys and any .env files you add stay encrypted, so the file is safe to
              move over AirDrop, iCloud Drive, or a USB stick. On the other laptop, run{" "}
              <span className="font-mono">npx claude-config-ui</span>, open Transfer, and import it.
            </p>
            <p className="flex items-start gap-1.5">
              <KeyRound size={12} className="mt-0.5 shrink-0" />
              <span>
                Your Claude <em>login</em> is not in the bundle on purpose — the OAuth token is per-machine and
                refreshes. Just run <span className="font-mono">claude</span> and <span className="font-mono">/login</span>{" "}
                once on the other laptop; your subscription covers multiple machines.
              </span>
            </p>
          </div>
        </div>
      </Card>

      {/* ---------------- EXPORT ---------------- */}
      <Card className="p-4">
        <SectionHeader
          title={<span className="inline-flex items-center gap-1.5"><Download size={14} /> Export this Mac</span>}
          description="Pick what goes into the bundle. Counts are live from disk."
          right={
            <button
              onClick={() => void loadPreview(extraPaths)}
              className="inline-flex items-center gap-1 text-[11px] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
            >
              <RotateCw size={11} className={cn(previewBusy && "animate-spin")} /> Refresh counts
            </button>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {cats.map((c) => (
            <label
              key={c.key}
              className={cn(
                "flex items-start gap-2.5 rounded-md border px-3 py-2 cursor-pointer transition",
                include[c.key]
                  ? "border-[color:var(--accent)]/50 bg-[color:var(--accent-soft)]"
                  : "border-[color:var(--border)] hover:border-[color:var(--border-strong)]",
                c.fileCount === 0 && "opacity-50",
              )}
            >
              <input
                type="checkbox"
                checked={!!include[c.key]}
                onChange={(e) => setInclude((p) => ({ ...p, [c.key]: e.target.checked }))}
                className="mt-0.5 accent-[color:var(--accent)]"
              />
              <span className="min-w-0">
                <span className="block text-xs text-[color:var(--fg)] truncate">{c.label}</span>
                <span className="block text-[10.5px] text-[color:var(--fg-muted)] leading-snug">{c.hint}</span>
                <span className="block text-[10.5px] text-[color:var(--fg-faint)] mt-0.5">
                  {c.fileCount} files · {fmtBytes(c.totalBytes)}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-3">
          <p className="text-[11px] text-[color:var(--fg-muted)] mb-1 inline-flex items-center gap-1">
            <FolderSearch size={11} /> Extra files or folders (one per line, e.g. <span className="font-mono">~/Stock-screener/.env</span>)
          </p>
          <Textarea value={extraText} onChange={setExtraText} rows={3} placeholder={"~/projects/foo/.env\n~/ClaudeContext"} />
          {extrasInfo && (extrasInfo.count > 0 || extrasInfo.skipped.length > 0) ? (
            <p className="text-[10.5px] text-[color:var(--fg-faint)] mt-1">
              Extras: {extrasInfo.count} files · {fmtBytes(extrasInfo.bytes)}
              {extrasInfo.skipped.length > 0 ? ` · skipped ${extrasInfo.skipped.length}: ${extrasInfo.skipped.map((s) => `${s.path} (${s.reason})`).join("; ")}` : ""}
            </p>
          ) : null}
          {extraPaths.length > 0 ? (
            <button
              onClick={() => void loadPreview(extraPaths)}
              className="text-[10.5px] text-[color:var(--accent)] hover:underline mt-0.5"
            >
              Recount with extras
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <PassInput value={pass1} onChange={setPass1} placeholder="Passphrase (min 8 chars)" />
          <PassInput value={pass2} onChange={setPass2} placeholder="Repeat passphrase" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[color:var(--fg-muted)]">
            <Lock size={11} className="inline mr-1" />
            {selectedCount} files · {fmtBytes(selectedBytes)} selected
          </p>
          <PrimaryButton onClick={() => void doExport()} busy={exBusy} disabled={selectedCount === 0 && extraPaths.length === 0}>
            <FileDown size={13} /> Export encrypted bundle
          </PrimaryButton>
        </div>
        {exMsg ? (
          <p className={cn("mt-2 text-[11px] leading-relaxed", exMsg.ok ? "text-[color:var(--success)]" : "text-[color:var(--danger)]")}>
            {exMsg.ok ? <CheckCircle2 size={11} className="inline mr-1" /> : <AlertTriangle size={11} className="inline mr-1" />}
            {exMsg.text}
          </p>
        ) : null}
      </Card>

      {/* ---------------- IMPORT ---------------- */}
      <Card className="p-4">
        <SectionHeader
          title={<span className="inline-flex items-center gap-1.5"><Upload size={14} /> Import a bundle</span>}
          description="On the other laptop: pick the .ccsync file, unlock it, review, then restore. Changed files are backed up before being overwritten."
        />
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <label className="flex items-center gap-2 text-xs bg-[color:var(--bg-elev-2)] border border-[color:var(--border)] rounded-md px-3 py-1.5 cursor-pointer hover:border-[color:var(--border-strong)] transition min-w-0">
            <Upload size={12} className="shrink-0 text-[color:var(--fg-muted)]" />
            <span className="truncate">{fileName || "Choose .ccsync file…"}</span>
            <input
              type="file"
              accept=".ccsync"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
          </label>
          <PassInput value={imPass} onChange={setImPass} placeholder="Bundle passphrase" />
          <PrimaryButton onClick={() => void doInspect()} busy={imBusy && !inspect} disabled={!fileB64 || !imPass}>
            Unlock & preview
          </PrimaryButton>
        </div>

        {inspect ? (
          <div className="mt-3">
            <p className="text-[11px] text-[color:var(--fg-muted)] mb-2">
              From <span className="text-[color:var(--fg)]">{inspect.hostname}</span> ·{" "}
              {new Date(inspect.createdAt).toLocaleString()} · {inspect.files.length} files. New and changed files are
              pre-selected; identical ones are skipped.
            </p>
            <div className="max-h-72 overflow-y-auto rounded-md border border-[color:var(--border)] divide-y divide-[color:var(--border)]">
              {inspect.files.map((f) => (
                <label key={f.path} className="flex items-center gap-2.5 px-3 py-1.5 text-[11.5px] cursor-pointer hover:bg-[color:var(--bg-elev-2)] transition">
                  <input
                    type="checkbox"
                    checked={picked.has(f.path)}
                    onChange={() => togglePick(f.path)}
                    className="accent-[color:var(--accent)]"
                  />
                  <span className="font-mono truncate flex-1 min-w-0">{f.path}</span>
                  <span className="text-[color:var(--fg-faint)] shrink-0">{fmtBytes(f.size)}</span>
                  <Badge tone={STATE_TONE[f.state]}>{f.state}</Badge>
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-[color:var(--fg-muted)]">{picked.size} of {inspect.files.length} selected</p>
              <PrimaryButton onClick={() => void doApply()} busy={imBusy} disabled={picked.size === 0}>
                <CheckCircle2 size={13} /> Restore selected
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {imMsg ? (
          <p className={cn("mt-2 text-[11px] leading-relaxed", imMsg.ok ? "text-[color:var(--success)]" : "text-[color:var(--danger)]")}>
            {imMsg.ok ? <CheckCircle2 size={11} className="inline mr-1" /> : <AlertTriangle size={11} className="inline mr-1" />}
            {imMsg.text}
          </p>
        ) : null}
        {applied?.backupDir ? (
          <p className="mt-1 text-[10.5px] text-[color:var(--fg-faint)] font-mono">backups: {applied.backupDir}</p>
        ) : null}
        {applied && applied.errors.length > 0 ? (
          <div className="mt-1 text-[10.5px] text-[color:var(--danger)] font-mono space-y-0.5">
            {applied.errors.map((e) => (
              <p key={e.path}>{e.path}: {e.error}</p>
            ))}
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <SectionHeader
          title="Project secrets tip"
          description={
            <>
              For .env files across many repos, add them one per line under &ldquo;Extra files&rdquo; above — they ride
              along encrypted. For team-shared secrets, a real secrets manager (1Password, Bitwarden, or SOPS in a
              private repo) is still the better long-term home; this bundle is for moving <em>your</em> machine setup.
            </>
          }
        />
      </Card>
    </div>
  );
}
