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
      className="flex-shrink-0 border-t"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <div className="w-full px-4 pt-3 pb-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
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
