"use client";

import React, { createContext, useCallback, useContext, useEffect, useState, useMemo } from "react";
import * as Lucide from "lucide-react";

export type ToastKind = "success" | "info" | "error" | "warning";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  title: string;
  description?: string;
  kind: ToastKind;
  action?: ToastAction;
  duration?: number; // ms, default 4000
}

export interface ToastOptions {
  description?: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastAPI {
  success: (title: string, options?: ToastOptions) => void;
  error: (title: string, options?: ToastOptions) => void;
  info: (title: string, options?: ToastOptions) => void;
  warning: (title: string, options?: ToastOptions) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastAPI | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((s) => s.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const push = useCallback((kind: ToastKind, title: string, options?: ToastOptions) => {
    const id = Math.random().toString(36).slice(2, 9);
    const toast: Toast = {
      id,
      title,
      kind,
      description: options?.description,
      action: options?.action,
      duration: options?.duration ?? (kind === "error" ? 6000 : 4000),
    };
    setToasts((s) => [...s, toast]);
    return id;
  }, []);

  const api = useMemo<ToastAPI>(() => ({
    success: (title, options) => push("success", title, options),
    error: (title, options) => push("error", title, options),
    info: (title, options) => push("info", title, options),
    warning: (title, options) => push("warning", title, options),
    dismiss,
    dismissAll,
  }), [push, dismiss, dismissAll]);

  // Auto-dismiss timers
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== t.id));
      }, t.duration ?? 4000)
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [toasts]);

  const getIcon = (kind: ToastKind) => {
    switch (kind) {
      case "success": return Lucide.CheckCircle2;
      case "error": return Lucide.XCircle;
      case "warning": return Lucide.AlertTriangle;
      default: return Lucide.Info;
    }
  };

  const getColors = (kind: ToastKind) => {
    switch (kind) {
      case "success": return { bg: "var(--success)", text: "#fff", icon: "#fff" };
      case "error": return { bg: "var(--danger)", text: "#fff", icon: "#fff" };
      case "warning": return { bg: "var(--warning)", text: "var(--text)", icon: "var(--text)" };
      default: return { bg: "var(--surface)", text: "var(--text)", icon: "var(--text-secondary)" };
    }
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast viewport - bottom center on mobile, respects safe areas */}
      <div 
        className="fixed left-0 right-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none"
        style={{
          bottom: "calc(var(--bottomnav-height, 64px) + env(safe-area-inset-bottom, 0px) + 12px)",
          padding: "0 16px",
        }}
      >
        {toasts.map((t) => {
          const Icon = getIcon(t.kind);
          const colors = getColors(t.kind);
          
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-200"
              style={{
                backgroundColor: colors.bg,
                color: colors.text,
                maxWidth: "min(400px, calc(100vw - 32px))",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
              onClick={() => dismiss(t.id)}
              role="alert"
              aria-live="polite"
            >
              <Icon className="h-5 w-5 flex-shrink-0" style={{ color: colors.icon }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{t.title}</div>
                {t.description && (
                  <div className="text-xs mt-0.5 opacity-90">{t.description}</div>
                )}
              </div>
              {t.action && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="flex-shrink-0 text-sm font-semibold underline underline-offset-2 hover:opacity-80"
                  style={{ color: colors.text }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
