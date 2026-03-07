"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useRouter } from "next/navigation";
import * as Lucide from "lucide-react";

// Import the four screens
import Screen1IncomeSources from "@/components/onboarding/Screen1IncomeSources";
import Screen2FirstIncome from "@/components/onboarding/Screen2FirstIncome";
import Screen3FirstBudget from "@/components/onboarding/Screen3FirstBudget";
import Screen4Dashboard from "@/components/onboarding/Screen4Dashboard";

/**
 * OnboardingPage - Main wizard orchestrator
 * 
 * Flow:
 * 1. How many income sources? (gig-worker hook)
 * 2. Add your first income stream (pre-fill)
 * 3. Set up first budget (template suggestions)
 * 4. Dashboard preview (see real data)
 * 
 * Then marks onboarding as complete and redirects to dashboard
 */

type OnboardingScreen = "income-sources" | "first-income" | "first-budget" | "dashboard";

interface OnboardingState {
  numIncomeSources: number;
  firstIncomeData?: {
    type: string;
    amountCents: number;
    category?: string;
    date: number;
  };
  selectedBudgetTemplate?: "weekly" | "monthly" | "gig-based";
}

export default function OnboardingPage() {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState<OnboardingScreen>("income-sources");
  const [state, setState] = useState<OnboardingState>({
    numIncomeSources: 1,
  });
  const [isLoading, setIsLoading] = useState(false);

  const userPrefs = useQuery(api.preferences.getUserPreferences);
  
  // Check if already completed
  useEffect(() => {
    if (userPrefs && userPrefs.onboardingCompleted) {
      router.push("/dashboard");
    }
  }, [userPrefs, router]);

  const addEntry = useMutation(api.entries.addEntry);
  const createBudget = useMutation(api.budgets.createBudgetCategory);
  const upsertPrefs = useMutation(api.preferences.upsertUserPreferences);

  // Screen 1: Get income source count
  const handleScreen1Next = useCallback((numSources: number) => {
    setState(prev => ({ ...prev, numIncomeSources: numSources }));
    setCurrentScreen("first-income");
  }, []);

  // Screen 2: Add first income entry
  const handleScreen2Next = useCallback(async (incomeData: {
    type: string;
    amountCents: number;
    category?: string;
    date: number;
  }) => {
    setIsLoading(true);
    try {
      // Add the entry immediately
      await addEntry({
        type: "income",
        category: incomeData.category || "Gig Income",
        amountCents: incomeData.amountCents,
        date: incomeData.date,
      });
      
      setState(prev => ({ ...prev, firstIncomeData: incomeData }));
      setCurrentScreen("first-budget");
    } catch (err) {
      console.error("Failed to add entry:", err);
    } finally {
      setIsLoading(false);
    }
  }, [addEntry]);

  // Screen 3: Set up first budget
  const handleScreen3Next = useCallback(async (template: "weekly" | "monthly" | "gig-based") => {
    setIsLoading(true);
    try {
      // Create budget based on template
      const budgetConfigs: Record<string, { periodType: "monthly" | "weekly" | "custom"; amount: number }> = {
        weekly: { periodType: "weekly", amount: 30000 }, // $300/week
        monthly: { periodType: "monthly", amount: 120000 }, // $1200/month
        "gig-based": { periodType: "weekly", amount: 40000 }, // $400/week for gig workers
      };

      const config = budgetConfigs[template];
      await createBudget({
        name: template === "gig-based" ? "Gig Work Budget" : template === "weekly" ? "Weekly Spending" : "Monthly Spending",
        periodType: config.periodType,
        budgetAmountCents: config.amount,
        matchCategories: [],
      });

      setState(prev => ({ ...prev, selectedBudgetTemplate: template }));
      setCurrentScreen("dashboard");
    } catch (err) {
      console.error("Failed to create budget:", err);
    } finally {
      setIsLoading(false);
    }
  }, [createBudget]);

  // Screen 4: Complete onboarding
  const handleScreen4Complete = useCallback(async () => {
    setIsLoading(true);
    try {
      await upsertPrefs({
        onboardingCompleted: true,
        onboardingState: undefined,
      });
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
    } finally {
      setIsLoading(false);
    }
  }, [upsertPrefs, router]);

  const handleBack = useCallback(() => {
    const screens: OnboardingScreen[] = ["income-sources", "first-income", "first-budget", "dashboard"];
    const currentIndex = screens.indexOf(currentScreen);
    if (currentIndex > 0) {
      setCurrentScreen(screens[currentIndex - 1]);
    }
  }, [currentScreen]);

  // Progress indicator
  const screens: OnboardingScreen[] = ["income-sources", "first-income", "first-budget", "dashboard"];
  const currentIndex = screens.indexOf(currentScreen);
  const progress = ((currentIndex + 1) / screens.length) * 100;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg)" }}>
      {/* Header with back button and progress */}
      <div className="px-4 pt-4 pb-6 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="p-2 -ml-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface-subtle)]"
          >
            <Lucide.ChevronLeft className="h-6 w-6" style={{ color: "var(--text)" }} />
          </button>
          
          <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
            {currentIndex + 1} of {screens.length}
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--surface-subtle)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progress}%`,
              backgroundColor: "var(--primary)",
              transitionDuration: "var(--motion-medium)",
            }}
          />
        </div>
      </div>

      {/* Screen content */}
      <div className="flex-1 overflow-y-auto">
        {currentScreen === "income-sources" && (
          <Screen1IncomeSources
            onNext={handleScreen1Next}
            defaultValue={state.numIncomeSources}
          />
        )}

        {currentScreen === "first-income" && (
          <Screen2FirstIncome
            onNext={handleScreen2Next}
            numIncomeSources={state.numIncomeSources}
            isLoading={isLoading}
          />
        )}

        {currentScreen === "first-budget" && (
          <Screen3FirstBudget
            onNext={handleScreen3Next}
            isLoading={isLoading}
          />
        )}

        {currentScreen === "dashboard" && (
          <Screen4Dashboard
            onComplete={handleScreen4Complete}
            isLoading={isLoading}
            incomeData={state.firstIncomeData}
          />
        )}
      </div>
    </div>
  );
}
