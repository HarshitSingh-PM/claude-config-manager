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
        <button onClick={toggle} className="flex min-w-0 flex-1 items-center gap-1 text-left">
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
                key={e.name}
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
                key={e.name}
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

// A clickable file row. Viewable files open the in-app viewer; others are inert.
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
      onClick={() => viewable && onOpenFile(path)}
      disabled={!viewable}
      title={viewable ? `Open ${name}` : name}
      style={{ paddingLeft: indent }}
      className={`flex w-full items-center gap-1 rounded px-1 py-[3px] text-left text-xs transition-colors ${
        active
          ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
          : viewable
            ? "text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-elev-2)] hover:text-[color:var(--fg)]"
            : "text-[color:var(--fg-faint)]"
      } ${viewable ? "cursor-pointer" : "cursor-default"}`}
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
  const [showAll, setShowAll] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoot(cwd);
  }, [cwd]);

  const load = useCallback(async () => {
    setData(await fetchDir(root, showAll));
  }, [root, showAll]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, reloadKey]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Root path bar */}
      <div className="mb-1.5 flex items-center gap-1 px-1">
        <button
          onClick={() => setRoot(data?.home || root)}
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
        {!data ? (
          <div className="px-2 py-4 text-[11px] text-[color:var(--fg-faint)]">Loading…</div>
        ) : (
          data.entries.map((e) =>
            e.isDir ? (
              <Node
                key={e.name}
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
                key={e.name}
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
