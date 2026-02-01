"use client";

import { useState, useRef, useEffect } from "react";
import * as Lucide from "lucide-react";
import type { ConversationMode } from "@/lib/llm/types";
import { CONVERSATION_MODES } from "@/lib/llm/types";

/**
 * ConversationModeSelector - Dropdown selector for coach conversation modes
 * 
 * Modes:
 * - Default: Auto-detects based on message content (no visible notation)
 * - Learning: Education-focused, minimal data anchoring
 *   - Learning: Exploration - What-if scenarios
 *   - Learning: Validation - Confirm understanding
 * - Planning: Action-focused, uses data
 *   - Planning: Action - Ready to take steps
 *   - Planning: Crisis - Urgent financial situation
 */

interface ConversationModeSelectorProps {
  value: ConversationMode;
  onChange: (mode: ConversationMode) => void;
  /** 
   * Variant styles:
   * - "default": Standard dropdown button
   * - "header": ChatGPT-style inline with title (shows "Financial Coach" with mode indicator)
   */
  variant?: "default" | "header";
  compact?: boolean;
  className?: string;
}

// Icons for each mode
const modeIcons: Record<ConversationMode, React.ReactNode> = {
  default: <Lucide.Sparkles style={{ width: 16, height: 16 }} />,
  learning: <Lucide.BookOpen style={{ width: 16, height: 16 }} />,
  "learning:exploration": <Lucide.Compass style={{ width: 16, height: 16 }} />,
  "learning:validation": <Lucide.CheckCircle style={{ width: 16, height: 16 }} />,
  planning: <Lucide.ClipboardList style={{ width: 16, height: 16 }} />,
  "planning:action": <Lucide.Zap style={{ width: 16, height: 16 }} />,
  "planning:crisis": <Lucide.AlertTriangle style={{ width: 16, height: 16 }} />,
};

// Group modes for the dropdown
const MODE_GROUPS = [
  {
    label: null,
    modes: ["default"] as ConversationMode[],
  },
  {
    label: null,
    modes: ["learning", "learning:exploration", "learning:validation"] as ConversationMode[],
  },
  {
    label: null,
    modes: ["planning", "planning:action", "planning:crisis"] as ConversationMode[],
  },
];

export default function ConversationModeSelector({
  value,
  onChange,
  variant = "default",
  compact = false,
  className = "",
}: ConversationModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentMode = CONVERSATION_MODES[value];
  const isDefault = value === "default";

  // Header variant - ChatGPT style with title
  if (variant === "header") {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        {/* Header trigger - looks like a title with dropdown */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 transition-colors hover:opacity-80"
          style={{
            fontSize: "var(--text-body)",
            fontWeight: 600,
            color: "var(--text)",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
          }}
          title={currentMode.description}
        >
          <span>Financial Coach</span>
          {!isDefault && (
            <span
              style={{
                fontSize: "var(--text-meta)",
                fontWeight: 500,
                color: "var(--primary)",
              }}
            >
              {currentMode.shortLabel}
            </span>
          )}
          <Lucide.ChevronDown
            style={{
              width: 16,
              height: 16,
              color: "var(--text-secondary)",
              transition: "transform 0.2s",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div
            className="absolute z-50 mt-2 rounded-xl shadow-lg overflow-hidden"
            style={{
              backgroundColor: "var(--background)",
              border: "1px solid var(--border)",
              minWidth: 240,
              left: 0,
            }}
          >
            {MODE_GROUPS.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Group label */}
                {group.label && (
                  <div
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: "var(--surface)",
                      color: "var(--text-secondary)",
                      borderTop: groupIndex > 0 ? "1px solid var(--border)" : undefined,
                    }}
                  >
                    {group.label}
                  </div>
                )}
                
                {/* Mode options */}
                {group.modes.map((mode) => {
                  const modeInfo = CONVERSATION_MODES[mode];
                  const isSelected = value === mode;
                  const isSubMode = mode.includes(":");
                  
                  return (
                    <button
                      key={mode}
                      onClick={() => {
                        onChange(mode);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-start gap-3 transition-colors hover:bg-[var(--surface)]"
                      style={{
                        padding: "10px 12px",
                        paddingLeft: isSubMode ? "24px" : "12px",
                        backgroundColor: isSelected ? "var(--primary-light)" : "transparent",
                        color: isSelected ? "var(--primary)" : "var(--text)",
                        textAlign: "left",
                        cursor: "pointer",
                        border: "none",
                      }}
                    >
                      <span
                        className="flex-shrink-0 mt-0.5"
                        style={{
                          color: isSelected ? "var(--primary)" : "var(--text-secondary)",
                        }}
                      >
                        {modeIcons[mode]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-medium"
                          style={{ fontSize: "var(--text-body)" }}
                        >
                          {modeInfo.label}
                        </div>
                        <div
                          className="mt-0.5 line-clamp-2"
                          style={{
                            fontSize: "var(--text-meta)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {modeInfo.description}
                        </div>
                      </div>
                      {isSelected && (
                        <Lucide.Check
                          className="flex-shrink-0"
                          style={{
                            width: 16,
                            height: 16,
                            color: "var(--primary)",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default variant - standard dropdown button
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg transition-all"
        style={{
          padding: compact ? "6px 10px" : "8px 12px",
          fontSize: "var(--text-meta)",
          backgroundColor: isDefault ? "transparent" : "var(--surface)",
          color: isDefault ? "var(--text-secondary)" : "var(--text)",
          border: `1px solid ${isDefault ? "var(--border)" : "var(--primary-light)"}`,
          cursor: "pointer",
        }}
        title={currentMode.description}
      >
        {modeIcons[value]}
        {!compact && (
          <span>{isDefault ? "Auto" : currentMode.shortLabel}</span>
        )}
        <Lucide.ChevronDown
          style={{
            width: 14,
            height: 14,
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute z-50 mt-1 rounded-xl shadow-lg overflow-hidden"
          style={{
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            minWidth: 220,
            right: 0,
          }}
        >
          {MODE_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex}>
              {/* Group label */}
              {group.label && (
                <div
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: "var(--surface)",
                    color: "var(--text-secondary)",
                    borderTop: groupIndex > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  {group.label}
                </div>
              )}
              
              {/* Mode options */}
              {group.modes.map((mode) => {
                const modeInfo = CONVERSATION_MODES[mode];
                const isSelected = value === mode;
                const isSubMode = mode.includes(":");
                
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      onChange(mode);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-start gap-3 transition-colors hover:bg-[var(--surface)]"
                    style={{
                      padding: "10px 12px",
                      paddingLeft: isSubMode ? "24px" : "12px",
                      backgroundColor: isSelected ? "var(--primary-light)" : "transparent",
                      color: isSelected ? "var(--primary)" : "var(--text)",
                      textAlign: "left",
                      cursor: "pointer",
                      border: "none",
                    }}
                  >
                    <span
                      className="flex-shrink-0 mt-0.5"
                      style={{
                        color: isSelected ? "var(--primary)" : "var(--text-secondary)",
                      }}
                    >
                      {modeIcons[mode]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-medium"
                        style={{ fontSize: "var(--text-body)" }}
                      >
                        {modeInfo.label}
                      </div>
                      <div
                        className="mt-0.5 line-clamp-2"
                        style={{
                          fontSize: "var(--text-meta)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {modeInfo.description}
                      </div>
                    </div>
                    {isSelected && (
                      <Lucide.Check
                        className="flex-shrink-0"
                        style={{
                          width: 16,
                          height: 16,
                          color: "var(--primary)",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
