"use client";

import { useState, useRef, useEffect } from "react";
import * as Lucide from "lucide-react";
import type { EnrichedCharge } from "./types";

interface QuickActionsProps {
  charge: EnrichedCharge;
  onLogNow: (charge: EnrichedCharge) => void;
  onLinkExisting: (charge: EnrichedCharge) => void;
  onSkip: (charge: EnrichedCharge) => void;
  onMoveDate: (charge: EnrichedCharge) => void;
  onViewRule: (charge: EnrichedCharge) => void;
  variant?: "icon" | "row";
}

export default function QuickActions({
  charge,
  onLogNow,
  onLinkExisting,
  onSkip,
  onMoveDate,
  onViewRule,
  variant = "icon",
}: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const actions = [
    {
      id: "log",
      label: "Log now",
      icon: Lucide.PlusCircle,
      color: "var(--primary)",
      onClick: () => onLogNow(charge),
      disabled: charge.state === "matched",
    },
    {
      id: "link",
      label: "Link existing",
      icon: Lucide.Link,
      color: "var(--text)",
      onClick: () => onLinkExisting(charge),
      disabled: charge.state === "matched",
    },
    {
      id: "skip",
      label: "Skip this month",
      icon: Lucide.SkipForward,
      color: "var(--text-secondary)",
      onClick: () => onSkip(charge),
      disabled: charge.state === "matched" || charge.state === "skipped",
    },
    {
      id: "move",
      label: "Move date",
      icon: Lucide.CalendarRange,
      color: "var(--text-secondary)",
      onClick: () => onMoveDate(charge),
      disabled: charge.state === "matched",
    },
    {
      id: "rule",
      label: "View rule",
      icon: Lucide.Settings2,
      color: "var(--text-secondary)",
      onClick: () => onViewRule(charge),
      disabled: false,
    },
  ];

  if (variant === "row") {
    // Inline row of action buttons for mobile
    return (
      <div className="flex items-center gap-1">
        {actions
          .filter((a) => !a.disabled && (a.id === "log" || a.id === "link"))
          .map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: "var(--surface-2)" }}
                title={action.label}
              >
                <Icon className="h-4 w-4" style={{ color: action.color }} />
              </button>
            );
          })}
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="p-1.5 rounded-lg transition-colors relative"
          style={{ backgroundColor: "var(--surface-2)" }}
        >
          <Lucide.MoreHorizontal className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
        </button>
        {isOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl shadow-lg border py-1"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    action.onClick();
                  }}
                  disabled={action.disabled}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: action.color }}
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Icon button with dropdown menu (default)
  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
      >
        <Lucide.MoreVertical className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl shadow-lg border py-1"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  action.onClick();
                }}
                disabled={action.disabled}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: action.color }}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
