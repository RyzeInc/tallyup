"use client";

import React, { useEffect, useRef } from "react";
import * as Lucide from "lucide-react";
import LogForm from "./LogForm";

export default function QuickLogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  // Focus trap and initial focus
  useEffect(() => {
    if (open && sheetRef.current) {
      // Find and focus the amount input
      const amountInput = sheetRef.current.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
      if (amountInput) {
        setTimeout(() => amountInput.focus(), 100);
      }
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick log entry"
        className="relative w-full max-w-md animate-in slide-in-from-bottom-4 duration-200 sm:slide-in-from-bottom-0"
      >
        <div
          className="rounded-t-2xl sm:rounded-2xl border-t sm:border p-4 pb-8 sm:pb-4"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          {/* Handle (mobile only) */}
          <div className="flex justify-center mb-3 sm:hidden">
            <div
              className="h-1 w-10 rounded-full"
              style={{ backgroundColor: "var(--border)" }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              Quick Log
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-[var(--surface-subtle)] transition-colors"
              aria-label="Close"
            >
              <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>

          <LogForm onDone={() => onClose()} />
        </div>
      </div>
    </div>
  );
}
