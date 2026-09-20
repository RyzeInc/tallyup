# Activity reliability review

## Implemented

This pass follows the reported missing checking-account spending through Activity, transaction editing, and budget updates. It does not claim to reproduce the specific account issue against production data.

- **Complete filtering:** Activity previously applied account, payment-method, and amount filters only to loaded pages. It now loads the selected date range through Convex's native reactive pagination before presenting complete results. Date cursors no longer discard other transactions on the same date, and a sparse match beyond the old 180-row scan cannot terminate the search early.
- **Live transactions:** Native subscriptions replace the append-only ID cache that retained edited/deleted rows. Filtering and sorting run over the complete period; rendering expands in 60-row increments after sorting. Changes to the date range start a fresh subscription.
- **One filter state:** All filter dimensions, multiple selections, and sorting use URL parameters. Editing preserves the current filters. Direct edit links fetch their target independently of the current filters and date range. Clear all includes search, type, and review state.
- **Consistent category matching:** Canonical IDs, legacy names, parent categories, subcategories, uncategorized transactions, and historical categories are supported. Canonical IDs take precedence over obsolete names. Payment labels are never guessed to be account IDs.
- **Usable filters:** Accounts come first with institution and last-four details. Categories, amount, tags, and payment methods have compact expandable sections. Categories are searchable with parent context. Draft changes apply explicitly, Cancel discards them, and the footer remains accessible while options scroll. Native dialog focus handling, Escape, labeled controls, and amount validation are included.
- **Clearer activity:** Search includes titles, canonical category names, accounts, and all tag types. Cards display account identity and transaction titles. Counts and matching transaction amounts cover the entire filtered period. Matching amounts include pending/excluded rows shown in Activity; they are not a budget or posted-cashflow total.
- **Edit propagation:** Removing an account, payment label, title, merchant, note, tags, subcategory, or canonical category sends an explicit clear. Ordinary edits preserve recurring-rule links. Clearing a canonical category also clears its stale legacy labels. Newly inferred budget links schedule recomputation using the updated entry.
- **User isolation:** The public recent-entry query used by recurring backfill is now authenticated and scoped to the caller. It previously read entries across users. No production data was accessed during this review.

## Validation

- All 111 tests pass, including 37 new regression tests exercising production filter helpers, registered query/mutation handlers, the Activity page, the filter dialog, and edit submission.
- Frontend and Convex TypeScript checks pass.
- Desktop (1280 × 900) and mobile (390 × 844) browser checks use the real Activity UI with synthetic transactions and mocked authentication/backend bindings. A checking transaction at row 300 is found, its filter survives reload, categories search and select correctly, and layouts have no horizontal overflow. This is not an authenticated production end-to-end test.
- The production build compiles and type-checks. Prerendering is blocked by the checkout's missing `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. The prebuild script also requires environment variables to be explicitly loaded; it does not load `.env.local` itself.
- Changed application code and new tests pass ESLint. Repository-wide lint reports 19 existing errors in unrelated files.

## Deployment and remaining work

Deploy the Convex changes before, or together with, the frontend: Activity uses the new `entries.listActivityEntries` and `entries.getActivityEntry` queries. No schema migration or data rewrite is required. Existing users' records are not retroactively relinked or reclassified.

Further issues surfaced by this review deserve separate, measured changes:

1. **Shared financial semantics.** Dashboard, budgets, and coaching aggregates have separate rules for pending entries, archived entries, transfers/payments, and exclusion flags. Establish shared predicates and fixtures across these consumers before claiming their totals are interchangeable. `convex/finance_aggregates.ts` also caps several reads at 5,000 rows.
2. **Historical linkage audit.** Transactions with only a freeform payment label remain under “No account assigned.” Determine whether the reported checking account has missing IDs before attempting a migration; duplicate account names make automatic guesses unsafe.
3. **Large-period performance.** Native pagination avoids per-query read limits and silent truncation, but full-period client filtering loads every active transaction in the selected period. Profile accounts with many years of history; server-side indexed filters and aggregate summaries are the next scale improvement.
4. **Retire legacy paths.** The old `listEntriesPaged` endpoint remains for compatibility, but the current Activity page no longer calls it. Remove it and the unused `FilterBar` once older clients are retired.
5. **Build and test baseline.** Repair Clerk environment validation and existing lint failures. Older finance tests often reproduce logic inside mock classes rather than invoking the production functions; expand the real-handler tests used in this pass.

The deployed account-specific report still needs verification with that user's actual transaction history after rollout.
