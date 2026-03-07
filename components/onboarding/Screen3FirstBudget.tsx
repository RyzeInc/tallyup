"use client";

import { useState } from "react";
import * as Lucide from "lucide-react";

interface Screen3Props {
  onNext: (template: "weekly" | "monthly" | "gig-based") => void;
  isLoading?: boolean;
}

/**
 * Screen 3: "Set up your first budget"
 * 
 * Template suggestions: weekly, monthly, gig-based
 * Each with helpful copy that explains when to use it.
 */
export default function Screen3FirstBudget({
  onNext,
  isLoading = false,
}: Screen3Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<"weekly" | "monthly" | "gig-based" | null>(null);

  const templates = [
    {
      id: "weekly" as const,
      emoji: "📅",
      name: "Weekly Budget",
      description: "Reset spending limits every Sunday",
      useCase: "Great for tracking week-to-week spending and staying on top of habits",
      icon: Lucide.Calendar,
      amount: "$300/week",
    },
    {
      id: "monthly" as const,
      emoji: "🗓️",
      name: "Monthly Budget",
      description: "Classic monthly spending plan",
      useCase: "Perfect for most bills and recurring expenses",
      icon: Lucide.CalendarDays,
      amount: "$1,200/month",
    },
    {
      id: "gig-based" as const,
      emoji: "⚡",
      name: "Gig Worker Budget",
      description: "Flexible, income-based budgeting",
      useCase: "Designed for variable income. Budget resets weekly and adjusts with your income",
      icon: Lucide.Zap,
      amount: "$400/week",
    },
  ];

  const handleSubmit = () => {
    if (selectedTemplate) {
      onNext(selectedTemplate);
    }
  };

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <div className="mb-3 text-4xl">📊</div>
        <h1
          className="text-h1 mb-2"
          style={{ color: "var(--text)" }}
        >
          Set up your first budget
        </h1>
        <p
          className="text-body"
          style={{ color: "var(--text-secondary)" }}
        >
          Choose a budget style that works for you. We can always change it later.
        </p>
      </div>

      {/* Templates */}
      <div className="space-y-3 mb-8">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => setSelectedTemplate(template.id)}
            disabled={isLoading}
            className="w-full p-4 rounded-xl transition-all border-2 text-left"
            style={{
              backgroundColor: selectedTemplate === template.id ? "var(--primary)" : "var(--surface)",
              borderColor: selectedTemplate === template.id ? "var(--primary)" : "var(--border)",
              opacity: isLoading ? 0.5 : 1,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">{template.emoji}</div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-body font-semibold mb-1"
                  style={{
                    color: selectedTemplate === template.id ? "var(--primary-foreground)" : "var(--text)",
                  }}
                >
                  {template.name}
                </div>
                <div
                  className="text-meta mb-2"
                  style={{
                    color: selectedTemplate === template.id
                      ? "rgba(255,255,255,0.8)"
                      : "var(--text-secondary)",
                  }}
                >
                  {template.description}
                </div>
                <div
                  className="text-meta"
                  style={{
                    color: selectedTemplate === template.id
                      ? "rgba(255,255,255,0.7)"
                      : "var(--text-tertiary)",
                  }}
                >
                  {template.useCase}
                </div>
                <div
                  className="text-meta font-semibold mt-2"
                  style={{
                    color: selectedTemplate === template.id
                      ? "rgba(255,255,255,0.9)"
                      : "var(--primary)",
                  }}
                >
                  {template.amount}
                </div>
              </div>
              {selectedTemplate === template.id && (
                <Lucide.Check className="h-5 w-5 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Next button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedTemplate || isLoading}
        className="w-full py-3 rounded-xl font-semibold transition-all text-body disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor:
            !selectedTemplate || isLoading ? "var(--surface-subtle)" : "var(--primary)",
          color:
            !selectedTemplate || isLoading ? "var(--text-secondary)" : "var(--primary-foreground)",
        }}
      >
        {isLoading ? (
          <>
            <Lucide.Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          <>Continue to Dashboard</>
        )}
      </button>

      {/* Info */}
      <div
        className="mt-6 p-4 rounded-xl"
        style={{
          backgroundColor: "var(--surface-subtle)",
          borderLeft: "4px solid var(--primary)",
        }}
      >
        <div className="flex gap-2">
          <Lucide.Lightbulb className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--primary)" }} />
          <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
            You can create multiple budgets for different categories and adjust amounts anytime. This is just the start!
          </div>
        </div>
      </div>
    </div>
  );
}
