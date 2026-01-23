"use client";

import * as React from "react";
import * as Lucide from "lucide-react";

type NoteDialogProps = {
  open: boolean;
  note: string;
  onNoteChange: (note: string) => void;
  onClose: () => void;
};

export function NoteDialog({
  open,
  note,
  onNoteChange,
  onClose,
}: NoteDialogProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [localNote, setLocalNote] = React.useState(note);

  // Sync local state when opening
  React.useEffect(() => {
    if (open) {
      setLocalNote(note);
      // Focus textarea after a brief delay for animation
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [open, note]);

  const handleSave = React.useCallback(() => {
    onNoteChange(localNote);
    onClose();
  }, [localNote, onNoteChange, onClose]);

  // Handle escape key
  React.useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleSave]);

  const handleClear = () => {
    setLocalNote("");
    textareaRef.current?.focus();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 animate-in fade-in duration-200"
        onClick={handleSave}
      />

      {/* Dialog */}
      <div
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Add note"
      >
        <div
          className="rounded-2xl shadow-xl overflow-hidden"
          style={{ backgroundColor: "var(--surface)" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Add Note
            </h2>
            <button
              type="button"
              onClick={handleSave}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
              aria-label="Close"
            >
              <Lucide.X className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={localNote}
                onChange={(e) => setLocalNote(e.target.value)}
                placeholder="Add details, context, or a reminder about this transaction..."
                rows={4}
                className="w-full px-4 py-3 text-sm rounded-xl resize-none transition-all focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: "var(--surface-subtle)",
                  color: "var(--text)",
                  border: "none",
                }}
                onKeyDown={(e) => {
                  // Cmd/Ctrl + Enter to save
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSave();
                  }
                }}
              />
              {localNote && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-2 top-2 p-1 rounded transition-colors hover:bg-[var(--surface)]"
                  aria-label="Clear note"
                >
                  <Lucide.X className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                </button>
              )}
            </div>
            <p
              className="text-[11px] mt-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              Press <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: "var(--surface-subtle)" }}>⌘</kbd> + <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: "var(--surface-subtle)" }}>Enter</kbd> to save
            </p>
          </div>

          {/* Footer */}
          <div
            className="flex gap-2 px-4 py-3 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--surface-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 h-10 rounded-xl text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              Save Note
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
