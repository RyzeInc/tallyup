"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shared body for route-level error.tsx boundaries. Keeps the app chrome
 * (which lives in the layout above the boundary) intact so a failure in one
 * page no longer blanks the whole app.
 */
export default function RouteError({
  error,
  reset,
  title = "This page didn't load",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  useEffect(() => {
    // Surfaced in the browser console and in server logs for RSC errors.
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div
      className="flex flex-1 items-center justify-center px-4"
      style={{ minHeight: 320 }}
      role="alert"
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1
          className="font-semibold"
          style={{ fontSize: "1.125rem", color: "var(--text)", margin: 0 }}
        >
          {title}
        </h1>
        <p
          className="text-sm"
          style={{ marginTop: 10, lineHeight: 1.6, color: "var(--text-secondary)" }}
        >
          Something went wrong while rendering this section. Your data is safe — you
          can retry, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="text-xs" style={{ marginTop: 8, color: "var(--text-tertiary)" }}>
            Reference: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3" style={{ marginTop: 20 }}>
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl px-5 text-sm font-semibold"
            style={{
              minHeight: 44,
              border: "none",
              backgroundColor: "var(--primary)",
              color: "var(--on-primary, #fff)",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl px-5 text-sm font-medium"
            style={{
              minHeight: 44,
              border: "1px solid var(--border)",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
