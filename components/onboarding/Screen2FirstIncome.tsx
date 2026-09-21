"use client";

import { useState } from "react";
import * as Lucide from "lucide-react";

interface Screen2Props {
  onNext: (data: {
    type: string;
    amountCents: number;
    category?: string;
    date: number;
  }) => void;
  numIncomeSources: number;
  isLoading?: boolean;
}

/**
 * Screen 2: "Add your first income stream"
 * 
 * Pre-fills with suggestions based on their answer to Screen 1.
 * Uses the existing addEntry mutation.
 */
export default function Screen2FirstIncome({
  onNext,
  numIncomeSources,
  isLoading = false,
}: Screen2Props) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Gig Income");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Suggested categories based on income source count
  const suggestedCategories =
    numIncomeSources === 1
      ? ["Salary", "Wages", "Contract Work", "Gig Income", "Freelance"]
      : ["Primary Job", "Side Hustle", "Contract Work", "Gig Income", "Freelance", "Passive Income"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    const amountCents = Math.round(amountNum * 100);
    const dateMs = new Date(date).getTime();

    onNext({
      type: "income",
      amountCents,
      category: category || "Income",
      date: dateMs,
    });
  };

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <div className="mb-3 text-4xl">💰</div>
        <h1
          className="text-h1 mb-2"
          style={{ color: "var(--text)" }}
        >
          Add your first income
        </h1>
        <p
          className="text-body"
          style={{ color: "var(--text-secondary)" }}
        >
          This gets you started. You can add more later.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5 mb-8">
        {/* Amount */}
        <div>
          <label
            className="text-meta font-semibold block mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Amount
          </label>
          <div
            className="flex items-center rounded-xl px-4 py-3 border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>$</span>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 ml-2 bg-transparent outline-none text-body"
              style={{ color: "var(--text)" }}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label
            className="text-meta font-semibold block mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border outline-none"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            disabled={isLoading}
          >
            {suggestedCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            <option value="">-- Custom --</option>
          </select>
          {category === "" && (
            <input
              type="text"
              placeholder="Enter custom category"
              className="w-full mt-2 px-4 py-3 rounded-xl border outline-none"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading}
            />
          )}
        </div>

        {/* Date */}
        <div>
          <label
            className="text-meta font-semibold block mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border outline-none"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            disabled={isLoading}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !amount}
          className="w-full py-3 rounded-xl font-semibold transition-all text-body disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isLoading || !amount ? "var(--surface-subtle)" : "var(--primary)",
            color: isLoading || !amount ? "var(--text-secondary)" : "var(--primary-foreground)",
          }}
        >
          {isLoading ? (
            <>
              <Lucide.Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>Continue</>
          )}
        </button>
      </form>

      {/* Info */}
      <div
        className="p-4 rounded-xl"
        style={{
          backgroundColor: "var(--surface-subtle)",
        }}
      >
        <div className="flex gap-2">
          <Lucide.Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--text-secondary)" }} />
          <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
            We&apos;re just getting started. You can update this anytime and add more income sources.
          </div>
        </div>
      </div>
    </div>
  );
}
