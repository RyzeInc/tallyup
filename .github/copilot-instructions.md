# Copilot / AI Agent Instructions — TallyUp

Actionable notes for AI contributors to be productive immediately.

## Quick Start
```bash
npm install && npm run dev          # Next.js on :3000
npx convex dev                      # Backend (separate terminal) — sets NEXT_PUBLIC_CONVEX_URL
npm run lint && npm run check       # Lint + Convex type-check
npm test                            # Vitest
```
**Critical**: Convex actions (`action`) have no direct DB access — use `ctx.runQuery()`/`ctx.runMutation()`. Clerk auth required for mutations; mock `ctx.auth.getUserIdentity()` for local testing.

## Architecture Overview
| Layer | Location | Key Pattern |
|-------|----------|-------------|
| Web App | `app/(app)/` | Next.js App Router, pages like `dashboard`, `log`, `review`, `recurring` |
| AI Coach | `app/(coach)/`, `convex/coach*.ts`, `lib/coach/` | LLM abstraction with cost guards (`ALPHA_COST_GUARD=true` → mock) |
| Backend | `convex/` | Queries/mutations with `requireUserId()` auth pattern |
| Generated | `convex/_generated/` | **Regenerate with `npx convex dev` after schema changes** |
| Shared UI | `components/` | Client components with `"use client"`, Tailwind classes |

## Core Data Conventions

### Money — Always Integer Cents
```typescript
amountCents: v.number()  // Never floats. Use helpers:
dollarsToCents(99.99)    // → 9999
centsToDollars(9999)     // → 99.99
```

### Timestamps
- `date`: Local-midnight timestamp for event occurrence (used in indexes)
- `createdAt`/`updatedAt`: System timestamps via `Date.now()`
- Helpers in `components/utils.ts`: `yyyymmddToLocalMidnightTs()`, `startOfWeekLocalTs()`

### Auth Pattern (every query/mutation)
```typescript
async function requireUserId(ctx: AuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;  // Clerk subject = userId throughout
}
```

## Key Subsystems

### Entries & Review Flow
- `entries` table: Core transaction events with `type` (expense/income/transfer), `amountCents`, `category`, `needsReview`
- **Inbox flow**: Missing category → `needsReview: true` + `reviewReason: "NEEDS_CATEGORY"` → surfaces in `/review`
- Exclusion flags: `excludeFromTotals`, `excludeFromBudgets`, `excludeFromCashFlow`, `excludeFromRecurring`
- Soft delete: `isArchived` + `archivedAt` (never hard delete)

### Category System
- `convex/categoryCatalog.ts`: Plaid-aligned hierarchical categories (slug → name)
- `convex/categoryResolver.ts`: Resolves category input → `Id<"categories">` (checks slug, name, creates if needed)
- Built-in slugs: `food_and_drink`, `transportation`, `income_wages`, etc.

### Budget System
- `budgetCategories` → `budgetPlans` → `budgetPeriods` (materialized spending)
- `budgetDirtyQueue`: Async recomputation — entry changes enqueue dirty items vs. immediate recompute
- Matching priority in `budgetMatcher.ts`: subcategory slug → category slug → merchant → tags

### Plaid Integration
- Flow: Plaid API → `plaidActions.ts` → `plaidTransactions` table → user review → `entries` table
- `plaidConnections`: Access tokens + sync cursors
- `categoryResolver` maps Plaid categories to internal slugs during import

### Recurring Detection
- `convex/detector.ts`: Groups by `(type, area, category)`, analyzes intervals/amounts
- `recurringRules` table: Matchers with `amountMode`, `amountTolerancePercent`, `cadenceType`
- Auto-link: `addEntry` checks `autolinkEnabled` rules and links matches conservatively

### AI Coach (Alpha)
- Providers: `lib/llm/` abstraction (mock, groq, cloudflare, openai)
- **Cost guard**: `ALPHA_COST_GUARD=true` (default) forces mock provider
- Context packet: `convex/coach_internal.ts` builds BalanceSheet, IncomeProfile, RiskProfile, etc.
- Session state: `coachSessions`, `coachSlots` (tracks asked questions), `coachMemories`

### Coach Context Condensation (Token Management)
The coach system builds rich financial context but must fit within LLM token limits. Key files: `lib/llm/contextBuilder.ts`, `lib/llm/types.ts`.

**Adaptive Depth** (`contextDepth: "minimal" | "standard" | "full"`):
- Computed in `coach_internal.ts` based on user data completeness (has accounts? goals? conversation history?)
- Controls how much detail is serialized:
  - `minimal`: ~100-150 tokens — new users, simple queries
  - `standard`: ~200-350 tokens — active users, most queries  
  - `full`: ~400-600 tokens — complex analysis, power users

**Depth Config** (in `contextBuilder.ts`):
```typescript
DEPTH_CONFIG = {
  minimal: { maxAccounts: 1, maxGoals: 1, maxDebts: 1, maxCategories: 3, includeSecondaryMetrics: false },
  standard: { maxAccounts: 2, maxGoals: 2, maxDebts: 2, maxCategories: 4, includeSecondaryMetrics: true },
  full: { maxAccounts: 3, maxGoals: 3, maxDebts: 3, maxCategories: 5, includeSecondaryMetrics: true },
}
```

**Intent-Gated Sections** — Only include context relevant to the detected domain:
- `debt`: DebtContext + BalanceSheet + Income (for debt-to-income)
- `budgeting`: SpendContext + BalanceSheet + Income
- `savings`: GoalsContext + BalanceSheet + Income
- `investing`: BalanceSheet + RiskProfile + TaxProfile
- `tax`: TaxProfile + Income
- `app_help`: Minimal core only

**Token-Efficient Format** — Stable key=value, no markdown/prose:
```
HEALTH score=healthy concern=high_cc_util opportunity=automate_savings
CF month=Jan2026 inc=5000 exp=4200 net=+800
NW net=+15000 assets=45000 liab=30000
DEBT total=8500 minPay=350 avgAPR=18.5%
```

**Anti-Loop Guards** (`lib/coach/slotLedger.ts`):
- `slotLedger` tracks which intake questions were asked and when
- `DONTASK` line prevents re-asking within cooldown period
- `establishedFacts` provides confirmed info so LLM doesn't ask again
- `frustrationDetectedAt` triggers extra caution mode

## ⚠️ Cross-Entity Synchronization (MANDATORY)

**Every mutation that modifies data MUST consider downstream effects on related entities.** This is non-negotiable for all new features and changes.

### Entity Relationship Map

```
accounts ←──────────────────────────────────────────────────────────┐
    │                                                               │
    ├── accountSnapshots (balance history)                          │
    │                                                               │
    └── entries.accountId ──────────────────────────────────────────┤
                │                                                   │
                ├── goals.currentAmountCents (via goalId)           │
                │                                                   │
                ├── budgetPeriods (via budgetDirtyQueue)            │
                │       ↑                                           │
                │       └── budgetCategories ← budgetPlans          │
                │                                                   │
                └── recurringRules.lastMatchedAt (via autolink)     │
                        │                                           │
                        ├── expectedCharges (forecast)              │
                        │                                           │
                        └── accountScope.accountIds ────────────────┘
```

### Sync Requirements by Entity

| When Creating/Modifying | Must Consider Effects On |
|------------------------|--------------------------|
| **Entry** | Budget periods, Goal progress, Account balance, Recurring autolink, Coach cache |
| **Account** | Entries with `accountId`, Recurring rules with `accountScope`, Balance sheet |
| **Budget Category** | Existing entries matching criteria, Budget plans, Budget periods |
| **Recurring Rule** | Historical entries (backfill), Expected charges (forecast), Entry autolink |
| **Goal** | Entry contributions, Progress calculations |

### Current Sync Patterns (reference `convex/entries.ts`)

When an **entry** is added/updated/deleted:
| Entity | Sync Mechanism | When to Trigger |
|--------|----------------|-----------------|
| Budget periods | `enqueueBudgetDirty()` → `budgetDirtyQueue` | Entry affects expense with `budgetCategoryId` |
| Goal progress | `applyGoalDelta()` → `goals.currentAmountCents` | Entry has `goalId` (contributions) |
| Account balances | `adjustManualAccountBalance()` → `accountSnapshots` | Entry has `accountId` (manual accounts only) |
| Recurring rules | Check `autolinkEnabled` rules | New entry matches pattern |
| Coach context cache | Invalidated via TTL | Any financial data change |

When a **recurring rule** is created (`convex/recurring.ts`):
- **Historical entries**: Optionally backfill past entries matching cadence
- **Expected charges**: Generate future forecast in `expectedCharges` table
- **Budget behavior**: `budgetBehavior.committed` affects budget calculations

When a **budget category** is created (`convex/budgets.ts`):
- **Budget plan**: Auto-creates `budgetPlans` record
- **Plan version**: Creates initial `budgetPlanVersions` record
- **Existing entries**: Should recompute periods for entries matching criteria

When an **account** is created/archived (`convex/accounts.ts`):
- **Initial snapshot**: Creates `accountSnapshots` record
- **Recurring rules**: Rules with `accountScope.accountIds` may need updates
- **Balance sheet**: Coach context packet includes account balances

### Implementation Requirements

1. **Identify all affected entities** before writing any mutation
2. **Use async queues** for expensive recomputations (e.g., `budgetDirtyQueue` pattern)
3. **Respect exclusion flags**: `excludeFromTotals`, `excludeFromBudgets`, `excludeFromCashFlow`
4. **Handle reversals**: Deletes/updates must reverse previous effects (negative deltas)
5. **Skip linked accounts**: Plaid-linked accounts get authoritative balances from sync, not entry changes
6. **Cascade archive operations**: Archiving an entity should consider dependent records

### Example: Entry Update with Full Sync
```typescript
// 1. Reverse old effects
if (oldEntry.goalId) await applyGoalDelta(ctx, userId, oldEntry.goalId, -oldAmount);
if (shouldAffectBudgets(oldEntry)) await enqueueBudgetDirty(ctx, userId, oldEntry.date, oldEntry.budgetCategoryId, "entry_updated");

// 2. Apply new effects  
if (newGoalId) await applyGoalDelta(ctx, userId, newGoalId, newAmount);
if (shouldAffectBudgets(newEntry)) await enqueueBudgetDirty(ctx, userId, newEntry.date, newEntry.budgetCategoryId, "entry_updated");

// 3. Adjust account balance (handles delta calculation internally)
await adjustManualAccountBalance(ctx, userId, accountId, balanceDelta);
```

**PR Review Checkpoint**: Any mutation touching `entries`, `accounts`, `goals`, `budgetCategories`, or `recurringRules` must document which cross-entity syncs are handled.

## Implementation Checklist
1. **Server**: Add Convex queries/mutations following `entries.ts` patterns; validate inputs server-side
2. **Cross-Entity Sync**: Identify and implement all downstream entity updates (see section above)
3. **Regenerate**: Run `npx convex dev` after any `schema.ts` changes
4. **Client**: `useQuery(api.entries.listEntries, {...})` / `useMutation(api.entries.addEntry)`
5. **UI**: Components in `/components`, `"use client"` directive, Tailwind utilities
6. **Tests**: `npm test` (Vitest); unit tests for pure logic, component tests with Testing Library

## Product Principles
- **Event-first**: Preserve raw event details (timestamps, origin, tags). Never collapse into averages that lose provenance.
- **`needsReview` liberally**: Uncertain entries flow to inbox for user labeling
- **Income as unreliable**: Surface volatility (source exposure, streak detection), not smoothed monthly salary
- **Calm UI, loud numbers**: Money/dates are heroes; one primary CTA per screen (see `docs/DESIGN_PRINCIPLES.md`)

## Key Files by Feature
| Feature | Files |
|---------|-------|
| Data model | `convex/schema.ts` |
| Entry CRUD + auth | `convex/entries.ts` |
| Money/date helpers | `components/utils.ts` |
| Category catalog | `convex/categoryCatalog.ts`, `convex/categoryResolver.ts` |
| Budget engine | `convex/budgets.ts`, `convex/budgetEngine.ts`, `convex/budgetMatcher.ts` |
| Plaid sync | `convex/plaid.ts`, `convex/plaidActions.ts`, `docs/PLAID_INTEGRATION.md` |
| AI coach | `convex/coach.ts`, `lib/coach/`, `lib/llm/` |
| Recurring | `convex/recurring.ts`, `convex/detector.ts` |
| UI patterns | `components/EntryCard.tsx`, `components/ui/` |