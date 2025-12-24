"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import QuickLogModal from "./QuickLogModal";

const QuickLogContext = createContext<{
  open: () => void;
  close: () => void;
  isOpen: boolean;
  showToast: (message: string, undo?: () => void) => void;
}>({ open: () => {}, close: () => {}, isOpen: false, showToast: () => {} });

export function useQuickLog() {
  return useContext(QuickLogContext);
}

export default function QuickLogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; undo?: () => void }>>([]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const showToast = useCallback((message: string, undo?: () => void) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((t) => [...t, { id, message, undo }]);
    // auto clear
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  // global hotkey: L or N opens quick log when not focused on input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const key = typeof e.key === "string" ? e.key.toLowerCase() : "";
      if ((key === "l" || key === "n") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const active = document.activeElement as HTMLElement | null;
        const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.getAttribute("role") === "textbox");
        if (!isInput) {
          e.preventDefault();
          setIsOpen(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <QuickLogContext.Provider value={{ open, close, isOpen, showToast }}>
      {children}
      {/* Quick log modal */}
      <QuickLogModal open={isOpen} onClose={() => setIsOpen(false)} />

      <div aria-live="polite" className="fixed left-0 right-0 bottom-6 flex items-center justify-center pointer-events-none">
        <div className="space-y-2">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto rounded-md bg-neutral-900/95 px-4 py-2 text-sm text-white shadow">
              <div className="flex items-center gap-3">
                <div>{t.message}</div>
                {t.undo ? (
                  <button onClick={t.undo} className="ml-2 text-xs underline">Undo</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </QuickLogContext.Provider>
  );
}
