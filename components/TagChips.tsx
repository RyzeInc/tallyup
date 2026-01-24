"use client";

/**
 * TagChips - Beach-themed chip styling
 * 
 * Design:
 * - Unselected: Shell cream with soft border
 * - Selected: Terracotta (burnt orange) tint - the hero color!
 */

export default function TagChips({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: string[];
}) {
  function toggle(tag: string) {
    const has = value.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (has) onChange(value.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
    else onChange([tag, ...value]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((tag) => {
        const active = value.some((t) => t.toLowerCase() === tag.toLowerCase());
        return (
          <button
            type="button"
            key={tag}
            onClick={() => toggle(tag)}
            className="rounded-full px-3 py-1 text-xs border"
            style={{
              backgroundColor: active 
                ? "rgba(196, 114, 74, 0.15)"   /* Terracotta tint */
                : "var(--shell-cream, var(--surface-2))",
              color: active 
                ? "var(--terracotta-deep, #A85D3B)" 
                : "var(--text)",
              borderColor: active 
                ? "rgba(196, 114, 74, 0.50)"   /* Terracotta border */
                : "var(--border-foam, var(--border))",
              transition: "all var(--motion-medium, 150ms) var(--ease-wave, ease-out)",
            }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
