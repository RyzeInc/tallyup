"use client";

import * as Lucide from "lucide-react";
import Button from "@/components/ui/Button";

/**
 * CheckInCard - Scheduled coaching check-in card
 * 
 * Shows upcoming or current check-ins with time and actions.
 */

interface CheckInCardProps {
  title: string;
  time: string; // e.g., "8:00 AM", "Tomorrow"
  duration?: string; // e.g., "5-7 minutes"
  isReady?: boolean; // Can start now
  agenda?: string[];
  onStart?: () => void;
  onReschedule?: () => void;
  onSkip?: () => void;
  className?: string;
}

export default function CheckInCard({
  title,
  time,
  duration,
  isReady = false,
  agenda = [],
  onStart,
  onReschedule,
  onSkip,
  className = "",
}: CheckInCardProps) {
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{
        backgroundColor: isReady ? "rgba(196, 114, 74, 0.08)" : "var(--surface)",
        border: `1px solid ${isReady ? "rgba(196, 114, 74, 0.3)" : "var(--border)"}`,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="shrink-0 flex items-center justify-center rounded-lg"
          style={{
            width: 36,
            height: 36,
            backgroundColor: isReady ? "var(--primary)" : "var(--surface-2)",
            color: isReady ? "#FFFFFF" : "var(--text-secondary)",
          }}
        >
          <Lucide.Calendar style={{ width: 18, height: 18 }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4
              className="font-semibold truncate"
              style={{ 
                fontSize: "var(--text-body)", 
                color: "var(--text)" 
              }}
            >
              {title}
            </h4>
            {isReady && (
              <span
                className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "#FFFFFF",
                }}
              >
                Ready
              </span>
            )}
          </div>

          <div 
            className="flex items-center gap-2 mt-1"
            style={{ 
              fontSize: "var(--text-meta)", 
              color: "var(--text-secondary)" 
            }}
          >
            <span>{time}</span>
            {duration && (
              <>
                <span>•</span>
                <span>{duration}</span>
              </>
            )}
          </div>

          {/* Agenda preview */}
          {agenda.length > 0 && (
            <div className="mt-2 space-y-1">
              {agenda.slice(0, 3).map((item, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2"
                  style={{ 
                    fontSize: "var(--text-micro)", 
                    color: "var(--text-secondary)" 
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: "var(--primary)" }}
                  />
                  <span className="truncate">{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {(onStart || onReschedule || onSkip) && (
            <div className="flex items-center gap-2 mt-3">
              {isReady && onStart && (
                <Button size="sm" onClick={onStart}>
                  Start Now
                </Button>
              )}
              {onReschedule && (
                <Button size="sm" variant="ghost" onClick={onReschedule}>
                  Reschedule
                </Button>
              )}
              {onSkip && (
                <Button size="sm" variant="ghost" onClick={onSkip}>
                  Skip
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
