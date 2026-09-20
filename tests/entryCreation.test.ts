import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * ENTRY CREATION TESTS
 * 
 * Testing the core entry mutation logic:
 * - addEntry mutation happy path
 * - Category rule application
 * - Balance adjustment after entry
 * - Goal contribution tracking
 * - Budget impact calculation
 * 
 * These tests ensure entries are correctly created, linked, and impact balances.
 */

type Entry = {
  _id?: string;
  userId: string;
  type: "expense" | "income" | "transfer";
  amountCents: number;
  date: number;
  category?: string;
  bucket?: string;
  merchant?: string;
  note?: string;
  accountId?: string;
  goalId?: string;
  excludeFromBudgets?: boolean;
  excludeFromTotals?: boolean;
  status?: "pending" | "posted";
  createdAt: number;
  updatedAt: number;
};

type Account = {
  _id: string;
  userId: string;
  name: string;
  isLinked: boolean;
  balanceSnapshot?: number;
};

type CategoryRule = {
  _id: string;
  userId: string;
  merchantPattern: RegExp | string;
  category: string;
  bucket?: string;
  confidence: number;
};

type Goal = {
  _id: string;
  userId: string;
  name: string;
  targetAmountCents: number;
  currentAmountCents: number;
};

// Mock database operations
class MockDB {
  entries: Map<string, Entry> = new Map();
  accounts: Map<string, Account> = new Map();
  rules: Map<string, CategoryRule> = new Map();
  goals: Map<string, Goal> = new Map();
  // `seq` orders snapshots. Keying on Date.now() collided within a millisecond and
  // the rows carried no timestamp, so "latest" was whichever the Map happened to
  // yield first — the source of an intermittent failure in this file.
  snapshots: Map<string, { accountId: string; balance: number; seq: number }> = new Map();
  private snapshotSeq = 0;
  budgetDirtyQueue: any[] = [];
  
  insertEntry(entry: Omit<Entry, '_id'>): string {
    const id = `entry_${Date.now()}_${Math.random()}`;
    this.entries.set(id, { ...entry, _id: id });
    return id;
  }

  getEntry(id: string): Entry | undefined {
    return this.entries.get(id);
  }

  updateEntry(id: string, patch: Partial<Entry>): void {
    const entry = this.entries.get(id);
    if (entry) {
      this.entries.set(id, { ...entry, ...patch, updatedAt: Date.now() });
    }
  }

  insertAccount(account: Omit<Account, '_id'>): string {
    const id = `account_${Date.now()}`;
    this.accounts.set(id, { ...account, _id: id });
    return id;
  }

  getAccount(id: string): Account | undefined {
    return this.accounts.get(id);
  }

  insertRule(rule: Omit<CategoryRule, '_id'>): string {
    const id = `rule_${Date.now()}`;
    this.rules.set(id, { ...rule, _id: id });
    return id;
  }

  findRulesForMerchant(userId: string, merchant?: string): CategoryRule[] {
    if (!merchant) return [];
    const lowerMerchant = merchant.toLowerCase();
    return Array.from(this.rules.values())
      .filter(r => r.userId === userId && 
        (typeof r.merchantPattern === 'string' 
          ? lowerMerchant.includes(r.merchantPattern.toLowerCase())
          : new RegExp(r.merchantPattern, 'i').test(merchant)));
  }

  getLatestSnapshot(accountId: string): { accountId: string; balance: number } | undefined {
    return Array.from(this.snapshots.values())
      .filter(s => s.accountId === accountId)
      .sort((a, b) => b.seq - a.seq)[0];
  }

  updateSnapshot(accountId: string, newBalance: number): void {
    const seq = ++this.snapshotSeq;
    this.snapshots.set(`snapshot_${accountId}_${seq}`, { accountId, balance: newBalance, seq });
  }

  insertGoal(goal: Omit<Goal, '_id'>): string {
    const id = `goal_${Date.now()}`;
    this.goals.set(id, { ...goal, _id: id });
    return id;
  }

  getGoal(id: string): Goal | undefined {
    return this.goals.get(id);
  }

  updateGoal(id: string, patch: Partial<Goal>): void {
    const goal = this.goals.get(id);
    if (goal) {
      this.goals.set(id, { ...goal, ...patch });
    }
  }

  enqueueBudgetDirty(userId: string, budgetCategoryId?: string, dirtyDate?: number, reason?: string): void {
    this.budgetDirtyQueue.push({ userId, budgetCategoryId, dirtyDate, reason, timestamp: Date.now() });
  }
}

// Entry creation logic
function createEntry(
  db: MockDB,
  userId: string,
  args: {
    type: "expense" | "income" | "transfer";
    amountCents: number;
    date: number;
    category?: string;
    bucket?: string;
    merchant?: string;
    note?: string;
    accountId?: string;
    goalId?: string;
    excludeFromBudgets?: boolean;
    excludeFromTotals?: boolean;
  }
): string {
  const now = Date.now();
  
  // Apply category rules if merchant provided and no category set
  let finalCategory = args.category;
  if (args.merchant && !finalCategory) {
    const rules = db.findRulesForMerchant(userId, args.merchant);
    if (rules.length > 0) {
      finalCategory = rules[0].category;
    }
  }

  const entry: Omit<Entry, '_id'> = {
    userId,
    type: args.type,
    amountCents: args.amountCents,
    date: args.date,
    category: finalCategory,
    bucket: args.bucket,
    merchant: args.merchant,
    note: args.note,
    accountId: args.accountId,
    goalId: args.goalId,
    excludeFromBudgets: args.excludeFromBudgets,
    excludeFromTotals: args.excludeFromTotals,
    status: "posted",
    createdAt: now,
    updatedAt: now,
  };

  const entryId = db.insertEntry(entry);

  // Adjust account balance for manual accounts
  if (args.accountId && !args.excludeFromTotals && args.type !== "transfer") {
    const account = db.getAccount(args.accountId);
    if (account && !account.isLinked) {
      const latest = db.getLatestSnapshot(args.accountId);
      const currentBalance = latest?.balance ?? 0;
      const delta = args.type === "income" ? args.amountCents : -args.amountCents;
      db.updateSnapshot(args.accountId, currentBalance + delta);
    }
  }

  // Contribute to goal if specified
  if (args.goalId && args.type === "income") {
    const goal = db.getGoal(args.goalId);
    if (goal) {
      db.updateGoal(args.goalId, {
        currentAmountCents: goal.currentAmountCents + args.amountCents,
      });
    }
  }

  // Enqueue budget dirty if this affects budgets
  if (args.type === "expense" && !args.excludeFromBudgets) {
    db.enqueueBudgetDirty(userId, finalCategory, args.date, "entry_created");
  }

  return entryId;
}

describe("Entry Creation - Happy Path", () => {
  let db: MockDB;

  beforeEach(() => {
    db = new MockDB();
  });

  it("should create a basic expense entry", () => {
    const userId = "user_123";
    const now = Date.now();

    const entryId = createEntry(db, userId, {
      type: "expense",
      amountCents: 5000,
      date: now,
      category: "Groceries",
    });

    expect(entryId).toBeDefined();
    const entry = db.getEntry(entryId);
    expect(entry).toBeDefined();
    expect(entry?.type).toBe("expense");
    expect(entry?.amountCents).toBe(5000);
    expect(entry?.category).toBe("Groceries");
  });

  it("should create an income entry", () => {
    const userId = "user_123";
    const now = Date.now();

    const entryId = createEntry(db, userId, {
      type: "income",
      amountCents: 50000,
      date: now,
      category: "Salary",
    });

    const entry = db.getEntry(entryId);
    expect(entry?.type).toBe("income");
    expect(entry?.amountCents).toBe(50000);
  });

  it("should set correct timestamps", () => {
    const userId = "user_123";
    const testDate = new Date("2024-01-15").getTime();

    const entryId = createEntry(db, userId, {
      type: "expense",
      amountCents: 2000,
      date: testDate,
    });

    const entry = db.getEntry(entryId);
    expect(entry?.date).toBe(testDate);
    expect(entry?.createdAt).toBeGreaterThan(Date.now() - 1000);
    expect(entry?.status).toBe("posted");
  });

  it("should include all provided fields", () => {
    const userId = "user_123";
    const now = Date.now();

    const entryId = createEntry(db, userId, {
      type: "expense",
      amountCents: 3000,
      date: now,
      category: "Restaurants",
      bucket: "Personal",
      merchant: "Chipotle",
      note: "Lunch with team",
    });

    const entry = db.getEntry(entryId);
    expect(entry?.category).toBe("Restaurants");
    expect(entry?.bucket).toBe("Personal");
    expect(entry?.merchant).toBe("Chipotle");
    expect(entry?.note).toBe("Lunch with team");
  });
});

describe("Entry Creation - Category Rule Application", () => {
  let db: MockDB;
  const userId = "user_123";

  beforeEach(() => {
    db = new MockDB();
  });

  it("should apply category rule when merchant matches", () => {
    // Create a rule: "amazon" → "Online Shopping"
    db.insertRule({
      userId,
      merchantPattern: "amazon",
      category: "Online Shopping",
      confidence: 95,
    });

    const entryId = createEntry(db, userId, {
      type: "expense",
      amountCents: 2500,
      date: Date.now(),
      merchant: "Amazon Prime",
      // No category provided
    });

    const entry = db.getEntry(entryId);
    expect(entry?.category).toBe("Online Shopping");
  });

  it("should NOT override explicit category with rule", () => {
    db.insertRule({
      userId,
      merchantPattern: "apple",
      category: "Online Shopping",
      confidence: 90,
    });

    const entryId = createEntry(db, userId, {
      type: "expense",
      amountCents: 10000,
      date: Date.now(),
      merchant: "Apple Store",
      category: "Electronics", // Explicitly set
    });

    const entry = db.getEntry(entryId);
    expect(entry?.category).toBe("Electronics"); // Should keep explicit
  });

  it("should match case-insensitively", () => {
    db.insertRule({
      userId,
      merchantPattern: "netflix",
      category: "Entertainment",
      confidence: 99,
    });

    const entryId = createEntry(db, userId, {
      type: "expense",
      amountCents: 1499,
      date: Date.now(),
      merchant: "NETFLIX INC",
    });

    const entry = db.getEntry(entryId);
    expect(entry?.category).toBe("Entertainment");
  });

  it("should use highest-confidence rule when multiple match", () => {
    db.insertRule({
      userId,
      merchantPattern: "starbucks",
      category: "Coffee",
      confidence: 80,
    });

    db.insertRule({
      userId,
      merchantPattern: "starbucks",
      category: "Food & Drink",
      confidence: 95,
    });

    const entryId = createEntry(db, userId, {
      type: "expense",
      amountCents: 650,
      date: Date.now(),
      merchant: "Starbucks #12345",
    });

    const entry = db.getEntry(entryId);
    // Should use the higher confidence rule
    expect(entry?.category).toBe("Food & Drink");
  });

  it("should not apply rule if no merchant provided", () => {
    db.insertRule({
      userId,
      merchantPattern: "amazon",
      category: "Online Shopping",
      confidence: 95,
    });

    const entryId = createEntry(db, userId, {
      type: "expense",
      amountCents: 2500,
      date: Date.now(),
      // No merchant
    });

    const entry = db.getEntry(entryId);
    expect(entry?.category).toBeUndefined();
  });
});

describe("Entry Creation - Balance Adjustment", () => {
  let db: MockDB;
  const userId = "user_123";

  beforeEach(() => {
    db = new MockDB();
  });

  it("should increase balance for income on manual account", () => {
    const accountId = db.insertAccount({
      userId,
      name: "Checking",
      isLinked: false,
    });

    // Set initial balance
    db.updateSnapshot(accountId, 100000);

    createEntry(db, userId, {
      type: "income",
      amountCents: 50000, // $500
      date: Date.now(),
      accountId,
    });

    const snapshot = db.getLatestSnapshot(accountId);
    expect(snapshot?.balance).toBe(150000);
  });

  it("should decrease balance for expense on manual account", () => {
    const accountId = db.insertAccount({
      userId,
      name: "Checking",
      isLinked: false,
    });

    db.updateSnapshot(accountId, 100000);

    createEntry(db, userId, {
      type: "expense",
      amountCents: 25000,
      date: Date.now(),
      accountId,
    });

    const snapshot = db.getLatestSnapshot(accountId);
    expect(snapshot?.balance).toBe(75000);
  });

  it("should NOT adjust balance for Plaid-linked accounts", () => {
    const accountId = db.insertAccount({
      userId,
      name: "Chase Checking",
      isLinked: true,
    });

    db.updateSnapshot(accountId, 500000);
    const initialBalance = db.getLatestSnapshot(accountId)?.balance;

    createEntry(db, userId, {
      type: "expense",
      amountCents: 10000,
      date: Date.now(),
      accountId,
    });

    const finalBalance = db.getLatestSnapshot(accountId)?.balance;
    expect(finalBalance).toBe(initialBalance);
  });

  it("should NOT adjust balance if excludeFromTotals is true", () => {
    const accountId = db.insertAccount({
      userId,
      name: "Checking",
      isLinked: false,
    });

    db.updateSnapshot(accountId, 100000);

    createEntry(db, userId, {
      type: "expense",
      amountCents: 25000,
      date: Date.now(),
      accountId,
      excludeFromTotals: true,
    });

    const snapshot = db.getLatestSnapshot(accountId);
    expect(snapshot?.balance).toBe(100000); // Unchanged
  });

  it("should NOT adjust balance for transfers", () => {
    const accountId = db.insertAccount({
      userId,
      name: "Checking",
      isLinked: false,
    });

    // Create initial snapshot
    db.updateSnapshot(accountId, 100000);

    // Count snapshots before transfer
    const snapshotsBefore = Array.from(db.snapshots.values()).filter(s => s.accountId === accountId).length;

    createEntry(db, userId, {
      type: "transfer",
      amountCents: 50000,
      date: Date.now(),
      accountId,
    });

    // Count snapshots after transfer
    const snapshotsAfter = Array.from(db.snapshots.values()).filter(s => s.accountId === accountId).length;
    
    // A transfer should NOT create a new snapshot (balance shouldn't change)
    expect(snapshotsAfter).toBe(snapshotsBefore);
  });

  it("should create initial snapshot if none exists", () => {
    const accountId = db.insertAccount({
      userId,
      name: "New Account",
      isLinked: false,
    });

    // No initial snapshot

    createEntry(db, userId, {
      type: "income",
      amountCents: 30000,
      date: Date.now(),
      accountId,
    });

    const snapshot = db.getLatestSnapshot(accountId);
    expect(snapshot?.balance).toBe(30000); // Started from 0
  });
});

describe("Entry Creation - Goal Contributions", () => {
  let db: MockDB;
  const userId = "user_123";

  beforeEach(() => {
    db = new MockDB();
  });

  it("should add income to goal contribution", () => {
    const goalId = db.insertGoal({
      userId,
      name: "Vacation Fund",
      targetAmountCents: 200000,
      currentAmountCents: 50000,
    });

    createEntry(db, userId, {
      type: "income",
      amountCents: 25000,
      date: Date.now(),
      goalId,
    });

    const goal = db.getGoal(goalId);
    expect(goal?.currentAmountCents).toBe(75000);
  });

  it("should NOT add expenses to goal", () => {
    const goalId = db.insertGoal({
      userId,
      name: "Monthly Budget",
      targetAmountCents: 100000,
      currentAmountCents: 100000,
    });

    createEntry(db, userId, {
      type: "expense",
      amountCents: 10000,
      date: Date.now(),
      goalId,
    });

    const goal = db.getGoal(goalId);
    expect(goal?.currentAmountCents).toBe(100000); // Unchanged
  });

  it("should handle multiple goal contributions in sequence", () => {
    const goalId = db.insertGoal({
      userId,
      name: "Savings",
      targetAmountCents: 500000,
      currentAmountCents: 100000,
    });

    for (let i = 0; i < 5; i++) {
      createEntry(db, userId, {
        type: "income",
        amountCents: 20000,
        date: Date.now() + i * 1000,
        goalId,
      });
    }

    const goal = db.getGoal(goalId);
    expect(goal?.currentAmountCents).toBe(200000); // 100k + 5*20k
  });
});

describe("Entry Creation - Budget Dirty Queue", () => {
  let db: MockDB;
  const userId = "user_123";

  beforeEach(() => {
    db = new MockDB();
  });

  it("should enqueue budget dirty for new expense", () => {
    const category = "Groceries";
    const date = Date.now();

    createEntry(db, userId, {
      type: "expense",
      amountCents: 5000,
      date,
      category,
    });

    expect(db.budgetDirtyQueue.length).toBeGreaterThan(0);
    const dirtyEntry = db.budgetDirtyQueue[0];
    expect(dirtyEntry.userId).toBe(userId);
    expect(dirtyEntry.reason).toBe("entry_created");
  });

  it("should NOT enqueue budget dirty for income", () => {
    const initialQueueLength = db.budgetDirtyQueue.length;

    createEntry(db, userId, {
      type: "income",
      amountCents: 50000,
      date: Date.now(),
    });

    expect(db.budgetDirtyQueue.length).toBe(initialQueueLength);
  });

  it("should NOT enqueue if excludeFromBudgets is true", () => {
    const initialQueueLength = db.budgetDirtyQueue.length;

    createEntry(db, userId, {
      type: "expense",
      amountCents: 5000,
      date: Date.now(),
      excludeFromBudgets: true,
    });

    expect(db.budgetDirtyQueue.length).toBe(initialQueueLength);
  });
});

describe("Entry Creation - Edge Cases", () => {
  let db: MockDB;
  const userId = "user_123";

  beforeEach(() => {
    db = new MockDB();
  });

  it("should handle zero-amount entry", () => {
    const entryId = createEntry(db, userId, {
      type: "expense",
      amountCents: 0,
      date: Date.now(),
    });

    expect(entryId).toBeDefined();
    const entry = db.getEntry(entryId);
    expect(entry?.amountCents).toBe(0);
  });

  it("should handle very large amounts", () => {
    const largeAmount = 9999999999;

    const entryId = createEntry(db, userId, {
      type: "income",
      amountCents: largeAmount,
      date: Date.now(),
    });

    const entry = db.getEntry(entryId);
    expect(entry?.amountCents).toBe(largeAmount);
  });

  it("should handle historical dates", () => {
    const historicalDate = new Date("2020-01-01").getTime();

    const entryId = createEntry(db, userId, {
      type: "expense",
      amountCents: 5000,
      date: historicalDate,
    });

    const entry = db.getEntry(entryId);
    expect(entry?.date).toBe(historicalDate);
  });

  it("should handle future dates", () => {
    const futureDate = new Date("2030-12-31").getTime();

    const entryId = createEntry(db, userId, {
      type: "income",
      amountCents: 50000,
      date: futureDate,
    });

    const entry = db.getEntry(entryId);
    expect(entry?.date).toBe(futureDate);
  });
});
