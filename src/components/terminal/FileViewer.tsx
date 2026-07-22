"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  Save,
  Eye,
  Pencil,
  FileText,
  FileType2,
  FileCode2,
  Image as ImageIcon,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";

type Kind = "markdown" | "html" | "pdf" | "image" | "text" | "unsupported";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"]);
const TEXT_EXT = new Set([
  ".txt", ".json", ".jsonc", ".yaml", ".yml", ".toml", ".ini", ".env", ".sh",
  ".js", ".ts", ".tsx", ".jsx", ".py", ".rb", ".go", ".rs", ".c", ".h", ".css",
  ".xml", ".log", ".csv", ".conf",
]);

function kindOf(path: string): Kind {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot).toLowerCase();
  if (ext === ".md" || ext === ".markdown" || ext === ".mdx") return "markdown";
  if (ext === ".html" || ext === ".htm") return "html";
  if (ext === ".pdf") return "pdf";
  if (IMAGE_EXT.has(ext)) return "image";
  if (TEXT_EXT.has(ext)) return "text";
  return "unsupported";
}

export function FileViewer({
  path,
  onClose,
  onToast,
}: {
  path: string;
  onClose: () => void;
  onToast?: (kind: "ok" | "err", msg: string) => void;
}) {
  const kind = useMemo(() => kindOf(path), [path]);
  const name = path.split("/").pop() || path;

  const [content, setContent] = useState<string>(""); // last-loaded (for dirty check)
  const [draft, setDraft] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [exists, setExists] = useState(true);

  const editable = kind === "markdown" || kind === "text" || kind === "html";
  const previewable = kind === "markdown" || kind === "html";
  const dirty = draft !== content;

  const load = useCallback(async () => {
    if (kind === "pdf" || kind === "image" || kind === "unsupported") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      const raw = (data.content as string | undefined) ?? "";
      setContent(raw);
      setDraft(raw);
      setExists(Boolean(data.exists));
    } catch (err) {
      onToast?.("err", `Could not read file: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [path, kind, onToast]);

  useEffect(() => {
    // Renderable files (md/html) open in preview; code opens in edit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(kind === "markdown" || kind === "html" ? "preview" : "edit");
    load();
  }, [load, kind]);

  const save = useCallback(async () => {
    if (!editable || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content: draft, backup: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast?.("err", data.error ?? "Save failed");
      } else {
        setContent(draft);
        setExists(true);
        onToast?.(
          "ok",
          data.backupPath ? `Saved ${name} (backup made)` : `Saved ${name}`,
        );
      }
    } catch (err) {
      onToast?.("err", String(err));
    } finally {
      setSaving(false);
    }
  }, [editable, dirty, path, draft, name, onToast]);

  // Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const KindIcon =
    kind === "pdf"
      ? FileType2
      : kind === "image"
        ? ImageIcon
        : kind === "html"
          ? FileCode2
          : FileText;

  return (
    <div className="absolute inset-0 z-20 flex flex-col rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elev)] shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-2">
        <KindIcon size={14} className="shrink-0 text-[color:var(--accent)]" />
        <span className="truncate text-xs font-medium" title={path}>
          {name}
        </span>
        {!exists && (
          <span className="rounded border border-[color:var(--fg-faint)]/40 px-1 text-[9px] uppercase text-[color:var(--fg-faint)]">
            new
          </span>
        )}
        {dirty && <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--warning)]" />}

        {previewable && (
          <div className="ml-2 inline-flex overflow-hidden rounded-md border border-[color:var(--border)]">
            <button
              onClick={() => setMode("preview")}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] ${
                mode === "preview"
                  ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                  : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
              }`}
            >
              <Eye size={11} /> Preview
            </button>
            <button
              onClick={() => setMode("edit")}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] ${
                mode === "edit"
                  ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                  : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
              }`}
            >
              <Pencil size={11} /> Edit
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {editable && (
            <>
              <button
                onClick={() => setDraft(content)}
                disabled={!dirty}
                className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--fg-muted)] transition hover:text-[color:var(--fg)] disabled:opacity-30"
              >
                <RotateCcw size={11} /> Revert
              </button>
              <button
                onClick={save}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-1 rounded-md bg-[color:var(--accent)] px-2.5 py-1 text-[11px] font-medium text-black transition hover:bg-[color:var(--accent-2)] disabled:opacity-30"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Save
              </button>
            </>
          )}
          <button
            onClick={onClose}
            title="Close"
            className="rounded-md p-1 text-[color:var(--fg-muted)] transition hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-[color:var(--fg-faint)]">
            <Loader2 size={14} className="mr-2 animate-spin" /> Loading…
          </div>
        ) : kind === "pdf" ? (
          <iframe
            title={name}
            src={`/api/file-raw?path=${encodeURIComponent(path)}`}
            className="h-full w-full bg-white"
          />
        ) : kind === "image" ? (
          <div className="flex h-full items-center justify-center overflow-auto bg-[color:var(--bg)] p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/file-raw?path=${encodeURIComponent(path)}`}
              alt={name}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : kind === "unsupported" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-[color:var(--fg-faint)]">
            <FileText size={22} />
            <div>Preview not available for this file type.</div>
            <div className="font-mono text-[10px]">{name}</div>
          </div>
        ) : mode === "preview" && kind === "markdown" ? (
          <div className="h-full overflow-auto px-6 py-5">
            <div
              className="md-body mx-auto max-w-3xl"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(draft) }}
            />
          </div>
        ) : mode === "preview" && kind === "html" ? (
          // Rendered in a sandboxed iframe (unique origin — scripts run but can't
          // reach the app). Self-contained pages (inline CSS/JS, data URIs) render
          // fully; pages referencing sibling files won't resolve their relatives.
          <iframe
            title={`${name} preview`}
            srcDoc={draft}
            sandbox="allow-scripts allow-popups allow-forms allow-modals"
            className="h-full w-full bg-white"
          />
        ) : (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="h-full w-full resize-none bg-[color:var(--bg)] px-4 py-3 font-mono text-[12.5px] leading-relaxed text-[color:var(--fg)] outline-none"
            placeholder="Empty file — start typing…"
          />
        )}
      </div>
    </div>
  );
}
