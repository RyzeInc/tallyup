"use client";

export default function GoalsLoading() {
  return (
    <div className="space-y-4 pb-4">
      <div
        className="rounded-2xl p-5 animate-pulse"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="h-8 w-24 rounded-lg mb-4" style={{ backgroundColor: "var(--surface-subtle)" }} />
        <div className="h-3 w-full rounded-full mb-3" style={{ backgroundColor: "var(--surface-subtle)" }} />
        <div className="h-6 w-32 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }} />
      </div>
    </div>
  );
}
