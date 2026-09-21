import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

/**
 * Public marketing shell. Deliberately has no ConvexClientProvider and no
 * AuthGate: these pages must render for signed-out visitors and be indexable.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-full)",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        className="sticky top-0 z-50"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "color-mix(in srgb, var(--bg-full) 85%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <nav
          className="mx-auto flex items-center justify-between gap-4 px-4"
          style={{ maxWidth: 1120, height: 64 }}
          aria-label="Main"
        >
          <Link
            href="/"
            className="text-lg font-semibold"
            style={{ color: "var(--text)", textDecoration: "none", letterSpacing: "-0.01em" }}
          >
            TallyUp
          </Link>

          <div className="flex items-center gap-2">
            <SignedOut>
              <Link
                href="/sign-in"
                className="rounded-xl px-4 text-sm font-medium inline-flex items-center"
                style={{
                  minHeight: 40,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                }}
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-xl px-4 text-sm font-semibold inline-flex items-center"
                style={{
                  minHeight: 40,
                  backgroundColor: "var(--primary)",
                  color: "var(--on-primary, #fff)",
                  textDecoration: "none",
                }}
              >
                Get started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="rounded-xl px-4 text-sm font-semibold inline-flex items-center"
                style={{
                  minHeight: 40,
                  backgroundColor: "var(--primary)",
                  color: "var(--on-primary, #fff)",
                  textDecoration: "none",
                }}
              >
                Open app
              </Link>
            </SignedIn>
          </div>
        </nav>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer
        style={{ borderTop: "1px solid var(--border)", padding: "32px 16px" }}
      >
        <div
          className="mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          style={{ maxWidth: 1120 }}
        >
          <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            © {new Date().getFullYear()} TallyUp
          </span>
          <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Bank connections are read-only and handled by Plaid.
          </span>
        </div>
      </footer>
    </div>
  );
}
