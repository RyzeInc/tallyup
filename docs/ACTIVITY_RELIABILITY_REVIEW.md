# Financial data consistency review

Two passes. The first (`7452ad2`) rebuilt Activity's pagination, filtering, and
filter UI. This one audits the data layer underneath it: what each screen counts
as money, and whether a change in one place reaches the others.

## What was actually wrong

The app had **six independent implementations of "which transactions count"** —
`lib/finance/semantics.ts`, `convex/finance_aggregates.ts`,
`convex/dashboard.ts`, `convex/budgetEngine.ts`, `convex/accountability.ts`, and
the Insights page. They disagreed, so the same transaction could appear in one
total and not another. That is the root of "nothing is synced to one another",
and every item below is a symptom of it.

### Live breakages on `main`

- **The dashboard threw on every load.** `app/(app)/dashboard/page.tsx` sent
  `prevPeriodStart` / `prevPeriodEnd` to `dashboard.getDashboardData`, whose
  validator did not declare them. Convex rejects unknown arguments, so the whole
  bundle — safe-to-spend, upcoming bills, payday, budget rings, period
  comparison — failed. The query now accepts and uses the caller's comparison
  window, so Dashboard deltas match the period Insights shows.
- **Archiving released nothing.** Soft-deleted transactions still counted in
  dashboard totals, budget spend, the review count, the coach's income and
  expense picture, gig earnings, and the accountability check. Archiving an
  account archives its transactions, so archiving an account changed none of
  those numbers. Every consumer now applies the same archive gate.
- **Account-linked transactions were flagged "Needs account".** `getReviewReason`
  only looked at `methodOrAccount`. The main logging flow sets `accountId` and
  never sets that field, so entries with a real account attached carried
  `NEEDS_ACCOUNT` forever. The review screen worked around it by writing the
  account's *name* into the payment-method field, which is why payment methods
  and account names are duplicated in filter lists.
- **Account filters missed real spending.** A transaction carrying only a payment
  label — older data, and anything the review flow touched — never matched a
  filter on its account. This is the reported bug. Activity now resolves an
  entry's account by link first and by unambiguous label second; a name shared by
  two accounts is deliberately left unresolved rather than guessed.

### Disagreements between screens

- Pending charges counted as posted spending in dashboard period totals *and*
  again in the pending line, double-counting them.
- Refunds increased expenses in the coach aggregates while reducing them in
  budgets.
- The budget engine ignored `ignoredForBudgets`, which the schema exposes and
  transfers set.

### Durability and scale

- `goals.ts`, `budgets.ts`, and `categories.ts` filtered `entries` without an
  index, scanning the whole table across every user. They now use
  `by_user_goal`, `by_user_budget`, and a new `by_user_category`.
- Every transaction create, edit, and delete appended an `accountSnapshots` row,
  so balance history grew without bound and read as a step per edit. Snapshots
  now record their `source`: balances the user reported are history and are never
  rewritten; the running balance derived from transactions is one moving row.
- A failing `budgetDirtyQueue` row was requeued forever, once a minute.
  Attempts are counted and a poisoned row is parked as `failed`; completed rows
  are deleted instead of accumulating.
- Archiving a category left the stale legacy label and subcategory pointer on its
  transactions, so they stayed filterable under a category that no longer exists.

## Validation

- 150 tests pass, six consecutive full runs. The previous pass reported 111
  passing; one was in fact failing (a mock missing `.collect()`), so the
  shared-effects path it covered was never exercised, and a second keyed mock
  snapshots on `Date.now()` and failed whenever two writes did not land in the
  same millisecond. Both are repaired and 39 tests were added.
- `tests/queryArgContracts.test.ts` reads every real `useQuery(api.x.y, {...})`
  call site and checks each argument against the deployed validator. It
  reproduces the dashboard breakage when the fix is reverted, which is the class
  of bug that caused it.
- Frontend and Convex TypeScript both pass. The frontend check did **not** pass
  before this pass — it reported the dashboard argument error.
- Changed files are lint-clean. 19 pre-existing errors remain in unrelated files.

## Deployment

Deploy Convex with the frontend. Three additive schema changes:
`entries.by_user_category`, `accountSnapshots.source`, and
`budgetDirtyQueue.attempts` / `lastError` / `failed`. No data rewrite is
required; existing snapshots without a `source` are treated as reported balances,
which is the safe reading.

Budget periods recompute through the dirty queue, so **budget spend will not drop
for already-archived transactions until something touches those categories
again**. Run a recompute over affected periods after deploying if the numbers
need to be right immediately.

## Not done

1. **Historical account links.** Activity now *finds* label-only transactions,
   but they still have no `accountId`, so account pages and balances do not see
   them. `migrations:reportAccountLinkBackfill` shows what would link for a user
   and `migrations:backfillAccountLinksFromLabels` applies it. Run the report
   first. It deliberately does not rewrite balances: those entries never reached
   a snapshot, so they are recorded as having had no balance impact and a later
   edit will not double-count them. Re-enter the account's current balance
   afterwards if it needs correcting.
2. **Stale review flags.** The rule is fixed, but transactions already stored as
   "Needs account" keep that flag until they are edited.
   `migrations:repairAccountReviewFlags` reports how many would clear and applies
   it with `{"apply":true}`. It only clears entries whose reason is now genuinely
   empty.
3. **Time zones.** Entry dates are local midnight, but
   `finance_aggregates.getMonthBounds` builds month boundaries in UTC. This is
   correct for negative UTC offsets and shifts the first of the month for
   positive ones. Fixing it properly needs a stored user time zone;
   `userBudgetPrefs.timezone` exists but is not read here.
4. **Silent truncation.** `finance_aggregates` still caps reads at 5,000 rows per
   window with no indication when it truncates.
5. **Retire legacy paths.** `entries.listEntriesPaged` and `FilterBar` are unused
   by current screens. `plaid` and `react-plaid-link` are still in
   `package.json` after Plaid was removed.
6. **Build baseline.** `npm run build` still stops on missing
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. `npm run check` did not run the frontend
   TypeScript check, which is why the dashboard breakage shipped; it now does,
   via a new `type:web` script. `check` still fails overall on the 19
   pre-existing lint errors.

No production data was accessed. The reported account still needs verification
against real history after rollout.
