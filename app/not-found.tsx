import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div
      className="flex items-center justify-center px-4"
      style={{ minHeight: "100vh", background: "var(--bg-full)", color: "var(--text)" }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p
          className="font-semibold"
          style={{ fontSize: "0.875rem", letterSpacing: "0.08em", color: "var(--text-tertiary)" }}
        >
          404
        </p>
        <h1 className="font-semibold" style={{ marginTop: 8, fontSize: "1.5rem", letterSpacing: "-0.02em" }}>
          We couldn&apos;t find that page
        </h1>
        <p className="text-sm" style={{ marginTop: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          The link may be out of date, or the page may have moved.
        </p>
        <div className="flex items-center justify-center gap-3" style={{ marginTop: 24 }}>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl px-5 text-sm font-semibold"
            style={{
              minHeight: 44,
              backgroundColor: "var(--primary)",
              color: "var(--on-primary, #fff)",
              textDecoration: "none",
            }}
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl px-5 text-sm font-medium"
            style={{
              minHeight: 44,
              border: "1px solid var(--border)",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
