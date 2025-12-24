"use client";

import React, { createContext, useContext, useState } from "react";

const LinksContext = createContext<{ has: (id: string) => boolean; add: (id: string) => void; remove: (id: string) => void } | undefined>(undefined);

export function OptimisticLinksProvider({ children }: { children: React.ReactNode }) {
  const [setState, setSetState] = useState<Set<string>>(() => new Set());

  function add(id: string) {
    setSetState((s) => new Set(s).add(id));
  }
  function remove(id: string) {
    setSetState((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }
  function has(id: string) {
    return setState.has(id);
  }

  return <LinksContext.Provider value={{ has, add, remove }}>{children}</LinksContext.Provider>;
}

export function useOptimisticLinks() {
  const ctx = useContext(LinksContext);
  if (!ctx) throw new Error("useOptimisticLinks must be used within OptimisticLinksProvider");
  return ctx;
}
