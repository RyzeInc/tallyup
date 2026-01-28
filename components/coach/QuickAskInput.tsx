"use client";

import { useState, useRef, useEffect } from "react";
import * as Lucide from "lucide-react";

/**
 * QuickAskInput - Quick question input with voice support
 * 
 * Features:
 * - Expandable on focus
 * - Voice input button (placeholder for future)
 * - Recent queries suggestions
 * - Smart suggestions based on typing
 */

interface QuickAskInputProps {
  onSubmit: (question: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  suggestions?: string[];
  recentQueries?: string[];
  disabled?: boolean;
  loading?: boolean;
}

export default function QuickAskInput({
  onSubmit,
  onFocus,
  onBlur,
  placeholder = "Ask me anything about your money...",
  suggestions = [],
  recentQueries = [],
  disabled = false,
  loading = false,
}: QuickAskInputProps) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (trimmed && !disabled && !loading) {
      onSubmit(trimmed);
      setValue("");
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
    // Auto-submit suggestion
    onSubmit(suggestion);
    setValue("");
  };

  const handleFocus = () => {
    setIsFocused(true);
    setShowSuggestions(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Delay hiding suggestions to allow click
    setTimeout(() => {
      onBlur?.();
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const displaySuggestions = value.trim() 
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 4)
    : recentQueries.slice(0, 3);

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit}>
        <div
          className="relative flex items-center gap-2 rounded-2xl transition-all"
          style={{
            backgroundColor: "var(--surface)",
            border: `2px solid ${isFocused ? "var(--primary)" : "var(--border)"}`,
            padding: "var(--space-3) var(--space-4)",
            boxShadow: isFocused ? "0 0 0 4px rgba(196, 114, 74, 0.1)" : "none",
          }}
        >
          <Lucide.Search 
            className="shrink-0"
            style={{ 
              width: 20, 
              height: 20, 
              color: isFocused ? "var(--primary)" : "var(--text-secondary)" 
            }} 
          />
          
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || loading}
            className="flex-1 bg-transparent outline-none"
            style={{
              fontSize: "var(--text-body)",
              color: "var(--text)",
              minHeight: 24,
            }}
            aria-label="Ask your financial coach"
          />

          {/* Voice input button (placeholder) */}
          <button
            type="button"
            className="shrink-0 p-1 rounded-lg transition-colors"
            style={{
              color: "var(--text-secondary)",
              opacity: 0.6,
            }}
            aria-label="Voice input (coming soon)"
            disabled
          >
            <Lucide.Mic style={{ width: 20, height: 20 }} />
          </button>

          {/* Submit button */}
          {value.trim() && (
            <button
              type="submit"
              disabled={disabled || loading}
              className="shrink-0 p-2 rounded-xl transition-all"
              style={{
                backgroundColor: "var(--primary)",
                color: "#FFFFFF",
                opacity: disabled || loading ? 0.5 : 1,
              }}
              aria-label="Send question"
            >
              {loading ? (
                <Lucide.Loader2 className="animate-spin" style={{ width: 18, height: 18 }} />
              ) : (
                <Lucide.Send style={{ width: 18, height: 18 }} />
              )}
            </button>
          )}
        </div>
      </form>

      {/* Suggestions dropdown */}
      {showSuggestions && displaySuggestions.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {!value.trim() && recentQueries.length > 0 && (
            <div
              className="px-3 py-2 text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-2)" }}
            >
              Recent Questions
            </div>
          )}
          {displaySuggestions.map((suggestion, index) => (
            <button
              key={`${suggestion}-${index}`}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full text-left px-4 py-3 transition-colors hover:bg-opacity-50"
              style={{
                color: "var(--text)",
                borderBottom: index < displaySuggestions.length - 1 ? "1px solid var(--border)" : "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface-2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div className="flex items-center gap-3">
                <Lucide.MessageCircle 
                  style={{ width: 16, height: 16, color: "var(--text-secondary)" }} 
                />
                <span style={{ fontSize: "var(--text-body)" }}>{suggestion}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
