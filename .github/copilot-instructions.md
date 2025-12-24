# Copilot / AI agent instructions — TallyUp

Short, actionable notes to help an AI contributor be productive immediately.

## Quick start (dev)
- Install deps and run Next dev: `npm install` then `npm run dev` (or `pnpm dev`/`yarn dev`).
- Convex (DB + server functions) is required for full local behavior: run `npx convex dev` in a separate terminal. The Convex CLI prints a URL — set `NEXT_PUBLIC_CONVEX_URL` to that URL for the Next app (`app/ConvexClientProvider.tsx` throws if it's missing).
- Convex actions do not have direct DB access. In `action` functions use `ctx.runQuery(...)` and `ctx.runMutation(...)` to call queries/mutations (don't use `ctx.db` inside actions).
- Clerk auth is required for end-to-end Convex mutations. For local development: configure Clerk dev keys or run without auth and mock `ctx.auth.getUserIdentity()` when testing server functions.
- Lint: `npm run lint` (ESLint configured via `eslint.config.mjs`).

## Product vision (short)
TallyUp is an *event-first* personal financial truth engine focused on awareness (not optimization). Treat each inflow/outflow as a first-class event and surface volatility, not smooth averages. Implement features in ways that preserve event detail (timestamps, origin, tags, areas) and support psychological honesty (flag uncertain events, surface `needsReview`, avoid collapsing irregular income into steady monthly metrics).

## High level architecture
- Next.js App Router (app/) is the web app. Pages live in `app/(app)/` (e.g., `summary`, `log`, `history`, `inbox`).
- Auth: Clerk is the auth provider (see `app/layout.tsx` and `app/proxy.ts`).
- Backend / DB: Convex hosts server functions and the DB. Convex server code lives in `convex/` and generated client helpers are under `convex/_generated/` (regenerate by running `npx convex dev`).
- Client ↔ server: Client components use `convex/react` hooks and the typed `api` from `convex/_generated/api` (e.g. `useQuery(api.entries.listEntries, {...})`).

## How product concepts map to code (act immediately useful)
- Event model: `convex/schema.ts` table `entries` stores each event (fields: `type`, `bucket`, `category`, `tags`, `amountCents`, `date`, `needsReview`, `createdAt`/`updatedAt`). Treat these as immutable events when possible; updates patch existing docs via `convex/entries.ts` mutations.
- Needs review / Inbox: `needsReview` is set when `category` is missing; used by `listInbox` in `convex/entries.ts` and displayed in `app/(app)/inbox/page.tsx`.
- Areas & Tags: Defaults in `components/utils.ts` (DEFAULT_BUCKETS, DEFAULT_TAGS); areas are free-text (normalized on queries/filters) and used heavily in UX (summary areas pie, filters in add).
- Money & Dates: Use `amountCents` (integer cents) and the helpers in `components/utils.ts` (`dollarsToCents`, `centsToDollars`, `yyyymmddToLocalMidnightTs`, `startOfWeekLocalTs`).
- Summary & insights: Summary calculations live in `app/(app)/summary/page.tsx` — replicate its approach when building new analytics: aggregate event-level data, preserve outliers, avoid smoothing into monthly salary.

## Recurring series & matching (current implementation)
- Data: A `recurringRules` table stores series/matcher information (now expanded to include fields like `displayName`, `autolinkEnabled`, cadence guidance, amountMode, min/max/tolerance, and `confidence`). Entries link to a recurring series using `entries.recurringRuleId` (typed `v.id("recurringRules")`).
- Detection: A detector prototype lives in `convex/detector.ts` (`detectRecurringCandidatesFromEntries`) which groups by `(type,area,category)`, analyzes intervals and amount variability, and returns candidates with `amountMode` and `amountTolerancePercent`. (UI exposes these as Areas to keep language friendly)
- Auto-apply: `addEntry` (in `convex/entries.ts`) now performs a conservative auto-apply pass: it queries active patterns with `autolinkEnabled` (server flag) and links the best match when criteria (area/category/amount tolerance) are satisfied. This is intentionally conservative — adjust thresholds in server logic as needed.
- Backfill: `convex/recurring.ts` implements a `backfillRecurringRules` action that creates series from strong candidates and can link matching historical entries (dry-run support provided in the action args).

Notes: The repo favors a "Series (user-facing)" mindset backed by matcher fields; if you prefer a 2-table model (Series + Matchers) that is still straightforward to add later, but currently the series object contains matching knobs for Phase 1.

## Implementation checklist (when adding features)
1. Server: add/modify Convex queries/mutations in `convex/` following patterns in `entries.ts` and validate inputs server-side.
2. Regenerate: run `npx convex dev` to regenerate `convex/_generated/*` and commit generated files if needed in this repo's workflow.
3. Client: import `api` from `convex/_generated/api` and call with `useQuery`/`useMutation` in pages or components.
4. UI: add small presentational components under `components/` (prefer `/components` over `src/components`). Mark client components with `"use client"` and use Tailwind utility classes.
5. Tests & checks: run `npm run lint`, add small integration tests or CI checks for Convex changes if the feature affects data shape or user flows.
6. PR checklist: lint passes, regenerate `convex/_generated/`, update README or docs when behavior changes, add notes about migrations if schema changes.

## UX & edge-case guidance (product-aligned)
- Preserve raw events: avoid algorithms that permanently lose event attributes (source, note, tags). If downsampling, keep an export or derived view but don't change stored events.
- Treat income as unreliable: new summary features should highlight volatility (streak detection, run-rate windows, source exposure) rather than smoothing into stable monthly income by default.
- Use `needsReview` liberally: events without category should flow to the inbox for user labeling; keep that flow fast and reversible.

## Key files to inspect for examples
- `convex/schema.ts` (data model)
- `convex/entries.ts` (server-side queries/mutations and auth patterns)
- `app/ConvexClientProvider.tsx` (requires NEXT_PUBLIC_CONVEX_URL)
- `components/utils.ts` (money/date helpers, DEFAULT_BUCKETS/TAGS)
- `app/(app)/summary/page.tsx` and `app/(app)/inbox/page.tsx` (analytics & inbox flows)
- `components/EntryCard.tsx`, `components/TagChips.tsx` (UI patterns)

---
If you'd like, I can: add a short local Clerk setup snippet (env keys used here), or add a small PR template that enforces the `convex/_generated` regeneration step. Which would you prefer I add next? ✅