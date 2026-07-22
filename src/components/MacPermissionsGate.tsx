"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderLock, ExternalLink, ShieldCheck, Check } from "lucide-react";
import { isDesktop } from "@/lib/desktop";

const ACK_KEY = "ccm:mac-perms-ack-v1";
const FILES_AND_FOLDERS = "x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders";
const FULL_DISK = "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles";

function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
}

// Opening a non-http URL routes through the main process' window-open handler,
// which hands it to shell.openExternal — so this deep-links into System Settings.
function openSettings(url: string) {
  window.open(url, "_blank");
}

export function MacPermissionsGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // First launch only, desktop app on macOS. Browser builds have no TCC.
    if (!isDesktop() || !isMac()) return;
    let acked = false;
    try {
      acked = localStorage.getItem(ACK_KEY) === "1";
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!acked) setShow(true);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(ACK_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
        >
          <motion.div
            initial={{ scale: 0.96, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 440, damping: 32 }}
            className="w-full max-w-md rounded-[var(--radius-lg)] border border-[color:var(--border-strong)] bg-[color:var(--bg-elev)] p-6 shadow-[var(--shadow-lg)] surface-hi"
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              <FolderLock size={24} />
            </div>
            <h3 className="t-h2">Allow folder access</h3>
            <p className="t-small text-[color:var(--fg-muted)] mt-2 leading-relaxed">
              To create and manage projects, Claude Config needs macOS permission to read and write
              files in your folders. macOS may prompt you the first time it touches
              <span className="font-mono text-[color:var(--fg)]"> Documents</span>,
              <span className="font-mono text-[color:var(--fg)]"> Desktop</span>, or
              <span className="font-mono text-[color:var(--fg)]"> Downloads</span> — click
              <span className="text-[color:var(--fg)]"> Allow</span>. For no prompts at all, grant
              Full Disk Access.
            </p>

            <div className="mt-4 space-y-2">
              <button
                onClick={() => openSettings(FILES_AND_FOLDERS)}
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-[color:var(--border-strong)] bg-[color:var(--bg-elev-2)] px-3.5 py-2.5 text-left transition hover:border-[color:var(--accent)]/50"
              >
                <ShieldCheck size={16} className="text-[color:var(--accent)] shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block t-small font-medium text-[color:var(--fg)]">
                    Files &amp; Folders settings
                  </span>
                  <span className="block t-label text-[color:var(--fg-faint)]">
                    Enable Claude Config per folder
                  </span>
                </span>
                <ExternalLink size={14} className="text-[color:var(--fg-faint)] shrink-0" />
              </button>
              <button
                onClick={() => openSettings(FULL_DISK)}
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-[color:var(--border-strong)] bg-[color:var(--bg-elev-2)] px-3.5 py-2.5 text-left transition hover:border-[color:var(--accent)]/50"
              >
                <FolderLock size={16} className="text-[color:var(--accent)] shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block t-small font-medium text-[color:var(--fg)]">
                    Full Disk Access
                  </span>
                  <span className="block t-label text-[color:var(--fg-faint)]">
                    No prompts — add Claude Config, then relaunch
                  </span>
                </span>
                <ExternalLink size={14} className="text-[color:var(--fg-faint)] shrink-0" />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={dismiss}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[linear-gradient(100deg,var(--accent),var(--accent-2))] px-4 py-2 text-[13px] font-semibold text-[#04120c] transition hover:brightness-110"
              >
                <Check size={14} /> Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
