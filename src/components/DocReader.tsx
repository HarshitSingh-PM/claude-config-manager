"use client";
// Global drag-and-drop document reader. Drop a .md / .pdf (or plain-text) file
// from Finder anywhere onto the app — outside the terminal workspace, which
// keeps its own drag-to-shell behavior — and it opens in a full-screen reader.
// Files are read entirely client-side (FileReader / object URL), so anything
// on disk works, including files outside the home directory.
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, FileText, X } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";
import { CCM_PATH_MIME } from "./terminal/FileTree";

type Doc =
  | { kind: "markdown" | "text"; name: string; content: string }
  | { kind: "pdf"; name: string; url: string };

const MD_EXT = /\.(md|markdown|mdx)$/i;
const TXT_EXT = /\.(txt|log|json|jsonc|ya?ml|toml|ini|csv)$/i;
const PDF_EXT = /\.pdf$/i;

function isReadable(name: string): boolean {
  return MD_EXT.test(name) || TXT_EXT.test(name) || PDF_EXT.test(name);
}

/**
 * `fileDrops` gates OS-level (Finder) file drops and the full-screen overlay —
 * off on the terminal workspace, which has its own Finder-drop semantics.
 * In-app path drags (from the workspace file tree, `text/x-ccm-path`) are
 * handled on EVERY view: terminal panes stopPropagation on their own drops,
 * so a tree file dropped on the header or any non-pane surface opens here.
 */
export function GlobalDropReader({ fileDrops }: { fileDrops: boolean }) {
  const [dragging, setDragging] = useState(false);
  const [doc, setDoc] = useState<Doc | null>(null);
  // dragenter/dragleave fire for every nested element — track the depth so the
  // overlay only clears when the drag truly leaves the window.
  const depth = useRef(0);

  const close = useCallback(() => {
    setDoc((d) => {
      if (d?.kind === "pdf" && d.url.startsWith("blob:")) URL.revokeObjectURL(d.url);
      return null;
    });
  }, []);

  const setDocReleasing = useCallback((next: Doc) => {
    setDoc((prev) => {
      if (prev?.kind === "pdf" && prev.url.startsWith("blob:")) URL.revokeObjectURL(prev.url);
      return next;
    });
  }, []);

  // OS-level drop: the File object is readable directly, no server involved.
  const openFile = useCallback(
    (file: File) => {
      const name = file.name;
      if (PDF_EXT.test(name)) {
        setDocReleasing({ kind: "pdf", name, url: URL.createObjectURL(file) });
        return;
      }
      const kind: Doc["kind"] = MD_EXT.test(name) ? "markdown" : "text";
      const reader = new FileReader();
      reader.onload = () => setDoc({ kind, name, content: String(reader.result ?? "") });
      reader.readAsText(file);
    },
    [setDocReleasing],
  );

  // In-app tree drag: we only have an absolute path — fetch through the file
  // APIs (server enforces the home-directory boundary).
  const openPath = useCallback(
    async (p: string) => {
      const name = p.split("/").pop() || p;
      if (PDF_EXT.test(name)) {
        setDocReleasing({ kind: "pdf", name, url: `/api/file-raw?path=${encodeURIComponent(p)}` });
        return;
      }
      try {
        const res = await fetch(`/api/file?path=${encodeURIComponent(p)}`);
        const data = await res.json();
        if (!res.ok || data.error) {
          setDoc({ kind: "text", name, content: `Could not open this file:\n${data.error ?? res.statusText}` });
          return;
        }
        if (data.isDir) return; // folders aren't documents — ignore
        if (!data.exists) {
          setDoc({ kind: "text", name, content: "File not found." });
          return;
        }
        const kind: Doc["kind"] = MD_EXT.test(name) ? "markdown" : "text";
        setDoc({ kind, name, content: String(data.content ?? "") });
      } catch (err) {
        setDoc({ kind: "text", name, content: `Could not open this file:\n${String(err)}` });
      }
    },
    [setDocReleasing],
  );

  useEffect(() => {
    const types = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []);
    // OS file drags only where enabled; in-app path drags everywhere.
    const wantsFiles = (e: DragEvent) => fileDrops && types(e).includes("Files");
    const wantsPath = (e: DragEvent) => types(e).includes(CCM_PATH_MIME);
    const wanted = (e: DragEvent) => wantsFiles(e) || wantsPath(e);

    const onDragEnter = (e: DragEvent) => {
      if (!wanted(e)) return;
      depth.current++;
      // The overlay only where OS drops are enabled (i.e. not the terminal
      // workspace — its panes have their own drop highlights).
      if (fileDrops) setDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!wanted(e)) return;
      e.preventDefault(); // required, or the browser rejects/navigates the drop
    };
    const onDragLeave = (e: DragEvent) => {
      if (!wanted(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      depth.current = 0;
      setDragging(false);
      // Terminal panes stopPropagation on their drops — reaching here means
      // the drop landed on a non-pane surface.
      const inAppPath = e.dataTransfer?.getData(CCM_PATH_MIME);
      if (inAppPath) {
        e.preventDefault();
        openPath(inAppPath);
        return;
      }
      if (!wantsFiles(e)) return;
      e.preventDefault();
      const file = Array.from(e.dataTransfer?.files ?? []).find((f) => isReadable(f.name));
      if (file) openFile(file);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      depth.current = 0;
      setDragging(false);
    };
  }, [fileDrops, openFile, openPath]);

  // Esc closes the reader.
  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, close]);

  return (
    <>
      {/* drop-target overlay while a file is dragged over the window */}
      <AnimatePresence>
        {fileDrops && dragging && !doc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none"
          >
            <div className="rounded-xl border-2 border-dashed border-[color:var(--accent)] bg-[color:var(--bg-elev)]/90 px-10 py-8 text-center">
              <BookOpen size={28} className="mx-auto mb-3 text-[color:var(--accent)]" />
              <div className="text-sm font-semibold text-[color:var(--fg)]">Drop to read</div>
              <div className="mt-1 text-xs text-[color:var(--fg-muted)]">
                Markdown, PDF, and plain-text files open in the reader
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the reader itself */}
      <AnimatePresence>
        {doc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex flex-col bg-black/60 backdrop-blur-sm"
            onClick={close}
          >
            <motion.div
              initial={{ y: 16, scale: 0.985 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
              className="mx-auto my-6 flex h-[calc(100%-3rem)] w-[min(60rem,calc(100%-3rem))] flex-col overflow-hidden rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--bg-elev)] shadow-[var(--shadow-lg)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] px-4 py-2.5">
                <FileText size={14} className="text-[color:var(--accent)]" />
                <span className="truncate font-mono text-[12.5px] text-[color:var(--fg)]">{doc.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-[color:var(--fg-faint)] border border-[color:var(--border)] px-1.5 py-0.5 rounded">
                  {doc.kind}
                </span>
                <span className="flex-1" />
                <span className="text-[10px] text-[color:var(--fg-faint)]">read-only · Esc to close</span>
                <button
                  onClick={close}
                  aria-label="Close reader"
                  className="rounded p-1 text-[color:var(--fg-muted)] transition hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]"
                >
                  <X size={15} />
                </button>
              </div>

              {doc.kind === "pdf" ? (
                <embed src={doc.url} type="application/pdf" className="h-full w-full flex-1" title={doc.name} />
              ) : doc.kind === "markdown" ? (
                <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
                  <div
                    className="md-body mx-auto max-w-3xl"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }}
                  />
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
                  <pre className="mx-auto max-w-4xl whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-[color:var(--fg-muted)]">
                    {doc.content}
                  </pre>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
