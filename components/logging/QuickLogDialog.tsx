"use client";

import * as React from "react";
import { QuickLogForm, type QuickLogFormProps } from "./QuickLogForm";

type QuickLogDialogProps = QuickLogFormProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function QuickLogDialog({
  open,
  onOpenChange,
  ...formProps
}: QuickLogDialogProps) {
  // Handle escape key at dialog level
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  // Prevent body scroll when dialog is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog Content */}
      <div
        className="relative w-full sm:max-w-md h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200 flex flex-col"
        style={{
          backgroundColor: "var(--surface)",
        }}
      >
        <QuickLogForm
          {...formProps}
          onClose={() => onOpenChange(false)}
        />
      </div>
    </div>
  );
}
