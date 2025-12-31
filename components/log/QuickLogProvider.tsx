"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import QuickLogModal from "./QuickLogModal";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: string;
  message: string;
  undo?: () => void;
  actions?: ToastAction[];
};

const QuickLogContext = createContext<{
  open: () => void;
  close: () => void;
  isOpen: boolean;
  showToast: (message: string, undo?: () => void) => void;
  showRichToast: (message: string, actions: ToastAction[]) => void;
  clearToasts: () => void;
}>({ open: () => {}, close: () => {}, isOpen: false, showToast: () => {}, showRichToast: () => {}, clearToasts: () => {} });

export function useQuickLog() {
  return useContext(QuickLogContext);
}

export default function QuickLogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const clearToasts = useCallback(() => setToasts([]), []);

  const showToast = useCallback((message: string, undo?: () => void) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((t) => [...t, { id, message, undo }]);
    // auto clear
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const showRichToast = useCallback((message: string, actions: ToastAction[]) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((t) => [...t, { id, message, actions }]);
    // auto clear after 8s for rich toasts
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 8000);
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
    <QuickLogContext.Provider value={{ open, close, isOpen, showToast, showRichToast, clearToasts }}>
      {children}
      {/* Quick log modal */}
      <QuickLogModal open={isOpen} onClose={() => setIsOpen(false)} />

      <div aria-live="polite" className="fixed left-0 right-0 bottom-20 flex items-center justify-center pointer-events-none z-50">
        <div className="space-y-2 mx-4 max-w-sm w-full">
          {toasts.map((t) => (
            <div 
              key={t.id} 
              className="pointer-events-auto rounded-lg px-4 py-3 text-sm shadow-lg"
              style={{ 
                backgroundColor: "var(--surface)", 
                color: "var(--text)",
                border: "1px solid var(--border)"
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" style={{ color: "var(--success)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">{t.message}</span>
                </div>
                {t.undo && !t.actions && (
                  <button 
                    onClick={() => {
                      t.undo?.();
                      setToasts((toasts) => toasts.filter((x) => x.id !== t.id));
                    }} 
                    className="text-xs font-medium px-2 py-1 rounded hover:bg-[var(--surface-subtle)]"
                    style={{ color: "var(--accent)" }}
                  >
                    Undo
                  </button>
                )}
              </div>
              {t.actions && t.actions.length > 0 && (
                <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  {t.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        action.onClick();
                        setToasts((toasts) => toasts.filter((x) => x.id !== t.id));
                      }}
                      className="text-xs font-medium px-2 py-1 rounded hover:bg-[var(--surface-subtle)] transition-colors"
                      style={{ color: "var(--accent)" }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </QuickLogContext.Provider>
  );
}
