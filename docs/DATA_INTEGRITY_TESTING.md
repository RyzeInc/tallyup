# Data Integrity Testing Guide

This document describes how to test the bidirectional data integrity features added to TallyUp.

## Prerequisites

1. Run the development server:
   ```bash
   npm install
   npm run dev
   ```

2. In a separate terminal, run Convex:
   ```bash
   npx convex dev
   ```

3. Make sure you have Clerk auth configured (or mock it for testing).

---

## 1. Testing Recurring Rules ↔ Entries Integrity

### 1.1 Test: Create Recurring Rule with Auto-Generated Entries

**Backend Test (via Convex dashboard):**
```javascript
// In Convex dashboard > Functions > recurring.createRecurringRule
{
  "type": "expense",
  "displayName": "Netflix Subscription",
  "category": "Entertainment",
  "bucket": "Entertainment",
  "amountCents": 1599,
  "cadenceType": "monthly",
  "generateHistoricalEntries": true,
  "historicalStartDate": Date.now() - (90 * 24 * 60 * 60 * 1000), // 3 months ago
  "generateFutureEntries": true,
  "futureMonths": 3
}
```

**Expected Result:**
- A recurring rule is created
- 3 historical entries are generated (one for each past month)
- 3 future expected charges are generated
- Response includes `generatedEntries` and `generatedCharges` counts

### 1.2 Test: Delete Recurring Rule with Cascade Options

**Step 1: Get deletion impact**
```javascript
// In Convex dashboard > Functions > recurring.getRecurringRuleDeletionImpact
{
  "id": "<rule_id>"
}
```

**Expected Result:**
- Returns `linkedEntriesCount`, `totalLinkedCents`, `upcomingChargesCount`

**Step 2: Delete with different options**

Option A - Unlink entries (default):
```javascript
// recurring.deleteRecurringRule
{
  "id": "<rule_id>",
  "unlinkEntries": true,
  "deleteExpectedCharges": true
}
```
Result: Rule deleted, entries still exist but with `recurringRuleId: undefined`

Option B - Delete linked entries:
```javascript
// recurring.deleteRecurringRule
{
  "id": "<rule_id>",
  "deleteLinkedEntries": true,
  "deleteExpectedCharges": true
}
```
Result: Rule and all linked entries are deleted

---

## 2. Testing Entry Deletion Warnings

### 2.1 Test: Get Entry Deletion Impact

**Backend Test:**
```javascript
// In Convex dashboard > Functions > entries.getEntryDeletionImpact
{
  "id": "<entry_id_linked_to_recurring_rule>"
}
```

**Expected Result:**
```json
{
  "hasRecurringRule": true,
  "recurringRuleName": "Netflix Subscription",
  "recurringRuleId": "...",
  "linkedEntriesInRule": 5,
  "hasGoal": false,
  "hasBudgetCategory": true,
  "hasTransferPair": false,
  "amountCents": 1599
}
```

### 2.2 Test: Delete Entry with Cleanup

**Scenario A: Entry linked to recurring rule**
```javascript
// entries.deleteEntry
{
  "id": "<entry_id>",
  "unlinkFromRecurringRule": true
}
```
Result: Entry deleted, any `expectedCharges` with `matchedEntryId` pointing to this entry are updated to state "missed"

**Scenario B: Entry that is part of a transfer**
Result: Both entries in the transfer pair are deleted, along with the transfer record

---

## 3. Testing Goals ↔ Account/Income Linking

### 3.1 Test: Create Goal with Funding Configuration

**Backend Test:**
```javascript
// In Convex dashboard > Functions > goals.createGoal
{
  "name": "Emergency Fund",
  "goalType": "savings",
  "targetAmountCents": 1000000,
  "fundingAccountId": "<account_id>",
  "fundingIncomeCategories": ["Side Gig", "Freelance"],
  "autoAllocatePercent": 20,
  "autoAllocateEnabled": true
}
```

**Expected Result:**
- Goal created with funding configuration
- `getGoalsForIncomeCategory({ category: "Side Gig" })` returns this goal

### 3.2 Test: Get Goals for Income Category

```javascript
// goals.getGoalsForIncomeCategory
{
  "category": "Side Gig"
}
```

**Expected Result:**
- Returns all active goals with auto-allocation enabled that include "Side Gig" in `fundingIncomeCategories`

### 3.3 Test: Delete Goal with Cascade

**Step 1: Get deletion impact**
```javascript
// goals.getGoalDeletionImpact
{
  "id": "<goal_id>"
}
```

**Expected Result:**
```json
{
  "goalName": "Emergency Fund",
  "currentAmountCents": 50000,
  "targetAmountCents": 1000000,
  "contributionsCount": 5,
  "totalContributedCents": 50000,
  "linkedEntriesCount": 3,
  "hasFundingAccount": true,
  "hasFundingCategories": true
}
```

**Step 2: Delete the goal**
```javascript
// goals.deleteGoal
{
  "id": "<goal_id>",
  "unlinkEntries": true
}
```

**Expected Result:**
- Goal deleted
- All `goalContributions` records deleted
- Entries with `goalId` pointing to this goal have `goalId: undefined`

---

## 4. Testing Budget Category Integrity

### 4.1 Test: Get Budget Category Deletion Impact

```javascript
// budgets.getBudgetCategoryDeletionImpact
{
  "id": "<budget_category_id>"
}
```

**Expected Result:**
```json
{
  "categoryName": "Groceries",
  "budgetAmountCents": 50000,
  "linkedEntriesCount": 42,
  "totalSpentCents": 35000,
  "groupMembershipsCount": 1,
  "entryImpactsCount": 42
}
```

### 4.2 Test: Archive Budget Category with Cleanup

```javascript
// budgets.archiveBudgetCategory
{
  "id": "<budget_category_id>",
  "clearEntryLinks": true
}
```

**Expected Result:**
- Category archived
- `budgetGroupMembers` records referencing this category deleted
- Entries with `budgetCategoryId` pointing to this category have `budgetCategoryId: undefined`

### 4.3 Test: Permanent Delete Budget Category

```javascript
// budgets.deleteBudgetCategory
{
  "id": "<budget_category_id>"
}
```

**Expected Result:**
- Category deleted
- Group memberships deleted
- Budget entry impacts deleted
- Entry links cleared

---

## 5. Testing Account Deletion Cascade

### 5.1 Test: Permanent Delete Account

```javascript
// accounts.permanentDeleteAccount
{
  "id": "<account_id>",
  "force": true  // Required for Plaid-linked accounts
}
```

**Expected Result:**
- Account deleted
- All entries with this `accountId` deleted
- Account snapshots deleted
- Plaid account records deleted
- Goals with `fundingAccountId` pointing to this account have it cleared
- Investments with this `accountId` have it cleared
- Category rules with `matchAccountId` pointing to this account have it cleared

---

## 6. UI Component Testing

### 6.1 Test: DeletionWarningDialog

Import and use the component:
```tsx
import DeletionWarningDialog, {
  buildEntryDeletionImpact,
  buildGoalDeletionImpact,
  buildRecurringRuleDeletionImpact,
  buildBudgetCategoryDeletionImpact,
} from "@/components/shared/DeletionWarningDialog";

// Example usage in a component
const entryImpact = useQuery(api.entries.getEntryDeletionImpact, { id: entryId });
const displayImpact = buildEntryDeletionImpact(entryImpact, "Coffee Purchase");

<DeletionWarningDialog
  open={showDeleteWarning}
  onClose={() => setShowDeleteWarning(false)}
  onConfirm={handleConfirmDelete}
  impact={displayImpact}
  loading={deleting}
/>
```

### 6.2 Test: GoalFundingModal

```tsx
import GoalFundingModal from "@/components/shared/GoalFundingModal";

<GoalFundingModal
  goalId={goal._id}
  goalName={goal.name}
  currentFundingAccountId={goal.fundingAccountId}
  currentFundingCategories={goal.fundingIncomeCategories}
  currentAutoAllocatePercent={goal.autoAllocatePercent}
  currentAutoAllocateEnabled={goal.autoAllocateEnabled}
  onClose={() => setShowFundingModal(false)}
  onSaved={() => refetchGoals()}
/>
```

---

## 7. Manual End-to-End Testing Checklist

### Recurring Rules
- [ ] Create a recurring rule from an existing entry via RecurringModal
- [ ] Verify entries are linked to the rule
- [ ] Delete the recurring rule
- [ ] Verify linked entries are unlinked (not deleted) by default
- [ ] Verify expected charges are deleted

### Goals
- [ ] Create a goal with funding configuration via GoalFundingModal
- [ ] Link an account and income categories
- [ ] Enable auto-allocation
- [ ] Verify `getGoalsForIncomeCategory` returns the goal
- [ ] Delete the goal
- [ ] Verify linked entries are unlinked
- [ ] Verify contributions are deleted

### Budget Categories
- [ ] Create a budget category
- [ ] Track some expenses against it
- [ ] Archive the category
- [ ] Verify entries are unlinked
- [ ] Permanently delete a different category
- [ ] Verify all related data is cleaned up

### Accounts
- [ ] Create a manual account
- [ ] Log some entries to it
- [ ] Create a goal funded by this account
- [ ] Delete the account
- [ ] Verify entries are deleted
- [ ] Verify goal's fundingAccountId is cleared

### Entries
- [ ] Create an entry linked to a recurring rule
- [ ] View deletion impact before deleting
- [ ] Delete the entry
- [ ] Verify expected charges are updated (matched → missed)

---

## Troubleshooting

### Issue: Convex codegen fails
```bash
npx convex codegen --typecheck=disable
```
Then fix any TypeScript errors reported.

### Issue: Data not syncing
Check that `NEXT_PUBLIC_CONVEX_URL` is set correctly in your environment.

### Issue: Auth errors
Make sure Clerk is configured and you're signed in when testing mutations.
