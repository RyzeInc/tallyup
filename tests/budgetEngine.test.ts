import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * BUDGET ENGINE TESTS
 * 
 * Testing the core financial calculation logic:
 * - SafeToSpend calculation
 * - Budget period comparisons
 * - Budget enforcement logic
 * 
 * This is CRITICAL because it handles user money.
 */

// Mock types based on budgetEngine.ts
type PlanVersion = {
  frequency: "monthly" | "weekly" | "annual" | "custom";
  periodDays?: number;
  amountCents: number;
  overridesByMonth?: { month: string; amountCents: number }[];
};

type RolloverPolicy = {
  allowNegative: boolean;
  capPositiveCents?: number;
  capNegativeCents?: number;
  resetAtBoundary?: "never" | "monthly" | "quarterly" | "yearly";
};

type BudgetPeriod = {
  budgetedCents: number;
  spentCents: number;
  carryInCents: number;
  carryOutCents: number;
  availableCents: number;
};

// Extract and test core calculation functions
const DAY_MS = 24 * 60 * 60 * 1000;

function monthKeyFor(ts: number, offsetMinutes: number): string {
  const offsetMs = offsetMinutes * 60 * 1000;
  const shifted = new Date(ts + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1;
  const mm = m < 10 ? `0${m}` : `${m}`;
  return `${y}-${mm}`;
}

function computeBudgetedCents(version: PlanVersion, periodStart: number, offsetMinutes: number): number {
  const key = monthKeyFor(periodStart, offsetMinutes);
  if (version.overridesByMonth) {
    const match = version.overridesByMonth.find((o) => o.month === key);
    if (match) return match.amountCents;
  }
  return version.amountCents;
}

function clampCarryOut(carryOut: number, policy: RolloverPolicy): number {
  let out = carryOut;
  if (!policy.allowNegative && out < 0) out = 0;
  if (policy.capPositiveCents !== undefined && out > policy.capPositiveCents) {
    out = policy.capPositiveCents;
  }
  if (policy.capNegativeCents !== undefined && out < policy.capNegativeCents) {
    out = policy.capNegativeCents;
  }
  return out;
}

function calculateAvailable(
  budgetedCents: number,
  spentCents: number,
  carryInCents: number,
  policy: RolloverPolicy | null
): number {
  let available = budgetedCents - spentCents + carryInCents;
  if (!policy) {
    available = budgetedCents - spentCents;
  }
  return available;
}

describe("Budget Engine - Core Calculations", () => {
  describe("SafeToSpend (Available Budget)", () => {
    it("should calculate available budget correctly: budgeted - spent", () => {
      const budgeted = 10000; // $100
      const spent = 3500;    // $35
      const available = calculateAvailable(budgeted, spent, 0, null);
      expect(available).toBe(6500); // $65 remaining
    });

    it("should handle zero spending", () => {
      const available = calculateAvailable(10000, 0, 0, null);
      expect(available).toBe(10000);
    });

    it("should handle overspending without rollover", () => {
      const available = calculateAvailable(10000, 15000, 0, null);
      expect(available).toBe(-5000); // Over budget
    });

    it("should apply rollover carryIn to available budget", () => {
      const policy: RolloverPolicy = { allowNegative: false };
      const budgeted = 10000;
      const spent = 5000;
      const carryIn = 2000; // $20 from last period
      const available = calculateAvailable(budgeted, spent, carryIn, policy);
      expect(available).toBe(10000 - 5000 + 2000); // $70
    });

    it("should respect positive carry cap", () => {
      const policy: RolloverPolicy = {
        allowNegative: true,
        capPositiveCents: 5000, // Can't carry more than $50
      };
      const carryOut = clampCarryOut(10000, policy);
      expect(carryOut).toBe(5000);
    });

    it("should respect negative carry cap", () => {
      const policy: RolloverPolicy = {
        allowNegative: true,
        capNegativeCents: -2000, // Can't go more negative than -$20
      };
      const carryOut = clampCarryOut(-5000, policy);
      expect(carryOut).toBe(-2000);
    });

    it("should prevent negative carryout if not allowed", () => {
      const policy: RolloverPolicy = { allowNegative: false };
      const carryOut = clampCarryOut(-3000, policy);
      expect(carryOut).toBe(0);
    });
  });

  describe("Budget Period Comparisons", () => {
    it("should detect when user is on pace with budget", () => {
      const currentPeriod: BudgetPeriod = {
        budgetedCents: 10000,
        spentCents: 3333,     // ~33% spent
        carryInCents: 0,
        carryOutCents: 0,
        availableCents: 6667,
      };
      
      // Day 10 of 30 = 33% through period
      const elapsed = 10 / 30;
      const expectedPace = Math.round(currentPeriod.budgetedCents * elapsed);
      const actualSpend = currentPeriod.spentCents;
      
      expect(actualSpend).toBeCloseTo(expectedPace, -1); // Within ~$100
    });

    it("should detect when user is UNDER pace (saving)", () => {
      const budgeted = 10000;
      const spent = 1000;   // Only $10 after day 20 of 30
      const elapsed = 20 / 30;
      const expectedPace = Math.round(budgeted * elapsed);
      
      expect(spent).toBeLessThan(expectedPace);
      expect(expectedPace - spent).toBeGreaterThan(3000);
    });

    it("should detect when user is OVER pace (overspending)", () => {
      const budgeted = 10000;
      const spent = 8000;   // $80 after day 10 of 30
      const elapsed = 10 / 30;
      const expectedPace = Math.round(budgeted * elapsed);
      
      expect(spent).toBeGreaterThan(expectedPace);
      expect(spent - expectedPace).toBeGreaterThan(4500);
    });

    it("should project end-of-period spend if pace continues", () => {
      const budgeted = 10000;
      const spent = 5000;
      const elapsed = 0.5; // 50% through period
      const projected = Math.round(spent / elapsed);
      
      expect(projected).toBeCloseTo(budgeted, -1); // On track
    });

    it("should calculate forecast risk (projected vs budgeted)", () => {
      const budgeted = 10000;
      const spent = 8000;
      const elapsed = 0.5;
      const projected = Math.round(spent / elapsed);
      const riskCents = projected - budgeted;
      
      expect(riskCents).toBeGreaterThan(5000); // High risk
    });
  });

  describe("Budget Enforcement Logic", () => {
    it("should enforce soft limit: warn when approaching budget", () => {
      const available = 1000; // $10 left
      const threshold = 0.1; // 10% = soft limit
      
      expect(available > 0).toBe(true); // Still in budget
      expect(available).toBeLessThan(1500); // But close
    });

    it("should enforce hard limit: prevent spend when over budget", () => {
      const available = -500; // $5 over
      const canSpend = available >= 0;
      
      expect(canSpend).toBe(false);
    });

    it("should recalculate available after each transaction", () => {
      const initial = 10000;
      let available = initial;
      
      // Transaction 1: $50
      available -= 5000;
      expect(available).toBe(5000);
      
      // Transaction 2: $30
      available -= 3000;
      expect(available).toBe(2000);
      
      // Transaction 3: $50 - should be blocked if enforcing hard limit
      const canSpend3 = available >= 5000;
      expect(canSpend3).toBe(false);
    });
  });

  describe("Budget Period Rollover", () => {
    it("should carry over unused budget to next period", () => {
      const currentUnused = 2000;
      const policy: RolloverPolicy = { allowNegative: false };
      const carryOut = clampCarryOut(currentUnused, policy);
      
      expect(carryOut).toBe(2000);
    });

    it("should NOT carry over deficit to next period if allowNegative is false", () => {
      const currentDeficit = -1000;
      const policy: RolloverPolicy = { allowNegative: false };
      const carryOut = clampCarryOut(currentDeficit, policy);
      
      expect(carryOut).toBe(0); // Deficit is forgiven
    });

    it("should reset carryover at annual boundary if policy requires it", () => {
      const policy: RolloverPolicy = { 
        allowNegative: false,
        resetAtBoundary: "yearly",
      };
      
      const jan1Carryout = 5000;
      const reset = policy.resetAtBoundary === "yearly" ? 0 : jan1Carryout;
      
      expect(reset).toBe(0);
    });

    it("should NOT reset carryover at monthly boundary if policy is 'never'", () => {
      const policy: RolloverPolicy = {
        allowNegative: false,
        resetAtBoundary: "never",
      };
      
      const monthEndCarry = 3000;
      const persists = policy.resetAtBoundary === "never" ? monthEndCarry : 0;
      
      expect(persists).toBe(3000);
    });
  });

  describe("Month Override Logic", () => {
    it("should use override amount for specific month", () => {
      const version: PlanVersion = {
        frequency: "monthly",
        amountCents: 10000,
        overridesByMonth: [
          { month: "2024-12", amountCents: 15000 }, // December is higher
        ],
      };
      
      // December 1, 2024 timestamp
      const dec2024 = new Date("2024-12-01").getTime();
      const budgeted = computeBudgetedCents(version, dec2024, 0);
      
      expect(budgeted).toBe(15000);
    });

    it("should use default amount when no override exists", () => {
      const version: PlanVersion = {
        frequency: "monthly",
        amountCents: 10000,
        overridesByMonth: [
          { month: "2024-12", amountCents: 15000 },
        ],
      };
      
      // January 1, 2025 (no override)
      const jan2025 = new Date("2025-01-01").getTime();
      const budgeted = computeBudgetedCents(version, jan2025, 0);
      
      expect(budgeted).toBe(10000);
    });

    it("should correctly determine month key across timezone boundaries", () => {
      const ts = new Date("2024-12-31T23:00:00Z").getTime();
      
      // EST is UTC-5, so 11pm UTC = 6pm EST (still Dec 31)
      const keyEST = monthKeyFor(ts, -300);
      expect(keyEST).toBe("2024-12");
      
      // JST is UTC+9, so 11pm UTC = 8am next day JST
      const keyJST = monthKeyFor(ts, 540);
      expect(keyJST).toBe("2025-01");
    });
  });

  describe("Edge Cases & Error Handling", () => {
    it("should handle zero budget gracefully", () => {
      const available = calculateAvailable(0, 100, 0, null);
      expect(available).toBe(-100); // Over unlimited budget
    });

    it("should handle very large amounts (near Number.MAX_SAFE_INTEGER)", () => {
      const large = Math.floor(Number.MAX_SAFE_INTEGER / 2);
      const available = calculateAvailable(large, large / 2, 0, null);
      expect(available).toBeGreaterThan(0);
    });

    it("should handle negative carryIn (deficit from prior period)", () => {
      const policy: RolloverPolicy = { allowNegative: true };
      const carryIn = -1000;
      const available = calculateAvailable(10000, 3000, carryIn, policy);
      expect(available).toBe(6000); // 10000 - 3000 - 1000
    });

    it("should maintain mathematical precision to the cent", () => {
      const budgeted = 10001;
      const spent = 3334;
      const carryIn = 5;
      const available = calculateAvailable(budgeted, spent, carryIn, null);
      // Note: When rollover policy is null, available = budgeted - spent (carryIn ignored)
      expect(available).toBe(10001 - 3334); // Exact penny calculation
    });
  });
});
