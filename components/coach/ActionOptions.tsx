"use client";

import { useState } from "react";
import * as Lucide from "lucide-react";

/**
 * ActionOptions - Multiple choice follow-up options
 * 
 * Replaces open-ended questions with clear, tappable choices.
 * Implements: Questions → Multiple choice options
 * 
 * Supports single-select, multi-select, and freeform modes.
 */

/** Strip markdown formatting from text for display in buttons */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold**
    .replace(/\*([^*]+)\*/g, '$1')       // *italic*
    .replace(/__([^_]+)__/g, '$1')       // __bold__
    .replace(/_([^_]+)_/g, '$1')         // _italic_
    .replace(/~~([^~]+)~~/g, '$1')       // ~~strikethrough~~
    .replace(/`([^`]+)`/g, '$1')         // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [link](url)
    .replace(/^#+\s*/gm, '')             // # headers
    .replace(/^[-*]\s+/gm, '')           // - list items
    .replace(/^\d+\.\s+/gm, '');         // 1. numbered items
}

export interface ActionOption {
  /** Unique ID */
  id: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Optional icon name */
  icon?: string;
  /** Whether this is a "primary" recommended option */
  recommended?: boolean;
  /** Custom data to pass back on selection */
  data?: Record<string, unknown>;
}

interface ActionOptionsProps {
  /** Title above options */
  title?: string;
  /** Available options */
  options: ActionOption[];
  /** Selection mode */
  mode?: "single" | "multi" | "freeform";
  /** Called when user selects option(s) */
  onSelect: (selected: ActionOption[]) => void;
  /** Optional primary CTA (shows at bottom) */
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Allow user to type custom response */
  allowCustom?: boolean;
  /** Placeholder for custom input */
  customPlaceholder?: string;
  /** Max selections for multi mode */
  maxSelections?: number;
  className?: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "search": <Lucide.Search style={{ width: 16, height: 16 }} />,
  "calculator": <Lucide.Calculator style={{ width: 16, height: 16 }} />,
  "list": <Lucide.List style={{ width: 16, height: 16 }} />,
  "dollar": <Lucide.DollarSign style={{ width: 16, height: 16 }} />,
  "credit-card": <Lucide.CreditCard style={{ width: 16, height: 16 }} />,
  "piggy-bank": <Lucide.PiggyBank style={{ width: 16, height: 16 }} />,
  "trending-up": <Lucide.TrendingUp style={{ width: 16, height: 16 }} />,
  "trending-down": <Lucide.TrendingDown style={{ width: 16, height: 16 }} />,
  "help": <Lucide.HelpCircle style={{ width: 16, height: 16 }} />,
  "arrow-right": <Lucide.ArrowRight style={{ width: 16, height: 16 }} />,
  "check": <Lucide.Check style={{ width: 16, height: 16 }} />,
  "x": <Lucide.X style={{ width: 16, height: 16 }} />,
  "message": <Lucide.MessageSquare style={{ width: 16, height: 16 }} />,
  "file": <Lucide.FileText style={{ width: 16, height: 16 }} />,
  "settings": <Lucide.Settings style={{ width: 16, height: 16 }} />,
};

export default function ActionOptions({
  title,
  options,
  mode = "single",
  onSelect,
  primaryAction,
  allowCustom = false,
  customPlaceholder = "Or type your own...",
  maxSelections = 3,
  className = "",
}: ActionOptionsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customValue, setCustomValue] = useState("");

  const handleOptionClick = (option: ActionOption) => {
    if (mode === "single") {
      // Single select - immediately fire and clear
      onSelect([option]);
      setSelected(new Set());
    } else {
      // Multi select - toggle selection
      const newSelected = new Set(selected);
      if (newSelected.has(option.id)) {
        newSelected.delete(option.id);
      } else if (newSelected.size < maxSelections) {
        newSelected.add(option.id);
      }
      setSelected(newSelected);
    }
  };

  const handleSubmitMulti = () => {
    const selectedOptions = options.filter(o => selected.has(o.id));
    if (selectedOptions.length > 0) {
      onSelect(selectedOptions);
      setSelected(new Set());
    }
  };

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onSelect([{
        id: "custom",
        label: customValue.trim(),
        data: { isCustom: true },
      }]);
      setCustomValue("");
    }
  };

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Title */}
      {title && (
        <div
          className="px-4 py-3 border-b"
          style={{
            borderColor: "var(--border)",
            fontSize: "var(--text-meta)",
            fontWeight: 600,
            color: "var(--text)",
          }}
        >
          {title}
        </div>
      )}

      {/* Options */}
      <div className="p-2">
        {options.map((option) => {
          const isSelected = selected.has(option.id);
          const icon = option.icon ? ICON_MAP[option.icon] : null;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleOptionClick(option)}
              className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left"
              style={{
                backgroundColor: isSelected 
                  ? "rgba(183, 101, 77, 0.1)" 
                  : "transparent",
                border: option.recommended 
                  ? "1px solid var(--primary)" 
                  : "1px solid transparent",
              }}
            >
              {/* Checkbox for multi mode */}
              {mode === "multi" && (
                <div
                  className="shrink-0 flex items-center justify-center rounded"
                  style={{
                    width: 20,
                    height: 20,
                    border: isSelected 
                      ? "none" 
                      : "2px solid var(--border)",
                    backgroundColor: isSelected 
                      ? "var(--primary)" 
                      : "transparent",
                  }}
                >
                  {isSelected && (
                    <Lucide.Check 
                      style={{ width: 14, height: 14, color: "#FFF" }} 
                    />
                  )}
                </div>
              )}

              {/* Icon */}
              {icon && (
                <div
                  className="shrink-0 flex items-center justify-center rounded-lg"
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "var(--surface-2)",
                    color: option.recommended 
                      ? "var(--primary)" 
                      : "var(--text-secondary)",
                  }}
                >
                  {icon}
                </div>
              )}

              {/* Label & description */}
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: "var(--text-body)",
                    color: "var(--text)",
                    fontWeight: option.recommended ? 600 : 400,
                  }}
                >
                  {stripMarkdown(option.label)}
                </div>
                {option.description && (
                  <div
                    style={{
                      fontSize: "var(--text-micro)",
                      color: "var(--text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    {stripMarkdown(option.description)}
                  </div>
                )}
              </div>

              {/* Recommended badge */}
              {option.recommended && (
                <span
                  className="shrink-0 px-2 py-0.5 rounded-full"
                  style={{
                    fontSize: "var(--text-micro)",
                    backgroundColor: "var(--primary)",
                    color: "#FFF",
                  }}
                >
                  Suggested
                </span>
              )}

              {/* Arrow for single mode */}
              {mode === "single" && (
                <Lucide.ChevronRight
                  style={{
                    width: 16,
                    height: 16,
                    color: "var(--text-secondary)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Custom input */}
      {allowCustom && (
        <div className="px-3 pb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder={customPlaceholder}
              className="flex-1 px-3 py-2 rounded-lg"
              style={{
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border)",
                fontSize: "var(--text-body)",
                color: "var(--text)",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomSubmit();
              }}
            />
            {customValue.trim() && (
              <button
                type="button"
                onClick={handleCustomSubmit}
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "#FFF",
                }}
              >
                <Lucide.Send style={{ width: 16, height: 16 }} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Multi-select submit button */}
      {mode === "multi" && selected.size > 0 && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={handleSubmitMulti}
            className="w-full py-2 rounded-lg font-semibold transition-colors"
            style={{
              backgroundColor: "var(--primary)",
              color: "#FFF",
              fontSize: "var(--text-body)",
            }}
          >
            Continue with {selected.size} selected
          </button>
        </div>
      )}

      {/* Primary action CTA */}
      {primaryAction && (
        <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="w-full py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: "var(--primary)",
              color: "#FFF",
              fontSize: "var(--text-body)",
            }}
          >
            {primaryAction.label}
            <Lucide.ArrowRight style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Preset option sets for common coach interactions
 */
export const PRESET_OPTIONS = {
  cashflowActions: [
    { id: "review-loan", label: "Review loan terms", icon: "file" },
    { id: "find-savings", label: "Find $300 elsewhere", icon: "search" },
    { id: "see-expenses", label: "See all expenses", icon: "list" },
    { id: "ask-income", label: "Ask about income", icon: "dollar" },
  ],
  debtStrategy: [
    { id: "avalanche", label: "Avalanche method", description: "Pay highest interest first", icon: "trending-down", recommended: true },
    { id: "snowball", label: "Snowball method", description: "Pay smallest balance first", icon: "trending-up" },
    { id: "explain", label: "Explain the difference", icon: "help" },
  ],
  savingsGoal: [
    { id: "emergency", label: "Build emergency fund", icon: "piggy-bank", recommended: true },
    { id: "vacation", label: "Save for a trip", icon: "trending-up" },
    { id: "purchase", label: "Big purchase", icon: "credit-card" },
    { id: "custom", label: "Something else", icon: "message" },
  ],
  nextStep: [
    { id: "continue", label: "Continue", icon: "arrow-right" },
    { id: "pause", label: "Pause this topic", icon: "x" },
    { id: "summary", label: "Get to the point", icon: "check" },
  ],
} as const;
