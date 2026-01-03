"use client";

import { useState, useRef, useEffect } from "react";
import * as Lucide from "lucide-react";

/**
 * InfoTip - Contextual learning tooltip
 * 
 * Small "i" button that reveals a brief, helpful explanation.
 * Used throughout the app to teach users about financial concepts.
 */

interface InfoTipProps {
  /** Short title for the tip */
  title: string;
  /** One-sentence explanation */
  body: string;
  /** Optional icon size (default 16) */
  size?: number;
}

export function InfoTip({ title, body, size = 16 }: InfoTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-full border transition-colors hover:bg-[var(--surface-subtle)]"
        style={{
          width: size + 10,
          height: size + 10,
          borderColor: "var(--border)",
          color: "var(--text-tertiary)",
        }}
        aria-label={`Info: ${title}`}
        aria-expanded={isOpen}
      >
        <Lucide.Info size={size} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute z-50 w-64 rounded-xl border p-3 shadow-lg"
          style={{
            top: "calc(100% + 8px)",
            right: 0,
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
          }}
          role="tooltip"
        >
          <div
            className="text-sm font-medium"
            style={{ color: "var(--text)" }}
          >
            {title}
          </div>
          <div
            className="mt-1 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {body}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Common InfoTips used throughout the app
 * Centralized for consistency
 */
export const COMMON_TIPS = {
  net: {
    title: "Net is the truth number",
    body: "Net = income minus spending. It shows if your lifestyle fits your real earnings.",
  },
  needsReview: {
    title: "Why review?",
    body: "Flagged items need a quick check—maybe a missing category or an unusual amount.",
  },
  recurring: {
    title: "Recurring rules",
    body: "These are expenses or income that happen regularly. Tracking them helps predict future cash flow.",
  },
  hourlyRate: {
    title: "Hourly rate matters",
    body: "Your true hourly rate includes all hours worked. Track it to compare gigs honestly.",
  },
  volatility: {
    title: "Income volatility",
    body: "High volatility means income varies a lot. Plan spending around your low months, not average.",
  },
  budgetPacing: {
    title: "Budget pacing",
    body: "Shows if you're spending faster or slower than expected for this point in the period.",
  },
  goalProgress: {
    title: "Goal progress",
    body: "Each contribution brings you closer. Small amounts add up—consistency beats size.",
  },
  sinkingFund: {
    title: "Sinking funds",
    body: "Save monthly for irregular expenses (car insurance, holidays). When they hit, you're ready.",
  },
} as const;

export default InfoTip;
