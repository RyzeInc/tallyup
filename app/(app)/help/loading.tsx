"use client";

export default function HelpLoading() {
  return (
    <div className="space-y-4 pb-4">
      <div
        className="rounded-2xl p-5 animate-pulse"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="h-8 w-24 rounded-lg mb-2" style={{ backgroundColor: "var(--surface-subtle)" }} />
        <div className="h-5 w-64 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }} />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-4 animate-pulse"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full" style={{ backgroundColor: "var(--surface-subtle)" }} />
              <div className="h-5 w-48 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
