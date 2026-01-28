"use client";

import * as Lucide from "lucide-react";

/**
 * FollowUpSuggestions - Contextual follow-up question suggestions
 * 
 * Shows quick suggestion chips after coach responses.
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

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

export default function FollowUpSuggestions({
  suggestions,
  onSelect,
  className = "",
}: FollowUpSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        className="flex items-center gap-2"
        style={{ 
          fontSize: "var(--text-micro)", 
          color: "var(--text-secondary)" 
        }}
      >
        <Lucide.Sparkles style={{ width: 14, height: 14 }} />
        <span>Follow-up suggestions</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              fontSize: "var(--text-meta)",
              color: "var(--text)",
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
            <Lucide.MessageCircle 
              style={{ 
                width: 14, 
                height: 14, 
                color: "var(--text-secondary)" 
              }} 
            />
            <span>{stripMarkdown(suggestion)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
