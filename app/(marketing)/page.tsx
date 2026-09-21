import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TallyUp — See where your money actually goes",
  description:
    "Link your accounts, catch every recurring charge before it hits, and know what's safe to spend today. TallyUp is built for awareness, not optimization.",
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    title: "Every recurring charge, caught",
    body: "TallyUp detects subscriptions and bills from your transaction history, projects the next charge date and amount, and flags the ones that quietly changed price.",
  },
  {
    title: "Safe-to-spend that accounts for what's coming",
    body: "Not just balance minus budget. Upcoming bills, expected income, goal contributions, and pending transactions all feed one number you can trust.",
  },
  {
    title: "Budgets that reconcile themselves",
    body: "Categories, groups, rollover policies, and period tracking stay in sync as transactions land — no monthly reset ritual.",
  },
  {
    title: "Goals wired to real cash flow",
    body: "Savings targets, debt payoff, and sinking funds are checked against what's actually left after commitments, so a goal can tell you when it isn't realistic.",
  },
  {
    title: "A coach that reads your numbers",
    body: "Ask about your spending and get answers grounded in your own data and history — not generic advice.",
  },
  {
    title: "Works offline, installs like an app",
    body: "A full PWA. Add it to your home screen, log an expense on the subway, and it syncs when you're back.",
  },
];

const STEPS = [
  { n: "1", title: "Link an account", body: "Read-only bank connections through Plaid. Takes about a minute." },
  { n: "2", title: "Let it sort", body: "Transactions are categorized automatically, and recurring charges surface on their own." },
  { n: "3", title: "Check one number", body: "Open the dashboard and see what's safe to spend, what's due, and what changed." },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-4" style={{ paddingTop: 72, paddingBottom: 56 }}>
        <div className="mx-auto text-center" style={{ maxWidth: 720 }}>
          <p
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              marginBottom: 24,
            }}
          >
            Event-first personal finance
          </p>
          <h1
            className="font-semibold"
            style={{
              fontSize: "clamp(2.25rem, 6vw, 3.75rem)",
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            See where your money actually goes
          </h1>
          <p
            className="mx-auto"
            style={{
              marginTop: 20,
              fontSize: "1.125rem",
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              maxWidth: 560,
            }}
          >
            Link your accounts, catch every recurring charge before it hits, and know
            what&apos;s safe to spend today. Built for awareness, not optimization.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3" style={{ marginTop: 32 }}>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-xl px-6 text-base font-semibold w-full sm:w-auto"
              style={{
                minHeight: 48,
                backgroundColor: "var(--primary)",
                color: "var(--on-primary, #fff)",
                textDecoration: "none",
              }}
            >
              Get started free
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-xl px-6 text-base font-medium w-full sm:w-auto"
              style={{
                minHeight: 48,
                border: "1px solid var(--border)",
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              I already have an account
            </Link>
          </div>

          <p className="text-sm" style={{ marginTop: 16, color: "var(--text-tertiary)" }}>
            Read-only bank access via Plaid. No card required.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="px-4" style={{ paddingBottom: 56 }}>
        <div className="mx-auto" style={{ maxWidth: 1120 }}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6"
                style={{
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--card-foreground)",
                }}
              >
                <h2 className="font-semibold" style={{ fontSize: "1.0625rem", letterSpacing: "-0.01em" }}>
                  {f.title}
                </h2>
                <p className="text-sm" style={{ marginTop: 8, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4" style={{ paddingBottom: 72 }}>
        <div className="mx-auto" style={{ maxWidth: 1120 }}>
          <h2
            className="font-semibold text-center"
            style={{ fontSize: "1.75rem", letterSpacing: "-0.02em", marginBottom: 32 }}
          >
            Three steps to a clear picture
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="rounded-2xl p-6"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
              >
                <span
                  className="inline-flex items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "var(--primary)",
                    color: "var(--on-primary, #fff)",
                  }}
                  aria-hidden="true"
                >
                  {s.n}
                </span>
                <h3 className="font-semibold" style={{ marginTop: 16, fontSize: "1.0625rem" }}>
                  {s.title}
                </h3>
                <p className="text-sm" style={{ marginTop: 8, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-4" style={{ paddingBottom: 80 }}>
        <div
          className="mx-auto rounded-3xl text-center px-6"
          style={{
            maxWidth: 800,
            paddingTop: 48,
            paddingBottom: 48,
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
          }}
        >
          <h2 className="font-semibold" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
            Start with one linked account
          </h2>
          <p
            className="mx-auto text-sm"
            style={{ marginTop: 12, maxWidth: 480, lineHeight: 1.6, color: "var(--text-secondary)" }}
          >
            You&apos;ll see your recurring charges and a real safe-to-spend number within
            a few minutes of connecting.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-xl px-6 text-base font-semibold"
            style={{
              marginTop: 24,
              minHeight: 48,
              backgroundColor: "var(--primary)",
              color: "var(--on-primary, #fff)",
              textDecoration: "none",
            }}
          >
            Create your account
          </Link>
        </div>
      </section>
    </>
  );
}
