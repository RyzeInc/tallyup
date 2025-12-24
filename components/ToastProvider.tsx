"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Toast = { id: string; title: string; body?: string; kind?: "success" | "info" | "error" };

const ToastContext = createContext<{ push: (t: Omit<Toast, "id">) => void } | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((s) => [{ id, ...t }, ...s]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== t.id));
      }, 5000)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed top-6 right-6 z-50 flex w-full max-w-sm flex-col-reverse gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-2xl border px-3 py-2 shadow-lg transition-all duration-150 ${
              t.kind === "success" ? "bg-emerald-50 text-emerald-900 border-emerald-200" : t.kind === "error" ? "bg-rose-50 text-rose-900 border-rose-200" : "bg-white text-neutral-900 border-neutral-200"
            }`}
            style={{ boxShadow: "0 6px 18px rgba(0,0,0,0.12)" }}
          >
            <div className="text-sm font-semibold">{t.title}</div>
            {t.body ? <div className="text-xs mt-1 opacity-80">{t.body}</div> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
