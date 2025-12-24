"use client";

import React, { useEffect } from "react";
import LogForm from "./LogForm";

export default function QuickLogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-surface p-4 shadow-lg" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Quick Log</h3>
          <button onClick={onClose} className="text-sm text-neutral-500">Close</button>
        </div>
        <LogForm onDone={() => onClose()} />
      </div>
    </div>
  );
}
