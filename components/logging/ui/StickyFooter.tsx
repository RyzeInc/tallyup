"use client";

import * as React from "react";
import type { LogMode } from "../types";
import type { MachineStatus } from "../machine";
import * as Lucide from "lucide-react";

export function StickyFooter({
  mode,
  status,
  ctaLabel,
  canSubmit,
  onSubmit,
  helperText,
  error,
}: {
  mode: LogMode;
  status: MachineStatus;
  ctaLabel: string;
  canSubmit: boolean;
  onSubmit: () => void;
  helperText?: string;
  error?: string;
}) {
  const isDisabled = status === "submitting" || (mode === "resolve" && !canSubmit);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t backdrop-blur-sm z-40"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <div className="mx-auto w-full max-w-md px-4 py-3 pb-safe">
        {error && (
          <div
            className="mb-2 p-3 rounded-lg text-sm flex items-center gap-2"
            style={{
              backgroundColor: "var(--danger-subtle)",
              color: "var(--danger)",
            }}
          >
            <Lucide.AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={isDisabled}
          className="w-full h-12 rounded-xl text-base font-semibold transition-all"
          style={{
            backgroundColor: isDisabled ? "var(--surface-2)" : "var(--primary)",
            color: isDisabled ? "var(--text-tertiary)" : "var(--primary-foreground)",
            cursor: isDisabled ? "not-allowed" : "pointer",
            opacity: isDisabled ? 0.6 : 1,
          }}
        >
          {status === "submitting" ? (
            <span className="flex items-center justify-center gap-2">
              <Lucide.Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : (
            ctaLabel
          )}
        </button>

        {helperText && (
          <div
            className="mt-2 text-center text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            {helperText}
          </div>
        )}
      </div>
    </div>
  );
}
