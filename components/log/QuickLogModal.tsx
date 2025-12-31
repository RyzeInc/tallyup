"use client";

import React, { useEffect } from "react";
import TransactionSheet from "@/components/transactions/TransactionSheet";

export default function QuickLogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <TransactionSheet open={open} mode="new" onClose={onClose} />
  );
}
