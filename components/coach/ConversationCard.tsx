"use client";

import * as Lucide from "lucide-react";
import { formatDateLabel } from "@/components/utils";

/**
 * ConversationCard - Past conversation summary card
 * 
 * Shows conversation date, summary, and allows reopening.
 */

interface ConversationCardProps {
  date: number; // timestamp
  summary: string;
  tags?: string[];
  onClick?: () => void;
  className?: string;
}

export default function ConversationCard({
  date,
  summary,
  tags = [],
  onClick,
  className = "",
}: ConversationCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-3 transition-all ${className}`}
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--primary)";
        e.currentTarget.style.backgroundColor = "var(--surface-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.backgroundColor = "var(--surface)";
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="shrink-0 flex items-center justify-center rounded-lg"
          style={{
            width: 32,
            height: 32,
            backgroundColor: "var(--surface-2)",
            color: "var(--text-secondary)",
          }}
        >
          <Lucide.MessageCircle style={{ width: 16, height: 16 }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Date */}
          <span
            style={{ 
              fontSize: "var(--text-micro)", 
              color: "var(--text-secondary)" 
            }}
          >
            {formatDateLabel(date, { relative: true })}
          </span>

          {/* Summary */}
          <p
            className="mt-1 line-clamp-2"
            style={{ 
              fontSize: "var(--text-meta)", 
              color: "var(--text)" 
            }}
          >
            {summary}
          </p>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 rounded-full"
                  style={{
                    fontSize: "var(--text-micro)",
                    backgroundColor: "var(--surface-2)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Arrow */}
        <Lucide.ChevronRight 
          className="shrink-0"
          style={{ 
            width: 18, 
            height: 18, 
            color: "var(--text-secondary)" 
          }} 
        />
      </div>
    </button>
  );
}
