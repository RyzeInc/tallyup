"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as Lucide from "lucide-react";

// UI Components
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import ModuleProgressPill from "@/components/coach/ModuleProgressPill";

/**
 * CoachModulesPage - Learning paths library
 * 
 * Shows all available learning modules with progress tracking.
 */

type ModuleCategory = "budgeting" | "debt" | "saving" | "investing" | "taxes" | "retirement";

interface Module {
  id: string;
  name: string;
  description: string;
  category: ModuleCategory;
  lessons: number;
  duration: string; // e.g., "45 minutes"
  progress: number;
  completed: boolean;
  recommended?: boolean;
}

// Mock modules data (will be replaced with real data)
const MODULES: Module[] = [
  {
    id: "debt-payoff",
    name: "Debt Payoff Strategy",
    description: "Master avalanche vs snowball, negotiate rates, and build a payoff plan.",
    category: "debt",
    lessons: 7,
    duration: "45 minutes",
    progress: 60,
    completed: false,
    recommended: true,
  },
  {
    id: "budget-basics",
    name: "Budgeting for Beginners",
    description: "Learn the simple 50/30/20 method and start tracking your money.",
    category: "budgeting",
    lessons: 5,
    duration: "30 minutes",
    progress: 100,
    completed: true,
  },
  {
    id: "emergency-fund",
    name: "Emergency Fund Bootcamp",
    description: "30-day plan to build your first $1,000 emergency fund.",
    category: "saving",
    lessons: 6,
    duration: "35 minutes",
    progress: 0,
    completed: false,
  },
  {
    id: "investing-fundamentals",
    name: "Investing Fundamentals",
    description: "Stocks, bonds, ETFs explained in plain English.",
    category: "investing",
    lessons: 8,
    duration: "50 minutes",
    progress: 25,
    completed: false,
  },
  {
    id: "variable-income",
    name: "Variable Income Management",
    description: "Budget strategies for freelancers and gig workers.",
    category: "budgeting",
    lessons: 5,
    duration: "30 minutes",
    progress: 0,
    completed: false,
  },
  {
    id: "home-buyer",
    name: "First-Time Home Buyer",
    description: "12-week preparation for your first home purchase.",
    category: "saving",
    lessons: 12,
    duration: "90 minutes",
    progress: 0,
    completed: false,
  },
  {
    id: "tax-basics",
    name: "Tax Basics",
    description: "Understand deductions, credits, and filing strategies.",
    category: "taxes",
    lessons: 6,
    duration: "40 minutes",
    progress: 0,
    completed: false,
  },
  {
    id: "retirement-101",
    name: "Retirement Planning 101",
    description: "401k, IRA, and building long-term wealth.",
    category: "retirement",
    lessons: 7,
    duration: "45 minutes",
    progress: 0,
    completed: false,
  },
];

const CATEGORY_LABELS: Record<ModuleCategory, { label: string; icon: React.ReactNode }> = {
  budgeting: { label: "Budgeting", icon: <Lucide.PieChart style={{ width: 16, height: 16 }} /> },
  debt: { label: "Debt", icon: <Lucide.CreditCard style={{ width: 16, height: 16 }} /> },
  saving: { label: "Saving", icon: <Lucide.PiggyBank style={{ width: 16, height: 16 }} /> },
  investing: { label: "Investing", icon: <Lucide.TrendingUp style={{ width: 16, height: 16 }} /> },
  taxes: { label: "Taxes", icon: <Lucide.Receipt style={{ width: 16, height: 16 }} /> },
  retirement: { label: "Retirement", icon: <Lucide.Landmark style={{ width: 16, height: 16 }} /> },
};

export default function CoachModulesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<ModuleCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter modules
  const filteredModules = useMemo(() => {
    return MODULES.filter((module) => {
      const matchesCategory = selectedCategory === "all" || module.category === selectedCategory;
      const matchesSearch = searchQuery.trim() === "" || 
        module.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        module.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Get recommended module
  const recommendedModule = MODULES.find(m => m.recommended && !m.completed);

  // Get in-progress modules
  const inProgressModules = MODULES.filter(m => m.progress > 0 && !m.completed);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <PageHeader 
        title="Learning Modules" 
        subtitle="Build your financial knowledge"
        rightSlot={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/coach")}
          >
            <Lucide.ChevronLeft style={{ width: 16, height: 16 }} />
            <span className="ml-1">Back</span>
          </Button>
        }
      />

      {/* Search */}
      <div
        className="relative flex items-center gap-2 rounded-xl"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "var(--space-3) var(--space-4)",
        }}
      >
        <Lucide.Search 
          style={{ width: 18, height: 18, color: "var(--text-secondary)" }} 
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Find a module..."
          className="flex-1 bg-transparent outline-none"
          style={{
            fontSize: "var(--text-body)",
            color: "var(--text)",
          }}
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory("all")}
          className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
          style={{
            backgroundColor: selectedCategory === "all" ? "var(--primary)" : "var(--surface)",
            color: selectedCategory === "all" ? "#FFFFFF" : "var(--text)",
            border: `1px solid ${selectedCategory === "all" ? "var(--primary)" : "var(--border)"}`,
          }}
        >
          All
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key as ModuleCategory)}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={{
              backgroundColor: selectedCategory === key ? "var(--primary)" : "var(--surface)",
              color: selectedCategory === key ? "#FFFFFF" : "var(--text)",
              border: `1px solid ${selectedCategory === key ? "var(--primary)" : "var(--border)"}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Recommended module */}
      {recommendedModule && selectedCategory === "all" && !searchQuery && (
        <div className="space-y-2">
          <div
            className="flex items-center gap-2"
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <Lucide.Star style={{ width: 14, height: 14 }} />
            <span>Recommended For You</span>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/coach/modules/${recommendedModule.id}`)}
            className="w-full text-left"
          >
            <Card float hover>
              <CardContent>
              <div className="flex items-start gap-4">
                <div
                  className="shrink-0 flex items-center justify-center rounded-xl"
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: "var(--primary)",
                    color: "#FFFFFF",
                  }}
                >
                  <Lucide.Trophy style={{ width: 24, height: 24 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold"
                    style={{ fontSize: "var(--text-body)", color: "var(--text)" }}
                  >
                    {recommendedModule.name}
                  </h3>
                  <p
                    className="mt-1"
                    style={{ fontSize: "var(--text-meta)", color: "var(--text-secondary)" }}
                  >
                    {recommendedModule.description}
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ width: 80, backgroundColor: "var(--border)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${recommendedModule.progress}%`,
                            backgroundColor: "var(--primary)",
                          }}
                        />
                      </div>
                      <span
                        style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}
                      >
                        {recommendedModule.progress}%
                      </span>
                    </div>
                    <span
                      style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}
                    >
                      {recommendedModule.lessons} lessons • {recommendedModule.duration}
                    </span>
                  </div>
                </div>
                <Button size="sm">
                  {recommendedModule.progress > 0 ? "Continue" : "Start"}
                </Button>
              </div>
            </CardContent>
          </Card>
          </button>
        </div>
      )}

      {/* In-progress modules */}
      {inProgressModules.length > 0 && selectedCategory === "all" && !searchQuery && (
        <div className="space-y-2">
          <div
            className="flex items-center gap-2"
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <Lucide.PlayCircle style={{ width: 14, height: 14 }} />
            <span>Continue Learning</span>
          </div>
          <div className="space-y-2">
            {inProgressModules.map((module) => (
              <ModuleProgressPill
                key={module.id}
                name={module.name}
                progress={module.progress}
                completed={module.completed}
                onClick={() => router.push(`/coach/modules/${module.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All modules */}
      <div className="space-y-2">
        <div
          className="flex items-center gap-2"
          style={{
            fontSize: "var(--text-micro)",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <Lucide.Library style={{ width: 14, height: 14 }} />
          <span>{selectedCategory === "all" ? "All Modules" : CATEGORY_LABELS[selectedCategory].label}</span>
        </div>
        
        {filteredModules.length === 0 ? (
          <div
            className="text-center py-8"
            style={{ color: "var(--text-secondary)" }}
          >
            No modules found matching your search.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredModules.map((module) => (
              <button
                key={module.id}
                type="button"
                onClick={() => router.push(`/coach/modules/${module.id}`)}
                className="w-full text-left"
              >
                <Card hover>
                  <CardContent>
                  <div className="flex items-start gap-3">
                    <div
                      className="shrink-0 flex items-center justify-center rounded-lg"
                      style={{
                        width: 40,
                        height: 40,
                        backgroundColor: module.completed ? "rgba(90, 148, 116, 0.1)" : "var(--surface-2)",
                        color: module.completed ? "var(--success)" : "var(--text-secondary)",
                      }}
                    >
                      {module.completed ? (
                        <Lucide.CheckCircle2 style={{ width: 20, height: 20 }} />
                      ) : (
                        CATEGORY_LABELS[module.category].icon
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-semibold"
                        style={{ fontSize: "var(--text-body)", color: "var(--text)" }}
                      >
                        {module.name}
                      </h3>
                      <p
                        className="mt-0.5 line-clamp-2"
                        style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}
                      >
                        {module.description}
                      </p>
                      <div
                        className="mt-2 flex items-center gap-2"
                        style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}
                      >
                        <span>{module.lessons} lessons</span>
                        <span>•</span>
                        <span>{module.duration}</span>
                        {!module.completed && module.progress > 0 && (
                          <>
                            <span>•</span>
                            <span style={{ color: "var(--primary)" }}>{module.progress}%</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
