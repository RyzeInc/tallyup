"use client";

/**
 * Last-resort boundary. Replaces the root layout entirely, so it must render
 * its own <html>/<body> and cannot rely on theme variables being present.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#fff",
          color: "#111",
        }}
      >
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 12, fontSize: "0.9375rem", lineHeight: 1.6, color: "#555" }}>
            TallyUp hit an unexpected error and couldn&apos;t finish loading. Your data
            is safe.
          </p>
          {error.digest && (
            <p style={{ marginTop: 8, fontSize: "0.75rem", color: "#888" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 12,
              border: "none",
              background: "#4F6CFF",
              color: "#fff",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
