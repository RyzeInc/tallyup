"use client";

import { useState } from "react";
import * as Lucide from "lucide-react";

interface Screen1Props {
  onNext: (numSources: number) => void;
  defaultValue?: number;
}

/**
 * Screen 1: "How many income sources do you have?"
 * 
 * This is the gig-worker hook that sets the tone for the whole app.
 * Makes it feel like TallyUp was built for their specific problem.
 */
export default function Screen1IncomeSources({ onNext, defaultValue = 1 }: Screen1Props) {
  const [numSources, setNumSources] = useState(defaultValue);

  const options = [
    { value: 1, label: "One main job", emoji: "💼" },
    { value: 2, label: "Two sources", emoji: "🔄" },
    { value: 3, label: "Three or more", emoji: "🎯" },
  ];

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      {/* Hero section */}
      <div className="mb-12 text-center">
        <div className="mb-4 text-5xl">🌊</div>
        <h1
          className="text-h1 mb-2"
          style={{ color: "var(--text)" }}
        >
          Welcome to TallyUp
        </h1>
        <p
          className="text-body"
          style={{ color: "var(--text-secondary)" }}
        >
          Your money, your way.
        </p>
      </div>

      {/* Main question */}
      <div className="mb-8">
        <h2
          className="text-h2 mb-6"
          style={{ color: "var(--text)" }}
        >
          How many income sources do you have?
        </h2>
        <p
          className="text-meta mb-6"
          style={{ color: "var(--text-secondary)" }}
        >
          Whether you&apos;re juggling side hustles, contract work, or a traditional job, we&apos;ve got you covered. This helps us tailor your experience.
        </p>

        {/* Options */}
        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => setNumSources(option.value)}
              className="w-full p-4 rounded-xl transition-all border-2"
              style={{
                backgroundColor: numSources === option.value ? "var(--primary)" : "var(--surface)",
                borderColor: numSources === option.value ? "var(--primary)" : "var(--border)",
                color: numSources === option.value ? "var(--primary-foreground)" : "var(--text)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{option.emoji}</span>
                <div className="text-left">
                  <div className="text-body font-semibold">{option.label}</div>
                </div>
                {numSources === option.value && (
                  <div className="ml-auto">
                    <Lucide.Check className="h-5 w-5" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Info box */}
      <div
        className="p-4 rounded-xl mb-8"
        style={{
          backgroundColor: "var(--surface-subtle)",
          borderLeft: "4px solid var(--primary)",
        }}
      >
        <div className="flex gap-3">
          <Lucide.Lightbulb className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--primary)" }} />
          <div>
            <div className="text-meta font-semibold" style={{ color: "var(--text)" }}>
              Pro tip: Be honest
            </div>
            <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
              We use this to show the right budget templates and insights. You can change this anytime.
            </div>
          </div>
        </div>
      </div>

      {/* Next button */}
      <button
        onClick={() => onNext(numSources)}
        className="w-full py-3 rounded-xl font-semibold transition-all text-body"
        style={{
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
        }}
      >
        Continue
        <span className="ml-2">→</span>
      </button>

      {/* Optional: Skip for now (less prominent) */}
      <button
        onClick={() => onNext(numSources)} // Same action but less prominent
        className="w-full py-2 mt-3 text-meta rounded-lg transition-colors"
        style={{ color: "var(--text-secondary)" }}
      >
        or start exploring
      </button>
    </div>
  );
}
