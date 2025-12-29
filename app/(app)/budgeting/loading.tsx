"use client";

export default function BudgetingLoading() {
  return (
    <div className="space-y-4 pb-4">
      <div
        className="rounded-2xl p-5 animate-pulse"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="h-8 w-32 rounded-lg mb-4" style={{ backgroundColor: "var(--surface-subtle)" }} />
        <div className="h-12 w-48 rounded-lg mb-4" style={{ backgroundColor: "var(--surface-subtle)" }} />
        <div className="space-y-3">
          <div className="h-8 w-full rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }} />
          <div className="h-8 w-full rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }} />
          <div className="h-8 w-3/4 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }} />
        </div>
      </div>
    </div>
  );
}
