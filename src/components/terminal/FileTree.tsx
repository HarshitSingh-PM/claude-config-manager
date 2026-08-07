"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  File as FileIcon,
  Home,
  CornerLeftUp,
  TerminalSquare,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";

type Entry = { name: string; isDir: boolean };
type DirData = { path: string; parent: string | null; home: string; name: string; entries: Entry[] };

async function fetchDir(p: string, all: boolean): Promise<DirData | null> {
  const res = await fetch(`/api/fs-tree?path=${encodeURIComponent(p)}${all ? "&all=1" : ""}`);
  if (!res.ok) return null;
  return (await res.json()) as DirData;
}

// Extensions that open in the in-app viewer/editor.
const VIEWABLE = /\.(md|markdown|mdx|pdf|png|jpe?g|gif|webp|svg|bmp|ico|txt|json|jsonc|ya?ml|toml|ini|env|sh|jsx?|tsx?|py|rb|go|rs|c|h|css|html|xml|log|csv|conf)$/i;

// A single expandable folder node. Children load lazily on first expand.
function Node({
  path,
  name,
  depth,
  showAll,
  cwd,
  activeFile,
  onOpenTerminal,
  onOpenFile,
  onSetRoot,
}: {
  path: string;
  name: string;
  depth: number;
  showAll: boolean;
  cwd: string;
  activeFile: string | null;
  onOpenTerminal: (dir: string) => void;
  onOpenFile: (filePath: string) => void;
  onSetRoot: (dir: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DirData | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !data) {
      setLoading(true);
      setData(await fetchDir(path, showAll));
      setLoading(false);
    }
  };

  // Reload children when the hidden-files toggle flips while expanded.
  useEffect(() => {
    if (open && data) {
      fetchDir(path, showAll).then((d) => d && setData(d));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  const isCwd = cwd === path;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded px-1 py-[3px] text-xs transition-colors ${
          isCwd
            ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
            : "text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)]"
        }`}
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        <button
          onClick={toggle}
          draggable
          onDragStart={(e) => startPathDrag(e, path)}
          className="flex min-w-0 flex-1 items-center gap-1 text-left cursor-grab active:cursor-grabbing"
        >
          <ChevronRight
            size={12}
            className={`shrink-0 transition-transform ${open ? "rotate-90" : ""} text-[color:var(--fg-faint)]`}
          />
          {open ? (
            <FolderOpen size={13} className="shrink-0 text-[color:var(--accent)]" />
          ) : (
            <Folder size={13} className="shrink-0 text-[color:var(--fg-faint)]" />
          )}
          <span className="truncate">{name}</span>
        </button>
        <button
          onClick={() => onOpenTerminal(path)}
          title="Open a terminal here"
          className="shrink-0 rounded p-0.5 text-[color:var(--fg-faint)] opacity-0 transition hover:text-[color:var(--accent)] group-hover:opacity-100"
        >
          <TerminalSquare size={12} />
        </button>
        <button
          onClick={() => onSetRoot(path)}
          title="Focus this folder as the tree root"
          className="shrink-0 rounded p-0.5 text-[color:var(--fg-faint)] opacity-0 transition hover:text-[color:var(--fg)] group-hover:opacity-100"
        >
          <CornerLeftUp size={12} className="rotate-180" />
        </button>
      </div>
      {open && (
        <div>
          {loading && (
            <div
              className="px-1 py-1 text-[10px] text-[color:var(--fg-faint)]"
              style={{ paddingLeft: 8 + (depth + 1) * 12 }}
            >
              loading…
            </div>
          )}
          {data?.entries.map((e) =>
            e.isDir ? (
              <Node
                key={`${path}/${e.name}`}
                path={`${path}/${e.name}`}
                name={e.name}
                depth={depth + 1}
                showAll={showAll}
                cwd={cwd}
                activeFile={activeFile}
                onOpenTerminal={onOpenTerminal}
                onOpenFile={onOpenFile}
                onSetRoot={onSetRoot}
              />
            ) : (
              <FileRow
                key={`${path}/${e.name}`}
                path={`${path}/${e.name}`}
                name={e.name}
                indent={4 + (depth + 1) * 12 + 13}
                active={activeFile === `${path}/${e.name}`}
                onOpenFile={onOpenFile}
              />
            ),
          )}
          {data && data.entries.length === 0 && (
            <div
              className="px-1 py-1 text-[10px] text-[color:var(--fg-faint)]"
              style={{ paddingLeft: 8 + (depth + 1) * 12 }}
            >
              empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Drag payload used across the app: an absolute path a terminal pane can paste.
// (see TerminalShell's pane drop handler.)
export const CCM_PATH_MIME = "text/x-ccm-path";
export function startPathDrag(e: React.DragEvent, path: string) {
  e.dataTransfer.setData(CCM_PATH_MIME, path);
  e.dataTransfer.setData("text/plain", path);
  e.dataTransfer.effectAllowed = "copy";
}

// A clickable, DRAGGABLE file row. Click opens viewable files in the viewer;
// drag drops the file's path into a terminal pane. Non-viewable files are still
// draggable (you just can't open them inline).
function FileRow({
  path,
  name,
  indent,
  active,
  onOpenFile,
}: {
  path: string;
  name: string;
  indent: number;
  active: boolean;
  onOpenFile: (filePath: string) => void;
}) {
  const viewable = VIEWABLE.test(name);
  return (
    <button
      draggable
      onDragStart={(e) => startPathDrag(e, path)}
      onClick={() => viewable && onOpenFile(path)}
      title={viewable ? `Open ${name} — or drag into a terminal` : `Drag ${name} into a terminal`}
      style={{ paddingLeft: indent }}
      className={`flex w-full items-center gap-1 rounded px-1 py-[3px] text-left text-xs transition-colors cursor-grab active:cursor-grabbing ${
        active
          ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
          : viewable
            ? "text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]"
            : "text-[color:var(--fg-faint)] hover:bg-[color:var(--bg-elev-2)]"
      }`}
    >
      <FileIcon size={12} className="shrink-0" />
      <span className="truncate">{name}</span>
    </button>
  );
}

export function FileTree({
  cwd,
  activeFile,
  onOpenTerminal,
  onOpenFile,
}: {
  cwd: string;
  activeFile: string | null;
  onOpenTerminal: (dir: string) => void;
  onOpenFile: (filePath: string) => void;
}) {
  const [root, setRoot] = useState<string>(cwd);
  const [data, setData] = useState<DirData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [homeDir, setHomeDir] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoot(cwd);
  }, [cwd]);

  const load = useCallback(async () => {
    const d = await fetchDir(root, showAll);
    if (d) {
      setData(d);
      setHomeDir(d.home);
      setError(null);
    } else {
      // Keep the failure distinct from "still loading" — the root can point
      // outside home (terminal cwd, dropped folder) and 403 forever.
      setData(null);
      setError("Can't browse this folder — it's outside your home directory or unreadable.");
    }
  }, [root, showAll]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, reloadKey]);

  const goHome = useCallback(async () => {
    if (homeDir) {
      setRoot(homeDir);
      return;
    }
    // Never had a successful load — ask the API for the home dir directly.
    try {
      const res = await fetch("/api/fs-tree");
      const d = (await res.json()) as DirData;
      if (d?.home) setRoot(d.home);
    } catch {
      /* ignore */
    }
  }, [homeDir]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Root path bar */}
      <div className="mb-1.5 flex items-center gap-1 px-1">
        <button
          onClick={goHome}
          title="Home"
          className="rounded p-1 text-[color:var(--fg-faint)] hover:text-[color:var(--accent)]"
        >
          <Home size={13} />
        </button>
        <button
          onClick={() => data?.parent && setRoot(data.parent)}
          disabled={!data?.parent}
          title="Up one level"
          className="rounded p-1 text-[color:var(--fg-faint)] hover:text-[color:var(--fg)] disabled:opacity-30"
        >
          <CornerLeftUp size={13} />
        </button>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          title="Refresh"
          className="rounded p-1 text-[color:var(--fg-faint)] hover:text-[color:var(--fg)]"
        >
          <RefreshCw size={12} />
        </button>
        <button
          onClick={() => setShowAll((v) => !v)}
          title={showAll ? "Hide dotfiles" : "Show all files (dotfiles)"}
          className={`rounded p-1 hover:text-[color:var(--fg)] ${showAll ? "text-[color:var(--accent)]" : "text-[color:var(--fg-faint)]"}`}
        >
          {showAll ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
        <button
          onClick={() => onOpenTerminal(root)}
          title="Open a terminal in the root folder"
          className="ml-auto rounded p-1 text-[color:var(--fg-faint)] hover:text-[color:var(--accent)]"
        >
          <TerminalSquare size={13} />
        </button>
      </div>
      <div
        className="mb-1 truncate px-2 font-mono text-[10px] text-[color:var(--fg-faint)]"
        title={root}
      >
        {data ? `~${root.startsWith(data.home) ? root.slice(data.home.length) || "/" : root}` : root}
      </div>

      {/* Tree */}
      <div className="min-h-0 flex-1 overflow-auto pr-1">
        {error ? (
          <div className="px-2 py-4 text-[11px] leading-relaxed text-[color:var(--warning)]">
            {error}
            <div className="mt-1 text-[color:var(--fg-faint)]">Use the Home button to jump back.</div>
          </div>
        ) : !data ? (
          <div className="px-2 py-4 text-[11px] text-[color:var(--fg-faint)]">Loading…</div>
        ) : (
          data.entries.map((e) =>
            e.isDir ? (
              <Node
                key={`${root}/${e.name}`}
                path={`${root}/${e.name}`}
                name={e.name}
                depth={0}
                showAll={showAll}
                cwd={cwd}
                activeFile={activeFile}
                onOpenTerminal={onOpenTerminal}
                onOpenFile={onOpenFile}
                onSetRoot={setRoot}
              />
            ) : (
              <FileRow
                key={`${root}/${e.name}`}
                path={`${root}/${e.name}`}
                name={e.name}
                indent={17}
                active={activeFile === `${root}/${e.name}`}
                onOpenFile={onOpenFile}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}
